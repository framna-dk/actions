import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { log } from "../../logging.js";
import type { DynamicToolSpec, ToolCallParams, ToolCallResult, ToolHandler } from "../types.js";

export type { DynamicToolSpec, ToolCallParams, ToolCallResult, ToolHandler };

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc?: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc?: "2.0";
  method: string;
  params?: unknown;
}

type IncomingMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export type NotificationHandler = (method: string, params: unknown) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Bidirectional JSON-RPC client over a child process's stdio. Handles:
 *   - outgoing client requests with id-based correlation
 *   - incoming server notifications (delegated to a handler)
 *   - incoming server requests (item/tool/call) routed to tool handlers
 */
export class CodexAppServerClient {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number | string, PendingRequest>();
  private toolHandlers = new Map<string, ToolHandler>();
  private notificationHandler: NotificationHandler = () => {};
  private buf = "";
  private exited = false;
  private exitCode: number | null = null;
  private exitPromise: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;

  constructor(command: string) {
    log.info({ module: "codex", event: "spawn", message: command });
    const [cmd, ...args] = parseShellWords(command);
    if (!cmd) throw new Error(`codex_startup_failed: empty command`);
    this.proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

    this.exitPromise = new Promise((resolveExit) => {
      this.proc.on("exit", (code, signal) => {
        this.exited = true;
        this.exitCode = code;
        log.info({ module: "codex", event: "exited", message: `code=${code} signal=${signal}` });
        for (const p of this.pending.values()) {
          p.reject(new Error(`codex process exited (code=${code})`));
        }
        this.pending.clear();
        resolveExit({ code, signal });
      });
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk: string) => {
      const trimmed = chunk.trim();
      if (trimmed) log.warn({ module: "codex", event: "stderr", message: trimmed.slice(0, 1000) });
    });
  }

  onNotification(handler: NotificationHandler): void {
    this.notificationHandler = handler;
  }

  registerTool(name: string, handler: ToolHandler): void {
    this.toolHandlers.set(name, handler);
  }

  private onStdout(chunk: string): void {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (line === "") continue;
      let msg: IncomingMessage;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        log.warn({ module: "codex", event: "bad_json", message: line.slice(0, 200) });
        continue;
      }
      this.dispatch(msg);
    }
  }

  private dispatch(msg: IncomingMessage): void {
    if ("id" in msg && (("result" in msg) || ("error" in msg))) {
      // Response to one of our client requests
      const resp = msg as JsonRpcResponse;
      const pending = this.pending.get(resp.id);
      if (!pending) {
        log.warn({ module: "codex", event: "orphan_response", message: `id=${resp.id}` });
        return;
      }
      this.pending.delete(resp.id);
      if (resp.error) {
        pending.reject(new Error(`${resp.error.code}: ${resp.error.message}`));
      } else {
        pending.resolve(resp.result);
      }
      return;
    }
    if ("id" in msg && "method" in msg) {
      // Server-to-client request
      this.handleServerRequest(msg as JsonRpcRequest);
      return;
    }
    if ("method" in msg) {
      // Server notification
      const note = msg as JsonRpcNotification;
      this.notificationHandler(note.method, note.params);
      return;
    }
    log.warn({ module: "codex", event: "unknown_message", message: JSON.stringify(msg).slice(0, 200) });
  }

  private async handleServerRequest(req: JsonRpcRequest): Promise<void> {
    if (req.method === "item/tool/call") {
      const params = req.params as ToolCallParams;
      const handler = this.toolHandlers.get(params.tool);
      if (!handler) {
        log.warn({ module: "codex", event: "unsupported_tool_call", message: params.tool });
        this.sendResponse(req.id, {
          success: false,
          contentItems: [{ type: "inputText", text: `Tool '${params.tool}' is not registered.` }],
        });
        return;
      }
      try {
        const result = await handler(params);
        this.sendResponse(req.id, result);
      } catch (e) {
        log.error({
          module: "codex",
          event: "tool_handler_threw",
          message: String((e as Error).message ?? e),
        });
        this.sendResponse(req.id, {
          success: false,
          contentItems: [{ type: "inputText", text: `Tool '${params.tool}' threw: ${(e as Error).message}` }],
        });
      }
      return;
    }
    // Any other server request type — auto-deny / no-op for now.
    log.info({ module: "codex", event: "unhandled_server_request", message: req.method });
    this.sendError(req.id, -32601, `Method '${req.method}' not handled by client.`);
  }

  private sendResponse(id: number | string, result: unknown): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  private sendError(id: number | string, code: number, message: string): void {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.exited) {
      return Promise.reject(new Error("codex process has exited"));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.write({ jsonrpc: "2.0", id, method, params: params ?? {} });
    });
  }

  private write(msg: unknown): void {
    if (this.exited) return;
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  shutdown(): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    if (!this.exited) {
      try {
        this.proc.stdin.end();
      } catch {
        // ignore
      }
    }
    return this.exitPromise;
  }

  isExited(): boolean {
    return this.exited;
  }

  getExitCode(): number | null {
    return this.exitCode;
  }
}

function parseShellWords(s: string): string[] {
  // Minimal shell-style split: handles spaces and single/double quotes.
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c as '"' | "'";
    } else if (c === " " || c === "\t") {
      if (cur !== "") {
        out.push(cur);
        cur = "";
      }
    } else {
      cur += c;
    }
  }
  if (cur !== "") out.push(cur);
  return out;
}
