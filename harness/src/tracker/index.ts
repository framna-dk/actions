import type { Tracker } from "./types.js";
import { GitHubProjectsTracker, type GitHubProjectsOptions } from "./github_projects.js";

export type { Tracker, IssueSnapshot, NormalizedIssue } from "./types.js";
export { TrackerError } from "./types.js";

/**
 * Construct the tracker for the given kind. Today only GitHub Projects v2 is
 * supported; a new tracker is added by implementing `Tracker` and adding a case
 * here (its construction options are tracker-specific, mapped from the action
 * inputs by the caller).
 */
export function createTracker(kind: string, opts: GitHubProjectsOptions): Tracker {
  switch (kind) {
    case "github_projects_v2":
      return new GitHubProjectsTracker(opts);
    default:
      throw new Error(`unsupported_tracker_kind: ${kind}`);
  }
}
