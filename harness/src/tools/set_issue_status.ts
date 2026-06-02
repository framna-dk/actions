import type { ToolCallParams, ToolCallResult } from "../codex/app_server.js";
import type { IssueSnapshot } from "../issue.js";
import { log } from "../logging.js";

interface Ctx {
  endpoint: string;
  token: string;
  projectId: string;
  snapshot: () => IssueSnapshot;       // late-bound: the harness updates this when refreshing
  refreshAfter: () => Promise<void>;   // re-fetch after the mutation succeeds
}

const SPEC = {
  name: "set_issue_status",
  description:
    "Move the current issue's status (a single-select field named 'Status' on the configured GitHub Projects v2 board) to a new value. Use this when the work is complete or when handing off to a human. Always call this before exiting if the issue is still in an active state, otherwise the orchestrator will redispatch.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["status_name"],
    properties: {
      status_name: {
        type: "string",
        description:
          "The target status option name on the project board (e.g. 'Human Review', 'Done'). Must match an existing option of the 'Status' single-select field exactly (case-insensitive match is attempted).",
      },
    },
  },
} as const;

export function makeSetIssueStatusTool(ctx: Ctx) {
  const handler = async (params: ToolCallParams): Promise<ToolCallResult> => {
    const args = (params.arguments ?? {}) as { status_name?: unknown };
    if (typeof args.status_name !== "string" || args.status_name.trim() === "") {
      return fail(`status_name must be a non-empty string`);
    }
    const wanted = args.status_name.trim();
    const snap = ctx.snapshot();
    const opt = snap.projectStatus.statusOptions.find(
      (o) => o.name === wanted || o.name.toLowerCase() === wanted.toLowerCase(),
    );
    if (!opt) {
      const known = snap.projectStatus.statusOptions.map((o) => o.name).join(", ");
      return fail(`status '${wanted}' not found among options: ${known}`);
    }

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
    const resp = await fetch(ctx.endpoint, {
      method: "POST",
      headers: {
        "User-Agent": "banzai-harness",
        Authorization: `Bearer ${ctx.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          projectId: ctx.projectId,
          itemId: snap.projectStatus.projectItemId,
          fieldId: snap.projectStatus.statusFieldId,
          optionId: opt.id,
        },
      }),
    });
    if (!resp.ok) {
      return fail(`HTTP ${resp.status} from GraphQL endpoint`);
    }
    const json = (await resp.json()) as { errors?: Array<{ message: string }> };
    if (json.errors && json.errors.length > 0) {
      return fail(`GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
    }

    log.info({
      module: "tool",
      event: "set_issue_status_ok",
      issue_id: snap.issue.id,
      issue_identifier: snap.issue.identifier,
      message: `${snap.issue.state} → ${opt.name}`,
    });
    // Refresh local snapshot so subsequent turn-decisions see the new state.
    await ctx.refreshAfter();
    return ok(`Set issue ${snap.issue.identifier} status from '${snap.issue.state}' to '${opt.name}'.`);
  };
  return { spec: SPEC, handler };
}

function ok(text: string): ToolCallResult {
  return { success: true, contentItems: [{ type: "inputText", text }] };
}

function fail(text: string): ToolCallResult {
  return { success: false, contentItems: [{ type: "inputText", text }] };
}
