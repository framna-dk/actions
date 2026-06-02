import { log } from "../logging.js";
import { ghJson } from "../gh.js";
import type { Tracker, IssueSnapshot, NormalizedIssue } from "./types.js";
import { TrackerError } from "./types.js";

export interface GitHubProjectsOptions {
  token: string;
  owner: string; // project owner login (org or user)
  projectNumber: number;
  projectNodeId: string;
  issueNumber: number;
  repoSlug: string; // "owner/repo" of the issue, to disambiguate boards spanning repos
}

interface StatusOption {
  id: string;
  name: string;
}

// `gh project item-list` paginates internally up to --limit (default 30), with
// no --paginate flag. We request a high cap and warn if a board exceeds it
// rather than silently truncating.
const ITEM_LIST_LIMIT = 5000;

interface FieldListJson {
  fields: Array<{ id: string; name: string; type?: string; options?: StatusOption[] }>;
}

interface ItemListJson {
  items: Array<{
    id: string;
    status?: string;
    content?: {
      type?: string;
      number?: number;
      title?: string;
      body?: string;
      url?: string;
      repository?: string;
    };
  }>;
  totalCount?: number;
}

/**
 * GitHub Projects v2 tracker, driven entirely through the `gh` CLI:
 *   reads  → `gh project field-list` + `gh project item-list` (+ `gh issue view`)
 *   writes → `gh project item-edit`
 * The board item id and Status field/options are cached from `fetchSnapshot` so
 * a subsequent `setStatus` need not re-read the whole board.
 */
export class GitHubProjectsTracker implements Tracker {
  private readonly opts: GitHubProjectsOptions;
  private itemId: string | null = null;
  private statusFieldId: string | null = null;
  private statusOptions: StatusOption[] = [];

  constructor(opts: GitHubProjectsOptions) {
    this.opts = opts;
  }

  async fetchSnapshot(): Promise<IssueSnapshot> {
    const { token, owner, projectNumber, issueNumber, repoSlug } = this.opts;

    // Status field id + option ids.
    const fields = await ghJson<FieldListJson>(
      ["project", "field-list", String(projectNumber), "--owner", owner, "--format", "json"],
      token,
    );
    const statusField = fields.fields.find(
      (f) => f.name.toLowerCase() === "status" && Array.isArray(f.options),
    );
    if (!statusField) {
      throw new TrackerError("status_field_missing", `project ${owner}/${projectNumber} has no Status field`);
    }

    // The issue's board item.
    const list = await ghJson<ItemListJson>(
      [
        "project",
        "item-list",
        String(projectNumber),
        "--owner",
        owner,
        "--limit",
        String(ITEM_LIST_LIMIT),
        "--format",
        "json",
      ],
      token,
    );
    if (typeof list.totalCount === "number" && list.totalCount > list.items.length) {
      log.warn({
        module: "tracker",
        event: "item_list_truncated",
        message: `board has ${list.totalCount} items but only ${list.items.length} fetched (limit ${ITEM_LIST_LIMIT})`,
      });
    }

    const item = list.items.find(
      (it) =>
        it.content?.type === "Issue" &&
        it.content.number === issueNumber &&
        it.content.repository === repoSlug,
    );
    if (!item) {
      throw new TrackerError(
        "issue_not_in_project",
        `issue ${repoSlug}#${issueNumber} is not in project ${owner}/${projectNumber}`,
      );
    }

    // Labels live on the issue, not the project item — best-effort lookup.
    let labels: string[] = [];
    try {
      const view = await ghJson<{ labels?: Array<{ name: string }> }>(
        ["issue", "view", String(issueNumber), "--repo", repoSlug, "--json", "labels"],
        token,
      );
      labels = (view.labels ?? []).map((l) => l.name.toLowerCase());
    } catch (e) {
      log.warn({ module: "tracker", event: "labels_fetch_failed", message: String((e as Error).message) });
    }

    // Cache identifiers so setStatus needn't re-read the board.
    this.itemId = item.id;
    this.statusFieldId = statusField.id;
    this.statusOptions = statusField.options ?? [];

    const state = typeof item.status === "string" ? item.status : "";
    const issue: NormalizedIssue = {
      id: `${repoSlug}#${issueNumber}`,
      identifier: `#${issueNumber}`,
      title: item.content?.title ?? "",
      description: item.content?.body ?? null,
      state,
      url: item.content?.url ?? null,
      labels,
    };

    log.info({
      module: "tracker",
      event: "fetched",
      issue_id: issue.id,
      issue_identifier: issue.identifier,
      message: `state=${state} options=${this.statusOptions.map((o) => o.name).join(",")}`,
    });

    return { issue, availableStates: this.statusOptions.map((o) => o.name) };
  }

  async setStatus(statusName: string): Promise<void> {
    if (!this.itemId || !this.statusFieldId) {
      // Warm the cache (and validate the issue is on the board) first.
      await this.fetchSnapshot();
    }
    const wanted = statusName.trim();
    const opt = this.statusOptions.find(
      (o) => o.name === wanted || o.name.toLowerCase() === wanted.toLowerCase(),
    );
    if (!opt) {
      throw new TrackerError(
        "unknown_status",
        `status '${wanted}' not found among: ${this.statusOptions.map((o) => o.name).join(", ")}`,
      );
    }
    await ghJson(
      [
        "project",
        "item-edit",
        "--id",
        this.itemId!,
        "--project-id",
        this.opts.projectNodeId,
        "--field-id",
        this.statusFieldId!,
        "--single-select-option-id",
        opt.id,
        "--format",
        "json",
      ],
      this.opts.token,
    );
  }
}
