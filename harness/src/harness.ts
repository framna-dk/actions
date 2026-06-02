import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { log, registerSecret, setLogLevel } from "./logging.js";
import { prepareWorkspace, createWorkBranch } from "./workspace.js";
import { loadConfig } from "./config.js";
import { createTracker } from "./tracker/index.js";
import { createForge } from "./forge/index.js";
import { createAgentRuntime, type AgentRunResult, type ToolDefinition } from "./agent/index.js";
import { makeSetIssueStatusTool } from "./tools/set_issue_status.js";
import { makeOpenPullRequestTool } from "./tools/open_pull_request.js";
import { makeCommentTool } from "./tools/comment.js";
import { renderPrompt, renderContinuation } from "./prompt.js";

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

// Map an agent run result into the harness outcome. Reaching a non-active state
// (or running out of turns) is success; a turn failing/timing out is failure.
function toOutcome(
  result: AgentRunResult,
  stoppedInactive: boolean,
  state: string,
): { outcome: "success" | "failure"; reason: string | null } {
  switch (result.stopReason) {
    case "stop_requested":
      return stoppedInactive
        ? { outcome: "success", reason: null }
        : { outcome: "success", reason: `stopped_with_state:${state}` };
    case "max_turns":
      return { outcome: "success", reason: "max_turns_reached_with_active_state" };
    case "turn_timeout":
      return { outcome: "failure", reason: "turn_timeout" };
    default:
      return { outcome: "failure", reason: result.error ?? result.stopReason };
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

    const tracker = createTracker(inputs.tracker_kind, {
      token,
      owner: inputs.project_owner,
      projectNumber,
      projectNodeId: inputs.project_node_id,
      issueNumber,
      repoSlug,
    });
    const baseBranch = inputs.base_branch || "main";

    const prep = await prepareWorkspace({
      workspaceRoot,
      workspaceKey: inputs.issue_number,
      repoSlug,
      baseBranch,
    });
    log.info({
      module: "harness",
      event: "workspace_ready",
      message: `${prep.workspacePath} (createdNow=${prep.createdNow})`,
    });

    const cfg = await loadConfig(prep.workspacePath);

    let snapshot = await tracker.fetchSnapshot();

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
      const inProgress = snapshot.availableStates.find((s) => s.toLowerCase() === "in progress");
      if (inProgress) {
        try {
          await tracker.setStatus(inProgress);
          log.info({
            module: "harness",
            event: "state_transition",
            issue_id: snapshot.issue.id,
            issue_identifier: snapshot.issue.identifier,
            message: "Todo → In Progress",
          });
          snapshot = await tracker.fetchSnapshot();
        } catch (e) {
          log.warn({
            module: "harness",
            event: "state_transition_failed",
            message: String((e as Error).message),
          });
        }
      }
    }

    // Run the agent. The runtime is tracker-agnostic: we supply per-turn prompts
    // and decide when to stop (when the issue leaves the active states).
    const runtime = createAgentRuntime(cfg.agent.runtime);
    const attempt = parseInt(inputs.attempt, 10) || 0;
    const activeLower = cfg.tracker.active_states.map((s) => s.toLowerCase());
    let stoppedInactive = false;

    const forge = createForge("github", { token, repoSlug, workspacePath: prep.workspacePath });

    const tools: ToolDefinition[] = [];
    if (cfg.agent.tools.set_issue_status) {
      tools.push(
        makeSetIssueStatusTool({
          tracker,
          snapshot: () => snapshot,
          refreshAfter: async () => {
            snapshot = await tracker.fetchSnapshot();
          },
        }),
      );
    }
    if (cfg.agent.tools.open_pull_request) {
      tools.push(makeOpenPullRequestTool({ forge, branch, base: baseBranch }));
    }
    if (cfg.agent.tools.comment) {
      tools.push(makeCommentTool({ forge, issueNumber }));
    }

    const runResult = await runtime.run({
      workspacePath: prep.workspacePath,
      settings: {
        command: cfg.agent.codex.command,
        approvalPolicy: cfg.agent.codex.approval_policy,
        sandbox: cfg.agent.codex.sandbox,
        turnTimeoutMs: cfg.agent.codex.turn_timeout_ms,
      },
      tools,
      maxTurns: cfg.agent.max_turns,
      prompt: (turn) =>
        turn === 1
          ? renderPrompt(prep.workspacePath, inputs.prompt_path, { issue: snapshot.issue, attempt, turn })
          : renderContinuation(turn, cfg.agent.max_turns),
      onTurnComplete: async () => {
        // The agent may have moved the issue via set_issue_status (which refreshes
        // `snapshot`) or via raw gh; re-fetch to be sure, then stop once it leaves
        // the active states.
        snapshot = await tracker.fetchSnapshot();
        if (!activeLower.includes(snapshot.issue.state.toLowerCase())) {
          stoppedInactive = true;
          return "stop";
        }
        return "continue";
      },
    });

    const outcome = toOutcome(runResult, stoppedInactive, snapshot.issue.state);
    await writeOutcome({
      outcome: outcome.outcome,
      reason: outcome.reason,
      tracker_state_at_exit: snapshot.issue.state,
      turn_count: runResult.turnCount,
      ended_at_ms: Date.now(),
    });

    log.info({
      module: "harness",
      event: "exit",
      issue_id: snapshot.issue.id,
      issue_identifier: snapshot.issue.identifier,
      message: `${outcome.outcome} reason=${outcome.reason} state=${snapshot.issue.state} turns=${runResult.turnCount}`,
    });
    return outcome.outcome === "success" ? 0 : 1;
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
