import { log } from "./logging.js";

export interface NormalizedIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: string;
  url: string | null;
  labels: string[];
  created_at: string | null;
  updated_at: string | null;
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

interface FetchInput {
  endpoint: string;
  token: string;
  issueId: string;
  projectId: string;
}

const QUERY = /* GraphQL */ `
  query ($issueId: ID!, $projectId: ID!) {
    issue: node(id: $issueId) {
      ... on Issue {
        id
        number
        title
        body
        url
        createdAt
        updatedAt
        labels(first: 20) { nodes { name } }
      }
    }
    project: node(id: $projectId) {
      ... on ProjectV2 {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            id
            options { id name }
          }
        }
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue { id }
              ... on PullRequest { id }
            }
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2FieldCommon { name } }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface RawIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  labels?: { nodes: Array<{ name: string }> };
}

interface RawProjectItem {
  id: string;
  content: { id?: string } | null;
  fieldValues: {
    nodes: Array<{
      __typename: string;
      name?: string | null;
      field?: { name?: string };
    }>;
  };
}

interface RawProject {
  field: { id: string; options: Array<{ id: string; name: string }> } | null;
  items: { nodes: RawProjectItem[] };
}

interface SetStatusInput {
  endpoint: string;
  token: string;
  projectId: string;
  itemId: string;
  fieldId: string;
  optionId: string;
}

/**
 * Low-level mutation: sets a project item's Status single-select to a known option.
 * Throws on transport or GraphQL errors. No snapshot bookkeeping; the caller
 * should re-fetch if it needs the updated state.
 */
export async function setProjectItemStatus(input: SetStatusInput): Promise<void> {
  const mutation = /* GraphQL */ `
    mutation ($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }
  `;
  const resp = await fetch(input.endpoint, {
    method: "POST",
    headers: {
      "User-Agent": "banzai-harness",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        projectId: input.projectId,
        itemId: input.itemId,
        fieldId: input.fieldId,
        optionId: input.optionId,
      },
    }),
  });
  if (!resp.ok) throw new Error(`status_update_failed: HTTP ${resp.status}`);
  const json = (await resp.json()) as { errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`status_update_failed: ${json.errors.map((e) => e.message).join("; ")}`);
  }
}

export async function fetchIssueSnapshot(input: FetchInput): Promise<IssueSnapshot> {
  const { endpoint, token, issueId, projectId } = input;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "User-Agent": "banzai-harness",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { issueId, projectId } }),
  });
  if (!resp.ok) {
    throw new Error(`issue_fetch_failed: HTTP ${resp.status}`);
  }
  const json = (await resp.json()) as {
    data?: { issue: RawIssue | null; project: RawProject | null };
    errors?: Array<{ message: string }>;
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`issue_fetch_failed: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data?.issue) throw new Error(`issue_fetch_failed: issue not found`);
  if (!json.data?.project) throw new Error(`issue_fetch_failed: project not found`);

  const raw = json.data.issue;
  const project = json.data.project;
  if (!project.field) {
    throw new Error(`issue_fetch_failed: project has no Status field`);
  }

  const matchingItem = project.items.nodes.find((it) => it.content?.id === raw.id);
  if (!matchingItem) {
    throw new Error(`issue_fetch_failed: issue ${raw.id} is not in project ${projectId}`);
  }

  let state = "";
  for (const fv of matchingItem.fieldValues.nodes) {
    if (
      fv.__typename === "ProjectV2ItemFieldSingleSelectValue" &&
      fv.field?.name === "Status" &&
      typeof fv.name === "string"
    ) {
      state = fv.name;
    }
  }

  const issue: NormalizedIssue = {
    id: raw.id,
    identifier: `#${raw.number}`,
    title: raw.title,
    description: raw.body ?? null,
    state,
    url: raw.url ?? null,
    labels: (raw.labels?.nodes ?? []).map((l) => l.name.toLowerCase()),
    created_at: raw.createdAt ?? null,
    updated_at: raw.updatedAt ?? null,
  };

  const projectStatus: ProjectStatusInfo = {
    projectItemId: matchingItem.id,
    statusFieldId: project.field.id,
    statusOptions: project.field.options,
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
