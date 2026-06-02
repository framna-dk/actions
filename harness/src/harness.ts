import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { log, registerSecret, setLogLevel } from "./logging.js";
import { prepareWorkspace } from "./workspace.js";
import { loadConfig } from "./config.js";
import { fetchIssueSnapshot, setProjectItemStatus } from "./issue.js";
import { runTurns } from "./codex/turn_loop.js";

interface Inputs {
  issue_id: string;
  issue_identifier: string;
  attempt: string;
  tracker_kind: string;
  tracker_endpoint: string;
  tracker_project_id: string;
  config_sha: string;
  dispatch_nonce: string;
  workspace_root: string;
  repo_url: string;
  repo_ref: string;
  log_level: string;
}

function expand(p: string): string {
  return p.replace(/^\$HOME/, homedir()).replace(/^~/, homedir());
}

function repoSlugFromEnv(): string {
  const slug = process.env.GITHUB_REPOSITORY ?? "";
  if (!slug.includes("/")) throw new Error(`unknown_repo: GITHUB_REPOSITORY=${slug}`);
  return slug;
}

async function writeOutcome(outcome: object): Promise<void> {
  const tmp = process.env.RUNNER_TEMP ?? "/tmp";
  const path = join(tmp, "harness-outcome.json");
  try {
    await writeFile(path, JSON.stringify(outcome, null, 2));
    log.info({ module: "harness", event: "outcome_written", message: path });
  } catch (e) {
    log.warn({ module: "harness", event: "outcome_write_failed", message: String((e as Error).message) });
  }
}

async function main(): Promise<number> {
  const inputs = JSON.parse(process.env.HARNESS_INPUTS_JSON ?? "{}") as Inputs;
  setLogLevel(inputs.log_level || "info");

  const token = process.env.GH_TOKEN;
  if (!token) {
    log.error({ module: "harness", event: "missing_credentials", message: "GH_TOKEN unset" });
    await writeOutcome({ outcome: "failure", reason: "missing_credentials" });
    return 1;
  }
  registerSecret(token);
  registerSecret(process.env.OPENAI_API_KEY);

  log.info({
    module: "harness",
    event: "start",
    issue_id: inputs.issue_id,
    issue_identifier: inputs.issue_identifier,
    message: `attempt=${inputs.attempt} nonce=${inputs.dispatch_nonce} config_sha=${inputs.config_sha}`,
  });

  const repoSlug = inputs.repo_url || repoSlugFromEnv();
  const workspaceRoot = expand(inputs.workspace_root || "$HOME/banzai-workspaces");

  try {
    const prep = await prepareWorkspace({
      workspaceRoot,
      issueIdentifier: inputs.issue_identifier,
      repoSlug,
      repoRef: inputs.repo_ref || "main",
    });
    log.info({
      module: "harness",
      event: "workspace_ready",
      message: `${prep.workspacePath} (createdNow=${prep.createdNow}) branch=${prep.branch}`,
    });

    const cfg = await loadConfig(prep.workspacePath);
    // Allow env-supplied project id to override the file when present.
    if (inputs.tracker_project_id) cfg.tracker.project_id = inputs.tracker_project_id;
    if (inputs.tracker_endpoint) cfg.tracker.endpoint = inputs.tracker_endpoint;

    let snapshot = await fetchIssueSnapshot({
      endpoint: cfg.tracker.endpoint,
      token,
      issueId: inputs.issue_id,
      projectId: cfg.tracker.project_id,
    });

    // Move the issue from Todo to In Progress so the project board reflects
    // "the runner is actively working on me". The agent later transitions to
    // a non-active state (typically Human Review) when done.
    if (snapshot.issue.state.toLowerCase() === "todo") {
      const inProgress = snapshot.projectStatus.statusOptions.find(
        (o) => o.name.toLowerCase() === "in progress",
      );
      if (inProgress) {
        try {
          await setProjectItemStatus({
            endpoint: cfg.tracker.endpoint,
            token,
            projectId: cfg.tracker.project_id,
            itemId: snapshot.projectStatus.projectItemId,
            fieldId: snapshot.projectStatus.statusFieldId,
            optionId: inProgress.id,
          });
          log.info({
            module: "harness",
            event: "state_transition",
            issue_id: snapshot.issue.id,
            issue_identifier: snapshot.issue.identifier,
            message: "Todo → In Progress",
          });
          snapshot = await fetchIssueSnapshot({
            endpoint: cfg.tracker.endpoint,
            token,
            issueId: inputs.issue_id,
            projectId: cfg.tracker.project_id,
          });
        } catch (e) {
          log.warn({
            module: "harness",
            event: "state_transition_failed",
            message: String((e as Error).message),
          });
        }
      }
    }

    const result = await runTurns({
      workspacePath: prep.workspacePath,
      cfg,
      token,
      attempt: parseInt(inputs.attempt, 10) || 0,
      initialSnapshot: snapshot,
    });

    await writeOutcome({
      outcome: result.outcome,
      reason: result.reason,
      tracker_state_at_exit: result.tracker_state_at_exit,
      turn_count: result.turn_count,
      ended_at_ms: Date.now(),
    });

    log.info({
      module: "harness",
      event: "exit",
      issue_id: inputs.issue_id,
      issue_identifier: inputs.issue_identifier,
      message: `${result.outcome} reason=${result.reason} state=${result.tracker_state_at_exit} turns=${result.turn_count}`,
    });
    return result.outcome === "success" ? 0 : 1;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    log.error({ module: "harness", event: "fatal", message: msg });
    await writeOutcome({
      outcome: "failure",
      reason: msg,
      ended_at_ms: Date.now(),
    });
    return 1;
  }
}

main().then((code) => process.exit(code));
