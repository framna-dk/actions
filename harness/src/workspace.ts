import { mkdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { sanitize, assertContained, realpathOrSelf } from "./safety.js";
import { log } from "./logging.js";

export interface PrepInput {
  workspaceRoot: string;        // e.g. $HOME/banzai-workspaces (already expanded)
  issueIdentifier: string;      // e.g. #12
  repoSlug: string;             // e.g. framna-dk/Harness-playground
  repoRef: string;              // e.g. main
}

export interface PrepResult {
  workspacePath: string;
  branch: string;
  createdNow: boolean;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const out: string[] = [];
    const err: string[] = [];
    p.stdout.setEncoding("utf8");
    p.stderr.setEncoding("utf8");
    p.stdout.on("data", (c: string) => out.push(c));
    p.stderr.on("data", (c: string) => err.push(c));
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else {
        const oTail = out.join("").trim().slice(-500);
        const eTail = err.join("").trim().slice(-500);
        reject(new Error(`${cmd} ${args.join(" ")} exited ${code}: ${eTail || oTail}`));
      }
    });
  });
}

export async function prepareWorkspace(input: PrepInput): Promise<PrepResult> {
  const key = sanitize(input.issueIdentifier);
  const workspacePath = join(input.workspaceRoot, key);

  await mkdir(input.workspaceRoot, { recursive: true });
  await assertContained(workspacePath, input.workspaceRoot);

  let createdNow = false;
  const wsExists = await exists(workspacePath);
  if (!wsExists) {
    log.info({ module: "workspace", event: "clone", message: `${input.repoSlug} → ${workspacePath}` });
    await run("gh", ["repo", "clone", input.repoSlug, workspacePath]);
    createdNow = true;
  } else {
    const gitDir = join(workspacePath, ".git");
    if (!(await exists(gitDir))) {
      throw new Error(`workspace_not_a_repo: ${workspacePath} exists but has no .git`);
    }
  }

  await assertContained(await realpathOrSelf(workspacePath), input.workspaceRoot);

  const branch = `agent/${key}`;
  log.info({ module: "workspace", event: "branch_reset", message: branch });
  await run("git", ["-C", workspacePath, "fetch", "origin", "--prune"]);
  await run("git", ["-C", workspacePath, "checkout", input.repoRef]);
  await run("git", ["-C", workspacePath, "pull", "--ff-only"]);
  await run("git", ["-C", workspacePath, "checkout", "-B", branch]);

  return { workspacePath, branch, createdNow };
}
