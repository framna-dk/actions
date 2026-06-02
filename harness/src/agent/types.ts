/**
 * Agent runtime abstraction. A runtime knows how to drive an agentic coding
 * session inside a workspace: run up to N turns, exposing a set of tools, asking
 * the caller for each turn's prompt and whether to continue after each turn. It
 * knows nothing about trackers or issues — that orchestration lives above it, in
 * the harness. Add a new runtime by implementing `AgentRuntime` and wiring it
 * into `createAgentRuntime`.
 */

export interface DynamicToolSpec {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface ToolCallParams {
  tool: string;
  arguments: unknown;
  callId: string;
  threadId: string;
  turnId: string;
  namespace?: string | null;
}

export interface ToolCallResult {
  success: boolean;
  contentItems: Array<{ type: "inputText"; text: string }>;
}

export type ToolHandler = (params: ToolCallParams) => Promise<ToolCallResult>;

/** A tool the agent may call: its schema plus the handler that services it. */
export interface ToolDefinition {
  spec: DynamicToolSpec;
  handler: ToolHandler;
}

export interface AgentSettings {
  command: string;
  approvalPolicy: string | null;
  sandbox: "read-only" | "workspace-write" | "danger-full-access";
  turnTimeoutMs: number;
}

export type TurnDecision = "continue" | "stop";

export interface AgentSessionOptions {
  workspacePath: string;
  settings: AgentSettings;
  tools: ToolDefinition[];
  maxTurns: number;
  /** Prompt text for the given 1-based turn number. */
  prompt: (turn: number) => string | Promise<string>;
  /** Called after each completed turn; return "stop" to end the session. */
  onTurnComplete: (turn: number) => Promise<TurnDecision>;
}

export type StopReason =
  | "stop_requested" // onTurnComplete returned "stop"
  | "max_turns" // ran all turns without a stop
  | "turn_failed"
  | "turn_interrupted"
  | "turn_timeout"
  | "error";

export interface AgentRunResult {
  turnCount: number;
  stopReason: StopReason;
  /** Set when stopReason indicates a failure. */
  error?: string;
}

export interface AgentRuntime {
  run(opts: AgentSessionOptions): Promise<AgentRunResult>;
}
