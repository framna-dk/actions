import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Liquid } from "liquidjs";
import type { NormalizedIssue } from "./issue.js";

const DEFAULT_TEMPLATE = `You are working on issue {{ issue.identifier }}: {{ issue.title }}.

{% if issue.description %}{{ issue.description }}{% endif %}

When the work is complete, call the \`set_issue_status\` tool with this issue's id and a non-active status name (typically "Human Review") to hand off back to a human. Do NOT leave the status in "Todo" or "In Progress" — the orchestrator will redispatch this run otherwise.

If you make code changes, push them to the \`agent/{{ issue.identifier }}\` branch and open a PR against \`main\` using \`gh pr create\`.

{% if attempt %}This is attempt {{ attempt }}. Review previous work before continuing.{% endif %}
`;

export interface RenderContext {
  issue: NormalizedIssue;
  attempt: number;
  turn: number;
}

const engine = new Liquid({ strictVariables: true, strictFilters: true });

export async function renderPrompt(workspacePath: string, ctx: RenderContext): Promise<string> {
  let template: string;
  const promptPath = join(workspacePath, ".banzai", "prompt.md");
  try {
    template = await readFile(promptPath, "utf8");
  } catch {
    template = DEFAULT_TEMPLATE;
  }
  try {
    return await engine.parseAndRender(template, ctx);
  } catch (e) {
    throw new Error(`prompt_render_failed: ${(e as Error).message}`);
  }
}

export function renderContinuation(turn: number, maxTurns: number): string {
  return `Continue working on the issue. You are on turn ${turn} of ${maxTurns}. When the work is complete, call \`set_issue_status\` to move the issue out of "Todo" / "In Progress".`;
}
