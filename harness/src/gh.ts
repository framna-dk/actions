import { run, type RunResult } from "./exec.js";

export type GhResult = RunResult;

/**
 * Run a `gh` CLI command. The GitHub token is passed via GH_TOKEN (gh's standard
 * auth channel); prompts are disabled so a misconfigured runner fails fast.
 */
export async function gh(args: string[], token: string): Promise<GhResult> {
  return run("gh", args, {
    env: { ...process.env, GH_TOKEN: token, GH_PROMPT_DISABLED: "1" },
  });
}

/** Run a `gh` command with `--format json` (or `--json`) and parse the result. */
export async function ghJson<T>(args: string[], token: string): Promise<T> {
  const { stdout } = await gh(args, token);
  try {
    return JSON.parse(stdout) as T;
  } catch (e) {
    throw new Error(`gh_json_parse_failed: ${args.join(" ")}: ${(e as Error).message}`);
  }
}
