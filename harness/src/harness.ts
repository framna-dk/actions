import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { log, registerSecret, setLogLevel } from "./logging.js";
import { prepareWorkspace, createWorkBranch } from "./workspace.js";
import { loadConfig } from "./config.js";
import { fetchIssueSnapshot, setProjectItemStatus } from "./issue.js";
import { runTurns } from "./codex/turn_loop.js";

interface Inputs {
  issue_number: string;
  attempt: string;
  tracker_kind: string;
  project_owner: string;
  project_number: string;
  project_node_id: string;
  prompt_path: string;
  workspace_root: string;
  repo_url: string;
  base_branch: string;
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

  const repoSlug = inputs.repo_url || repoSlugFromEnv();
  const issueNumber = parseInt(inputs.issue_number, 10);
  const projectNumber = parseInt(inputs.project_number, 10);

  log.info({
    module: "harness",
    event: "start",
    issue_identifier: `#${inputs.issue_number}`,
    message: `repo=${repoSlug} project=${inputs.project_owner}/${inputs.project_number} attempt=${inputs.attempt}`,
  });

  const workspaceRoot = expand(inputs.workspace_root || "$HOME/banzai-workspaces");

  try {
    if (!inputs.project_owner || !Number.isFinite(projectNumber)) {
      throw new Error("missing_project: project_owner and project_number inputs are required");
    }
    if (!inputs.project_node_id) {
      throw new Error("missing_project_node_id: the project_node_id input is required");
    }
    if (!Number.isFinite(issueNumber)) {
      throw new Error("missing_issue_number: the issue_number input is required");
    }
    if (!inputs.prompt_path) {
      throw new Error("missing_prompt_path: the prompt_path input is required");
    }

    const trackerRef = {
      token,
      owner: inputs.project_owner,
      projectNumber,
      issueNumber,
      repoSlug,
    };

    const prep = await prepareWorkspace({
      workspaceRoot,
      workspaceKey: inputs.issue_number,
      repoSlug,
      baseBranch: inputs.base_branch || "main",
    });
    log.info({
      module: "harness",
      event: "workspace_ready",
      message: `${prep.workspacePath} (createdNow=${prep.createdNow})`,
    });

    const cfg = await loadConfig(prep.workspacePath);

    let snapshot = await fetchIssueSnapshot(trackerRef);

    // Cut the agent's working branch now that we know the issue identifier.
    const branch = await createWorkBranch(prep.workspacePath, snapshot.issue.identifier);
    log.info({
      module: "harness",
      event: "branch_ready",
      issue_id: snapshot.issue.id,
      issue_identifier: snapshot.issue.identifier,
      message: branch,
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
            token,
            projectNodeId: inputs.project_node_id,
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
          snapshot = await fetchIssueSnapshot(trackerRef);
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
      promptPath: inputs.prompt_path,
      cfg,
      token,
      tracker: {
        owner: inputs.project_owner,
        projectNumber,
        projectNodeId: inputs.project_node_id,
        issueNumber,
        repoSlug,
      },
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
      issue_id: snapshot.issue.id,
      issue_identifier: snapshot.issue.identifier,
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
