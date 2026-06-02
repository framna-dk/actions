import { CodexAppServerClient, type DynamicToolSpec, type ToolHandler } from "./app_server.js";
import { log } from "../logging.js";
import { fetchIssueSnapshot, type IssueSnapshot } from "../issue.js";
import { renderPrompt, renderContinuation } from "../prompt.js";
import { makeSetIssueStatusTool } from "../tools/set_issue_status.js";
import { makeGithubGraphqlTool } from "../tools/github_graphql.js";
import type { HarnessConfig } from "../config.js";

export interface RunInput {
  workspacePath: string;
  cfg: HarnessConfig;
  token: string;
  attempt: number;
  initialSnapshot: IssueSnapshot;
}

export interface RunOutcome {
  outcome: "success" | "failure";
  reason: string | null;
  tracker_state_at_exit: string | null;
  turn_count: number;
}

interface ThreadStartResult {
  thread: { id: string };
}

/** Subset of the Turn object we care about. Full shape in v2 schema. */
interface TurnObject {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
  error?: { message?: string; code?: string } | null;
}

interface TurnStartResult {
  turn: TurnObject;
}

interface TurnCompletedNotification {
  threadId: string;
  turn: TurnObject;
}

export async function runTurns(input: RunInput): Promise<RunOutcome> {
  const { workspacePath, cfg, token, attempt } = input;
  let snapshot = input.initialSnapshot;
  let turnCount = 0;

  const refreshAfter = async () => {
    snapshot = await fetchIssueSnapshot({
      endpoint: cfg.tracker.endpoint,
      token,
      issueId: snapshot.issue.id,
      projectId: cfg.tracker.project_id,
    });
  };

  const toolCtxBase = {
    endpoint: cfg.tracker.endpoint,
    token,
    projectId: cfg.tracker.project_id,
  };

  const setStatus = makeSetIssueStatusTool({
    ...toolCtxBase,
    snapshot: () => snapshot,
    refreshAfter,
  });
  const ghGraphql = makeGithubGraphqlTool({ endpoint: toolCtxBase.endpoint, token: toolCtxBase.token });

  const dynamicTools: DynamicToolSpec[] = [];
  const handlers: Array<[string, ToolHandler]> = [];
  if (cfg.agent.tools.set_issue_status) {
    dynamicTools.push(setStatus.spec);
    handlers.push([setStatus.spec.name, setStatus.handler]);
  }
  if (cfg.agent.tools.github_graphql) {
    dynamicTools.push(ghGraphql.spec);
    handlers.push([ghGraphql.spec.name, ghGraphql.handler]);
  }

  const client = new CodexAppServerClient(cfg.agent.codex.command);
  for (const [name, h] of handlers) client.registerTool(name, h);

  // Track turn completion via notifications. We resolve a per-turn deferred
  // when we see `turn/completed` for the matching turnId.
  let activeTurnId: string | null = null;
  let resolveActiveTurn: ((payload: TurnCompletedNotification) => void) | null = null;
  let rejectActiveTurn: ((err: Error) => void) | null = null;

  client.onNotification((method, params) => {
    if (method === "turn/completed") {
      const p = params as TurnCompletedNotification;
      if (p.turn.id === activeTurnId && resolveActiveTurn) {
        const r = resolveActiveTurn;
        resolveActiveTurn = null;
        rejectActiveTurn = null;
        activeTurnId = null;
        r(p);
      }
      return;
    }
    if (method === "thread/closed") {
      log.warn({ module: "codex", event: method, message: shortJson(params) });
      if (rejectActiveTurn) rejectActiveTurn(new Error(`thread closed during turn`));
      return;
    }
    // item/completed carries the high-signal work: agent messages, commands
    // run, tool calls. Log a compact one-line summary at info; everything else
    // (per-word deltas, item/started, reasoning, status churn) is debug.
    if (method === "item/completed") {
      const summary = summarizeItem(params);
      if (summary) log.info({ module: "codex", event: "item", message: summary });
      else log.debug({ module: "codex", event: method, message: shortJson(params) });
      return;
    }
    if (MILESTONE_METHODS.has(method)) {
      log.info({ module: "codex", event: method, message: shortJson(params) });
      return;
    }
    log.debug({ module: "codex", event: method, message: shortJson(params) });
  });

  try {
    await client.request("initialize", {
      clientInfo: { name: "banzai-harness", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    log.info({ module: "codex", event: "initialized" });

    const threadRes = (await client.request<ThreadStartResult>("thread/start", {
      cwd: workspacePath,
      sandbox: cfg.agent.codex.sandbox,
      approvalPolicy: cfg.agent.codex.approval_policy ?? "never",
      dynamicTools,
    })) as ThreadStartResult;
    const threadId = threadRes.thread.id;
    log.info({ module: "codex", event: "thread_started", message: threadId });

    for (let turn = 1; turn <= cfg.agent.max_turns; turn++) {
      turnCount = turn;
      const promptText =
        turn === 1
          ? await renderPrompt(workspacePath, { issue: snapshot.issue, attempt, turn })
          : renderContinuation(turn, cfg.agent.max_turns);

      log.info({ module: "codex", event: "turn_starting", message: `turn=${turn}/${cfg.agent.max_turns}` });

      const turnPromise = new Promise<TurnCompletedNotification>((resolve, reject) => {
        resolveActiveTurn = resolve;
        rejectActiveTurn = reject;
      });
      const startRes = (await client.request<TurnStartResult>("turn/start", {
        threadId,
        input: [{ type: "text", text: promptText }],
      })) as TurnStartResult;
      activeTurnId = startRes.turn.id;

      const timeoutMs = cfg.agent.codex.turn_timeout_ms;
      const completed = await Promise.race([
        turnPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`turn_timeout: ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);

      log.info({
        module: "codex",
        event: "turn_completed",
        issue_id: snapshot.issue.id,
        issue_identifier: snapshot.issue.identifier,
        message: `turn=${turn} id=${completed.turn.id} status=${completed.turn.status}`,
      });

      if (completed.turn.status === "failed" || completed.turn.status === "interrupted") {
        const reason =
          completed.turn.status === "failed"
            ? `turn_failed:${completed.turn.error?.message ?? "unknown"}`
            : "turn_cancelled";
        log.error({ module: "codex", event: "turn_nonsuccess", message: reason });
        await client.shutdown();
        return {
          outcome: "failure",
          reason,
          tracker_state_at_exit: snapshot.issue.state,
          turn_count: turnCount,
        };
      }

      // Refresh state — the agent may have called set_issue_status which updates
      // `snapshot` via refreshAfter, but tools the agent invokes outside our
      // helper (e.g. raw gh CLI) won't. Always re-fetch to be safe.
      await refreshAfter();

      const stateLower = snapshot.issue.state.toLowerCase();
      const activeLower = cfg.tracker.active_states.map((s) => s.toLowerCase());
      if (!activeLower.includes(stateLower)) {
        log.info({
          module: "codex",
          event: "exit_state_inactive",
          message: `state=${snapshot.issue.state}`,
        });
        await client.shutdown();
        return {
          outcome: "success",
          reason: null,
          tracker_state_at_exit: snapshot.issue.state,
          turn_count: turnCount,
        };
      }
    }

    log.warn({
      module: "codex",
      event: "exit_max_turns",
      message: `max_turns=${cfg.agent.max_turns} reached with state=${snapshot.issue.state}`,
    });
    await client.shutdown();
    return {
      outcome: "success",
      reason: "max_turns_reached_with_active_state",
      tracker_state_at_exit: snapshot.issue.state,
      turn_count: turnCount,
    };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    log.error({ module: "codex", event: "turn_loop_error", message: msg });
    await client.shutdown();
    return {
      outcome: "failure",
      reason: msg.startsWith("turn_timeout") ? "turn_timeout" : msg,
      tracker_state_at_exit: snapshot.issue.state,
      turn_count: turnCount,
    };
  }
}

function shortJson(p: unknown): string {
  try {
    const s = JSON.stringify(p);
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  } catch {
    return "<unserializable>";
  }
}

/** Notification methods worth surfacing at info level (low volume, high signal). */
const MILESTONE_METHODS = new Set<string>([
  "thread/started",
  "turn/started",
  "thread/tokenUsage/updated",
  "account/rateLimits/updated",
  "thread/error",
]);

function truncate(s: string, n: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n) + "…" : oneLine;
}

/**
 * Compact one-line summary of an `item/completed` notification, or null to
 * fall through to debug. Surfaces the high-signal items (commands, agent
 * messages, tool calls) without dumping the full payload; skips low-signal
 * items like reasoning blocks.
 */
function summarizeItem(params: unknown): string | null {
  const item = (params as { item?: Record<string, unknown> } | undefined)?.item;
  if (!item || typeof item !== "object") return null;
  const type = item.type as string | undefined;
  switch (type) {
    case "commandExecution": {
      const cmd = truncate(String(item.command ?? ""), 160);
      const exit = item.exitCode;
      return `cmd: ${cmd}${exit === null || exit === undefined ? "" : ` (exit ${exit})`}`;
    }
    case "agentMessage": {
      const phase = item.phase ? `[${item.phase}] ` : "";
      return `msg: ${phase}${truncate(String(item.text ?? ""), 280)}`;
    }
    case "dynamicToolCall": {
      const args = truncate(JSON.stringify(item.arguments ?? {}), 120);
      return `tool: ${item.tool}(${args}) success=${item.success}`;
    }
    case "fileChange":
      return `file_change: ${truncate(JSON.stringify(item.changes ?? item), 200)}`;
    case "reasoning":
      // Reasoning summaries are usually empty and high-frequency → debug.
      return null;
    default:
      return null;
  }
}
