import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "./logging.js";

export interface HarnessConfig {
  tracker: {
    kind: "github_projects_v2";
    active_states: string[];
    terminal_states: string[];
  };
  agent: {
    runtime: string; // which AgentRuntime to use (e.g. "codex")
    max_turns: number;
    codex: {
      command: string;
      approval_policy: string | null;
      sandbox: "read-only" | "workspace-write" | "danger-full-access";
      turn_timeout_ms: number;
    };
    tools: {
      set_issue_status: boolean;
    };
  };
}

const DEFAULTS = {
  active_states: ["Todo", "In Progress"],
  terminal_states: ["Done", "Cancelled", "Canceled", "Duplicate", "Closed"],
  runtime: "codex",
  max_turns: 20,
  codex_command: "codex app-server",
  approval_policy: "never",
  sandbox: "danger-full-access" as const,
  turn_timeout_ms: 3_600_000,
};

const SANDBOX_OPTIONS = new Set(["read-only", "workspace-write", "danger-full-access"]);

function asStrArr(v: unknown, fallback: string[]): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return fallback;
}

function asInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v | 0;
  return fallback;
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function loadConfig(workspacePath: string): Promise<HarnessConfig> {
  const cfgPath = join(workspacePath, ".banzai", "config.json");
  let raw: string | null = null;
  try {
    raw = await readFile(cfgPath, "utf8");
  } catch (e) {
    // A missing config file is fine: the built-in defaults plus the action
    // inputs (project identity, prompt) are sufficient to run. Only a genuine
    // read error (permissions, etc.) is fatal.
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`config_unreadable: ${cfgPath}: ${(e as Error).message}`);
    }
    log.info({
      module: "config",
      event: "config_missing",
      message: `${cfgPath} not found; using defaults`,
    });
  }
  let parsed: unknown = {};
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`config_invalid_json: ${(e as Error).message}`);
    }
  }
  const root = isRecord(parsed) ? parsed : {};
  const trackerRaw = isRecord(root.tracker) ? root.tracker : {};
  const agentRaw = isRecord(root.agent) ? root.agent : {};
  const codexRaw = isRecord(agentRaw.codex) ? agentRaw.codex : {};
  const toolsRaw = isRecord(agentRaw.tools) ? agentRaw.tools : {};

  const cfg: HarnessConfig = {
    tracker: {
      kind: "github_projects_v2",
      active_states: asStrArr(trackerRaw.active_states, DEFAULTS.active_states),
      terminal_states: asStrArr(trackerRaw.terminal_states, DEFAULTS.terminal_states),
    },
    agent: {
      runtime: asStr(agentRaw.runtime, DEFAULTS.runtime),
      max_turns: Math.max(1, asInt(agentRaw.max_turns, DEFAULTS.max_turns)),
      codex: {
        command: asStr(codexRaw.command, DEFAULTS.codex_command),
        approval_policy: asStr(codexRaw.approval_policy, DEFAULTS.approval_policy),
        sandbox: (() => {
          const raw = asStr(codexRaw.sandbox, DEFAULTS.sandbox);
          return (SANDBOX_OPTIONS.has(raw) ? raw : DEFAULTS.sandbox) as HarnessConfig["agent"]["codex"]["sandbox"];
        })(),
        turn_timeout_ms: asInt(codexRaw.turn_timeout_ms, DEFAULTS.turn_timeout_ms),
      },
      tools: {
        set_issue_status: asBool(toolsRaw.set_issue_status, true),
      },
    },
  };

  if (asStr(trackerRaw.kind, "github_projects_v2") !== "github_projects_v2") {
    throw new Error(`config_invalid: unsupported tracker.kind ${trackerRaw.kind}`);
  }
  return cfg;
}
