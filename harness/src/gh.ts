import { spawn } from "node:child_process";

export interface GhResult {
  stdout: string;
  stderr: string;
}

/**
 * Run a `gh` CLI command, capturing stdout/stderr. The GitHub token is passed
 * via the GH_TOKEN env var (gh's standard auth channel); prompts are disabled so
 * a misconfigured runner fails fast instead of hanging.
 */
export async function gh(args: string[], token: string): Promise<GhResult> {
  return new Promise((resolve, reject) => {
    const p = spawn("gh", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GH_TOKEN: token, GH_PROMPT_DISABLED: "1" },
    });
    const out: string[] = [];
    const err: string[] = [];
    p.stdout.setEncoding("utf8");
    p.stderr.setEncoding("utf8");
    p.stdout.on("data", (c: string) => out.push(c));
    p.stderr.on("data", (c: string) => err.push(c));
    p.on("error", reject);
    p.on("exit", (code) => {
      const stdout = out.join("");
      const stderr = err.join("");
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const tail = (stderr.trim() || stdout.trim()).slice(-500);
        reject(new Error(`gh ${args.join(" ")} exited ${code}: ${tail}`));
      }
    });
  });
}

/** Run a `gh` command with `--format json` and parse the result. */
export async function ghJson<T>(args: string[], token: string): Promise<T> {
  const { stdout } = await gh(args, token);
  try {
    return JSON.parse(stdout) as T;
  } catch (e) {
    throw new Error(`gh_json_parse_failed: ${args.join(" ")}: ${(e as Error).message}`);
  }
}
