import { spawnSync } from "node:child_process";
import { log, setLogLevel } from "./logging.js";

interface Inputs {
  issue_id?: string;
  issue_identifier?: string;
  attempt?: string;
  tracker_kind?: string;
  tracker_project_id?: string;
  prompt_path?: string;
  log_level?: string;
}

const REQUIRED_INPUTS: Array<keyof Inputs> = [
  "issue_id",
  "issue_identifier",
  "attempt",
  "tracker_kind",
  "tracker_project_id",
  "prompt_path",
];

const REQUIRED_BINS = ["node", "codex", "gh", "git", "jq", "bash"];

function probe(bin: string): boolean {
  const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
  if (r.status === 0) return true;
  // Some binaries (bash) need -c true
  const r2 = spawnSync(bin, ["-c", "true"], { stdio: "ignore" });
  return r2.status === 0;
}

function main(): number {
  const inputsRaw = process.env.HARNESS_INPUTS_JSON ?? "{}";
  let inputs: Inputs;
  try {
    inputs = JSON.parse(inputsRaw) as Inputs;
  } catch (e) {
    log.error({ module: "preflight", event: "bad_inputs_json", message: String((e as Error).message) });
    return 1;
  }

  setLogLevel(inputs.log_level ?? "info");

  const missingInputs = REQUIRED_INPUTS.filter((k) => !inputs[k]);
  if (missingInputs.length > 0) {
    log.error({
      module: "preflight",
      event: "missing_inputs",
      message: missingInputs.join(", "),
    });
    return 1;
  }

  if (inputs.tracker_kind !== "github_projects_v2") {
    log.error({
      module: "preflight",
      event: "unsupported_tracker_kind",
      message: String(inputs.tracker_kind),
    });
    return 1;
  }

  const missingBins = REQUIRED_BINS.filter((b) => !probe(b));
  if (missingBins.length > 0) {
    log.error({
      module: "preflight",
      event: "missing_binaries",
      message: missingBins.join(", "),
    });
    return 1;
  }

  if (!process.env.GH_TOKEN) {
    log.error({ module: "preflight", event: "missing_credentials", message: "GH_TOKEN env unset" });
    return 1;
  }

  log.info({
    module: "preflight",
    event: "ok",
    issue_id: inputs.issue_id,
    issue_identifier: inputs.issue_identifier,
    message: `attempt=${inputs.attempt} project=${inputs.tracker_project_id}`,
  });
  return 0;
}

process.exit(main());
