import type { ToolCallParams, ToolCallResult, ToolDefinition } from "../agent/types.js";
import type { Tracker, IssueSnapshot } from "../tracker/types.js";
import { log } from "../logging.js";

interface Ctx {
  tracker: Tracker;
  snapshot: () => IssueSnapshot; // late-bound: the harness updates this when refreshing
  refreshAfter: () => Promise<void>; // re-fetch after the mutation succeeds
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

export function makeSetIssueStatusTool(ctx: Ctx): ToolDefinition {
  const handler = async (params: ToolCallParams): Promise<ToolCallResult> => {
    const args = (params.arguments ?? {}) as { status_name?: unknown };
    if (typeof args.status_name !== "string" || args.status_name.trim() === "") {
      return fail(`status_name must be a non-empty string`);
    }
    const wanted = args.status_name.trim();
    const snap = ctx.snapshot();
    const match = snap.availableStates.find(
      (s) => s === wanted || s.toLowerCase() === wanted.toLowerCase(),
    );
    if (!match) {
      return fail(`status '${wanted}' not found among options: ${snap.availableStates.join(", ")}`);
    }

    const prev = snap.issue.state;
    try {
      await ctx.tracker.setStatus(match);
    } catch (e) {
      return fail(`status_update_failed: ${(e as Error).message}`);
    }

    log.info({
      module: "tool",
      event: "set_issue_status_ok",
      issue_id: snap.issue.id,
      issue_identifier: snap.issue.identifier,
      message: `${prev} → ${match}`,
    });
    // Refresh local snapshot so subsequent turn-decisions see the new state.
    await ctx.refreshAfter();
    return ok(`Set issue ${snap.issue.identifier} status from '${prev}' to '${match}'.`);
  };
  return { spec: SPEC, handler };
}

function ok(text: string): ToolCallResult {
  return { success: true, contentItems: [{ type: "inputText", text }] };
}

function fail(text: string): ToolCallResult {
  return { success: false, contentItems: [{ type: "inputText", text }] };
}
