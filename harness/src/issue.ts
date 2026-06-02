import { log } from "./logging.js";
import { ghJson } from "./gh.js";

export interface NormalizedIssue {
  // No GraphQL node id is available via `gh project`; this is a stable human id
  // ("owner/repo#12") used only for logging.
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: string;
  url: string | null;
}

export interface ProjectStatusInfo {
  projectItemId: string;
  statusFieldId: string;
  statusOptions: Array<{ id: string; name: string }>;
}

export interface IssueSnapshot {
  issue: NormalizedIssue;
  projectStatus: ProjectStatusInfo;
}

export interface TrackerRef {
  token: string;
  owner: string; // project owner login (org or user)
  projectNumber: number;
  issueNumber: number;
  repoSlug: string; // "owner/repo" of the issue, to disambiguate boards spanning repos
}

export interface SetStatusInput {
  token: string;
  projectNodeId: string;
  itemId: string;
  fieldId: string;
  optionId: string;
}

// `gh project item-list` paginates internally up to --limit (default 30), with
// no --paginate flag. We request a high cap and warn if a board exceeds it
// rather than silently truncating.
const ITEM_LIST_LIMIT = 5000;

interface FieldListJson {
  fields: Array<{
    id: string;
    name: string;
    type?: string;
    options?: Array<{ id: string; name: string }>;
  }>;
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
 * Set a project item's Status single-select to a known option via
 * `gh project item-edit`. Throws on non-zero exit. No snapshot bookkeeping; the
 * caller should re-fetch if it needs the updated state.
 */
export async function setProjectItemStatus(input: SetStatusInput): Promise<void> {
  await ghJson(
    [
      "project",
      "item-edit",
      "--id",
      input.itemId,
      "--project-id",
      input.projectNodeId,
      "--field-id",
      input.fieldId,
      "--single-select-option-id",
      input.optionId,
      "--format",
      "json",
    ],
    input.token,
  );
}

export async function fetchIssueSnapshot(ref: TrackerRef): Promise<IssueSnapshot> {
  const ownerArgs = ["--owner", ref.owner, "--format", "json"];

  // Status field id + option ids.
  const fields = await ghJson<FieldListJson>(
    ["project", "field-list", String(ref.projectNumber), ...ownerArgs],
    ref.token,
  );
  const statusField = fields.fields.find(
    (f) => f.name.toLowerCase() === "status" && Array.isArray(f.options),
  );
  if (!statusField) {
    throw new Error(`issue_fetch_failed: project ${ref.owner}/${ref.projectNumber} has no Status field`);
  }

  // The issue's board item.
  const list = await ghJson<ItemListJson>(
    [
      "project",
      "item-list",
      String(ref.projectNumber),
      "--owner",
      ref.owner,
      "--limit",
      String(ITEM_LIST_LIMIT),
      "--format",
      "json",
    ],
    ref.token,
  );
  if (typeof list.totalCount === "number" && list.totalCount > list.items.length) {
    log.warn({
      module: "issue",
      event: "item_list_truncated",
      message: `board has ${list.totalCount} items but only ${list.items.length} fetched (limit ${ITEM_LIST_LIMIT})`,
    });
  }

  const item = list.items.find(
    (it) =>
      it.content?.type === "Issue" &&
      it.content.number === ref.issueNumber &&
      it.content.repository === ref.repoSlug,
  );
  if (!item) {
    throw new Error(
      `issue_fetch_failed: issue ${ref.repoSlug}#${ref.issueNumber} is not in project ${ref.owner}/${ref.projectNumber}`,
    );
  }

  const state = typeof item.status === "string" ? item.status : "";
  const issue: NormalizedIssue = {
    id: `${ref.repoSlug}#${ref.issueNumber}`,
    identifier: `#${ref.issueNumber}`,
    title: item.content?.title ?? "",
    description: item.content?.body ?? null,
    state,
    url: item.content?.url ?? null,
  };

  const projectStatus: ProjectStatusInfo = {
    projectItemId: item.id,
    statusFieldId: statusField.id,
    statusOptions: statusField.options ?? [],
  };

  log.info({
    module: "issue",
    event: "fetched",
    issue_id: issue.id,
    issue_identifier: issue.identifier,
    message: `state=${state} options=${projectStatus.statusOptions.map((o) => o.name).join(",")}`,
  });

  return { issue, projectStatus };
}
