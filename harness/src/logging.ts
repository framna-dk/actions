type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  module: string;
  event?: string;
  message?: string;
  issue_id?: string;
  issue_identifier?: string;
  [k: string]: unknown;
}

let configuredLevel: Level = "info";
const order: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const secrets = new Set<string>();

export function setLogLevel(level: string): void {
  if (level === "debug" || level === "info" || level === "warn" || level === "error") {
    configuredLevel = level;
  }
}

export function registerSecret(value: string | undefined | null): void {
  if (value && value.length >= 4) secrets.add(value);
}

function redact(s: string): string {
  let out = s;
  for (const v of secrets) {
    out = out.split(v).join("[REDACTED]");
  }
  return out;
}

function emit(level: Level, fields: LogFields): void {
  if (order[level] > order[configuredLevel]) return;
  const payload = { at: new Date().toISOString(), level, ...fields };
  const line = redact(JSON.stringify(payload));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (f: LogFields) => emit("debug", f),
  info: (f: LogFields) => emit("info", f),
  warn: (f: LogFields) => emit("warn", f),
  error: (f: LogFields) => emit("error", f),
};
