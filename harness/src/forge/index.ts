import type { Forge } from "./types.js";
import { GitHubForge, type GitHubForgeOptions } from "./github.js";

export type { Forge, PullRequestResult, OpenPullRequestInput } from "./types.js";
export { ForgeError } from "./types.js";

/**
 * Construct the forge (code host) for the given kind. Today only GitHub is
 * supported; a new forge is added by implementing `Forge` and adding a case
 * here.
 */
export function createForge(kind: string, opts: GitHubForgeOptions): Forge {
  switch (kind) {
    case "github":
      return new GitHubForge(opts);
    default:
      throw new Error(`unsupported_forge_kind: ${kind}`);
  }
}
