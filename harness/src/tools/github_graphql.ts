import type { ToolCallParams, ToolCallResult } from "../codex/app_server.js";
import { log } from "../logging.js";

interface Ctx {
  endpoint: string;
  token: string;
}

const SPEC = {
  name: "github_graphql",
  description:
    "Execute a single GraphQL operation against the configured GitHub GraphQL endpoint. Use only when set_issue_status cannot express what you need (e.g. complex queries). Provide a single-operation document; multi-operation documents are rejected.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", description: "A single GraphQL operation." },
      variables: { type: "object", description: "Optional variables object." },
    },
  },
} as const;

const OP_RE = /\b(query|mutation|subscription)\b/gi;

export function makeGithubGraphqlTool(ctx: Ctx) {
  const handler = async (params: ToolCallParams): Promise<ToolCallResult> => {
    const args = (params.arguments ?? {}) as { query?: unknown; variables?: unknown };
    if (typeof args.query !== "string" || args.query.trim() === "") {
      return fail("query must be a non-empty string");
    }
    const opCount = (args.query.match(OP_RE) ?? []).length;
    if (opCount > 1) {
      return fail("multi-operation documents are not allowed; submit one operation per call");
    }
    let variables: object | undefined;
    if (args.variables !== undefined) {
      if (typeof args.variables !== "object" || args.variables === null || Array.isArray(args.variables)) {
        return fail("variables must be an object if present");
      }
      variables = args.variables as object;
    }
    const resp = await fetch(ctx.endpoint, {
      method: "POST",
      headers: {
        "User-Agent": "banzai-harness",
        Authorization: `Bearer ${ctx.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: args.query, variables }),
    });
    let body: unknown;
    try {
      body = await resp.json();
    } catch {
      return fail(`non-JSON response from GraphQL endpoint (HTTP ${resp.status})`);
    }
    if (!resp.ok) {
      return fail(`HTTP ${resp.status}: ${JSON.stringify(body).slice(0, 1000)}`);
    }
    const j = body as { data?: unknown; errors?: Array<{ message: string }> };
    if (j.errors && j.errors.length > 0) {
      log.info({ module: "tool", event: "github_graphql_errors", message: j.errors.map((e) => e.message).join("; ") });
      return {
        success: false,
        contentItems: [{ type: "inputText", text: JSON.stringify(j).slice(0, 4000) }],
      };
    }
    return ok(JSON.stringify(j).slice(0, 8000));
  };
  return { spec: SPEC, handler };
}

function ok(text: string): ToolCallResult {
  return { success: true, contentItems: [{ type: "inputText", text }] };
}

function fail(text: string): ToolCallResult {
  return { success: false, contentItems: [{ type: "inputText", text }] };
}
