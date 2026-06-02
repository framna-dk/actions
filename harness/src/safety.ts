import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

const SAFE_RE = /[^A-Za-z0-9._-]/g;

export function sanitize(s: string): string {
  const sanitized = s.replace(SAFE_RE, "_");
  if (sanitized === "" || sanitized === "." || sanitized === ".." || sanitized.includes("/")) {
    throw new Error(`unsafe_workspace_key: ${JSON.stringify(s)}`);
  }
  return sanitized;
}

export async function realpathOrSelf(p: string): Promise<string> {
  try {
    return await realpath(p);
  } catch {
    return resolve(p);
  }
}

export async function assertContained(child: string, root: string): Promise<void> {
  const rChild = await realpathOrSelf(child);
  const rRoot = await realpathOrSelf(root);
  const rootWithSep = rRoot.endsWith(sep) ? rRoot : rRoot + sep;
  if (rChild !== rRoot && !rChild.startsWith(rootWithSep)) {
    throw new Error(`unsafe_workspace_path: ${child} not under ${root}`);
  }
}
