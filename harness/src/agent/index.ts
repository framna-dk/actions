import type { AgentRuntime } from "./types.js";
import { CodexRuntime } from "./codex/runtime.js";

export type {
  AgentRuntime,
  AgentSessionOptions,
  AgentRunResult,
  ToolDefinition,
  ToolCallParams,
  ToolCallResult,
  DynamicToolSpec,
  ToolHandler,
} from "./types.js";

/**
 * Construct the agent runtime for the given kind. Today only Codex is
 * supported; a new runtime is added by implementing `AgentRuntime` and adding a
 * case here.
 */
export function createAgentRuntime(kind: string): AgentRuntime {
  switch (kind) {
    case "codex":
      return new CodexRuntime();
    default:
      throw new Error(`unsupported_agent_runtime: ${kind}`);
  }
}
