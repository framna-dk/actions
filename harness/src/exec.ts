import { spawn } from "node:child_process";

export interface RunResult {
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Spawn a command and capture stdout/stderr. Rejects on non-zero exit with a
 * trimmed tail of the output for context.
 */
export async function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: opts.env ?? process.env,
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
        reject(new Error(`${cmd} ${args.join(" ")} exited ${code}: ${tail}`));
      }
    });
  });
}
