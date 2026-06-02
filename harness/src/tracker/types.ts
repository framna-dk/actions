/**
 * Tracker abstraction. A tracker owns a single issue on some external board and
 * exposes just what the harness needs: read the issue's current state, and move
 * it to a named state. Concrete implementations (e.g. GitHub Projects v2) hide
 * their own identifiers and transport. Add a new tracker by implementing this
 * interface and wiring it into `createTracker`.
 */

export interface NormalizedIssue {
  id: string; // stable human id for logging (tracker-specific format)
  identifier: string; // e.g. "#12"
  title: string;
  description: string | null;
  state: string; // current status/column name
  url: string | null;
  labels: string[];
}

export interface IssueSnapshot {
  issue: NormalizedIssue;
  /** Valid status names this issue can be moved to (for validation/UX). */
  availableStates: string[];
}

export interface Tracker {
  /** Read the issue plus its current state and the set of valid states. */
  fetchSnapshot(): Promise<IssueSnapshot>;
  /** Move the issue to the named state (case-insensitive). Throws if unknown. */
  setStatus(statusName: string): Promise<void>;
}

export class TrackerError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}
