/**
 * Forge abstraction: the code host (repo, branches, pull requests, issue
 * comments) — as opposed to the Tracker, which is the work board (status).
 * Implementations hide the transport (e.g. the `gh` CLI). Add a new forge by
 * implementing this interface and wiring it into `createForge`.
 */

export interface PullRequestResult {
  url: string;
  number: number | null;
  created: boolean; // true if newly opened, false if an existing PR was updated
}

export interface OpenPullRequestInput {
  branch: string; // head branch (already checked out in the workspace)
  base: string; // base branch to merge into
  title: string;
  body: string;
}

export interface Forge {
  /**
   * Push the head branch and open a PR, or update the existing PR's title/body
   * if one is already open for that branch. Idempotent across retry attempts.
   */
  openOrUpdatePullRequest(input: OpenPullRequestInput): Promise<PullRequestResult>;
  /** Post a comment on the given issue. */
  commentOnIssue(issueNumber: number, body: string): Promise<void>;
}

export class ForgeError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}
