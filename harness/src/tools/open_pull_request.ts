import type { ToolCallParams, ToolCallResult, ToolDefinition } from "../agent/types.js";
import type { Forge } from "../forge/types.js";
import { log } from "../logging.js";

interface Ctx {
  forge: Forge;
  branch: string; // the agent's working branch (harness-owned)
  base: string; // base branch to target
}

const SPEC = {
  name: "open_pull_request",
  description:
    "Push the current work and open a pull request for it (or update the existing PR if one is already open for this branch). Call this once your changes are committed. The branch and base are managed by the harness — you only provide the title and body. Returns the PR URL.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body"],
    properties: {
      title: { type: "string", description: "Concise PR title." },
      body: { type: "string", description: "PR description (Markdown). Summarize what changed and why." },
    },
  },
} as const;

export function makeOpenPullRequestTool(ctx: Ctx): ToolDefinition {
  const handler = async (params: ToolCallParams): Promise<ToolCallResult> => {
    const args = (params.arguments ?? {}) as { title?: unknown; body?: unknown };
    if (typeof args.title !== "string" || args.title.trim() === "") {
      return fail("title must be a non-empty string");
    }
    if (typeof args.body !== "string") {
      return fail("body must be a string");
    }
    try {
      const pr = await ctx.forge.openOrUpdatePullRequest({
        branch: ctx.branch,
        base: ctx.base,
        title: args.title.trim(),
        body: args.body,
      });
      log.info({ module: "tool", event: "open_pull_request_ok", message: `${pr.created ? "created" : "updated"} ${pr.url}` });
      return ok(`${pr.created ? "Opened" : "Updated"} pull request: ${pr.url}`);
    } catch (e) {
      return fail(`open_pull_request_failed: ${(e as Error).message}`);
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
