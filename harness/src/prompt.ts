import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { Liquid } from "liquidjs";
import type { NormalizedIssue } from "./issue.js";

export interface RenderContext {
  issue: NormalizedIssue;
  attempt: number;
  turn: number;
}

const engine = new Liquid({ strictVariables: true, strictFilters: true });

/**
 * Render the prompt template at `promptPath`. The path is required and resolved
 * against the workspace when relative; there is no built-in fallback template,
 * so a missing or unreadable prompt is a hard error.
 */
export async function renderPrompt(
  workspacePath: string,
  promptPath: string,
  ctx: RenderContext,
): Promise<string> {
  const resolved = isAbsolute(promptPath) ? promptPath : join(workspacePath, promptPath);
  let template: string;
  try {
    template = await readFile(resolved, "utf8");
  } catch (e) {
    throw new Error(`prompt_missing: ${resolved}: ${(e as Error).message}`);
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
