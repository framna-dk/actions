import type { ToolCallParams, ToolCallResult, ToolDefinition } from "../agent/types.js";
import type { Forge } from "../forge/types.js";
import { log } from "../logging.js";

interface Ctx {
  forge: Forge;
  issueNumber: number;
}

const SPEC = {
  name: "comment",
  description:
    "Post a comment on the issue you're working on. Use this to record progress, surface a question or blocker, or note a decision for the human reviewer. The target issue is managed by the harness — you only provide the comment body.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", description: "Comment text (Markdown)." },
    },
  },
} as const;

export function makeCommentTool(ctx: Ctx): ToolDefinition {
  const handler = async (params: ToolCallParams): Promise<ToolCallResult> => {
    const args = (params.arguments ?? {}) as { body?: unknown };
    if (typeof args.body !== "string" || args.body.trim() === "") {
      return fail("body must be a non-empty string");
    }
    try {
      await ctx.forge.commentOnIssue(ctx.issueNumber, args.body);
      log.info({ module: "tool", event: "comment_ok", message: `#${ctx.issueNumber}` });
      return ok(`Posted comment on issue #${ctx.issueNumber}.`);
    } catch (e) {
      return fail(`comment_failed: ${(e as Error).message}`);
    }
  };
  return { spec: SPEC, handler };
}

function ok(text: string): ToolCallResult {
  return { success: true, contentItems: [{ type: "inputText", text }] };
}

function fail(text: string): ToolCallResult {
  return { success: false, contentItems: [{ type: "inputText", text }] };
}
