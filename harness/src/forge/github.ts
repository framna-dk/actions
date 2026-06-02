import { run } from "../exec.js";
import { gh, ghJson } from "../gh.js";
import { log } from "../logging.js";
import type { Forge, OpenPullRequestInput, PullRequestResult } from "./types.js";

export interface GitHubForgeOptions {
  token: string;
  repoSlug: string; // "owner/repo"
  workspacePath: string;
}

/**
 * GitHub code host, driven through `git` (push) and the `gh` CLI (pull requests,
 * issue comments). The agent's working branch is harness-owned and reset from
 * the base branch each run, so the push is a force-push.
 */
export class GitHubForge implements Forge {
  private readonly opts: GitHubForgeOptions;

  constructor(opts: GitHubForgeOptions) {
    this.opts = opts;
  }

  async openOrUpdatePullRequest(input: OpenPullRequestInput): Promise<PullRequestResult> {
    const { token, repoSlug, workspacePath } = this.opts;

    // The agent branch is reset from base each run; force-push to replace any
    // prior attempt's commits on the remote.
    await run("git", ["-C", workspacePath, "push", "--force", "origin", input.branch], {
      env: { ...process.env, GH_TOKEN: token },
    });

    const existing = await ghJson<Array<{ number: number; url: string }>>(
      ["pr", "list", "--repo", repoSlug, "--head", input.branch, "--state", "open", "--json", "number,url"],
      token,
    );

    if (existing.length > 0) {
      const pr = existing[0]!;
      await gh(
        ["pr", "edit", String(pr.number), "--repo", repoSlug, "--title", input.title, "--body", input.body],
        token,
      );
      log.info({ module: "forge", event: "pr_updated", message: pr.url });
      return { url: pr.url, number: pr.number, created: false };
    }

    const { stdout } = await gh(
      [
        "pr",
        "create",
        "--repo",
        repoSlug,
        "--head",
        input.branch,
        "--base",
        input.base,
        "--title",
        input.title,
        "--body",
        input.body,
      ],
      token,
    );
    const url = stdout.trim().split("\n").filter(Boolean).pop() ?? "";
    const number = parseNumberFromUrl(url);
    log.info({ module: "forge", event: "pr_created", message: url });
    return { url, number, created: true };
  }

  async commentOnIssue(issueNumber: number, body: string): Promise<void> {
    await gh(
      ["issue", "comment", String(issueNumber), "--repo", this.opts.repoSlug, "--body", body],
      this.opts.token,
    );
    log.info({ module: "forge", event: "issue_comment", message: `#${issueNumber}` });
  }
}

function parseNumberFromUrl(url: string): number | null {
  const m = url.match(/\/pull\/(\d+)\b/);
  return m ? parseInt(m[1]!, 10) : null;
}
