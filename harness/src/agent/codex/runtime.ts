import { CodexAppServerClient } from "./app_server.js";
import { log } from "../../logging.js";
import type {
  AgentRuntime,
  AgentSessionOptions,
  AgentRunResult,
  DynamicToolSpec,
} from "../types.js";

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

/**
 * Codex implementation of AgentRuntime: spawns the Codex app-server, opens a
 * thread, and drives turns. Per-turn prompts and the continue/stop decision are
 * supplied by the caller — this class owns only the Codex protocol mechanics.
 */
export class CodexRuntime implements AgentRuntime {
  async run(opts: AgentSessionOptions): Promise<AgentRunResult> {
    const { settings, tools, maxTurns } = opts;
    let turnCount = 0;

    const dynamicTools: DynamicToolSpec[] = tools.map((t) => t.spec);
    const client = new CodexAppServerClient(settings.command);
    for (const t of tools) client.registerTool(t.spec.name, t.handler);

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
        cwd: opts.workspacePath,
        sandbox: settings.sandbox,
        approvalPolicy: settings.approvalPolicy ?? "never",
        dynamicTools,
      })) as ThreadStartResult;
      const threadId = threadRes.thread.id;
      log.info({ module: "codex", event: "thread_started", message: threadId });

      for (let turn = 1; turn <= maxTurns; turn++) {
        turnCount = turn;
        const promptText = await opts.prompt(turn);

        log.info({ module: "codex", event: "turn_starting", message: `turn=${turn}/${maxTurns}` });

        const turnPromise = new Promise<TurnCompletedNotification>((resolve, reject) => {
          resolveActiveTurn = resolve;
          rejectActiveTurn = reject;
        });
        const startRes = (await client.request<TurnStartResult>("turn/start", {
          threadId,
          input: [{ type: "text", text: promptText }],
        })) as TurnStartResult;
        activeTurnId = startRes.turn.id;

        const timeoutMs = settings.turnTimeoutMs;
        const completed = await Promise.race([
          turnPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`turn_timeout: ${timeoutMs}ms`)), timeoutMs),
          ),
        ]);

        log.info({
          module: "codex",
          event: "turn_completed",
          message: `turn=${turn} id=${completed.turn.id} status=${completed.turn.status}`,
        });

        if (completed.turn.status === "failed" || completed.turn.status === "interrupted") {
          await client.shutdown();
          if (completed.turn.status === "failed") {
            return {
              turnCount,
              stopReason: "turn_failed",
              error: `turn_failed:${completed.turn.error?.message ?? "unknown"}`,
            };
          }
          return { turnCount, stopReason: "turn_interrupted", error: "turn_cancelled" };
        }

        const decision = await opts.onTurnComplete(turn);
        if (decision === "stop") {
          await client.shutdown();
          return { turnCount, stopReason: "stop_requested" };
        }
      }

      await client.shutdown();
      return { turnCount, stopReason: "max_turns" };
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      log.error({ module: "codex", event: "turn_loop_error", message: msg });
      await client.shutdown();
      if (msg.startsWith("turn_timeout")) {
        return { turnCount, stopReason: "turn_timeout", error: "turn_timeout" };
      }
      return { turnCount, stopReason: "error", error: msg };
    }
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
      return null;
    default:
      return null;
  }
}
