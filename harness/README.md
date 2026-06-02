## [harness](https://github.com/framna-dk/actions/blob/main/harness/action.yml)

Runs a Codex agent against a single tracker issue inside a GitHub Actions job. Dispatched by [banzai-codes-worker](https://github.com/framna-dk/banzai-codes-worker), which polls a GitHub Projects v2 board and triggers one run per actionable issue. The action prepares a per-issue workspace, runs the agent, and updates the issue's board status; it is self-contained (compiled output in `dist/`).

The action has the following inputs:

| Name               | Description                                                                 | Required | Default                          |
| ------------------ | --------------------------------------------------------------------------- | -------- | -------------------------------- |
| issue_id           | GitHub issue node ID (e.g. `I_kwDOSk69...`).                                 | `true`   | None                             |
| attempt            | Dispatch attempt counter from the orchestrator (`0` for the first run).      | `true`   | None                             |
| tracker_kind       | Tracker type; always `github_projects_v2` for now.                          | `true`   | None                             |
| tracker_project_id | Projects v2 node ID (e.g. `PVT_kw...`).                                      | `true`   | None                             |
| prompt_path        | Path to the Liquid prompt template (relative to the workspace repo, or absolute). There is no built-in default prompt. | `true`   | None                             |
| workspace_root     | Directory under which per-issue workspaces are created.                      | `false`  | `$HOME/banzai-workspaces`        |
| repo_url           | Override the git URL for the workspace clone (defaults to the current repo). | `false`  | `""`                             |
| base_branch        | Branch the workspace resets from on each run; the agent's working branch is cut from it. | `false`  | `main`                           |
| log_level          | `info` \| `warn` \| `error`.                                                 | `false`  | `info`                           |

The agent authenticates with the `GH_TOKEN` environment variable (a GitHub App installation token with org-level Projects v2 access). Self-hosted runner prerequisites: `codex`, `gh`, `node`, `git`, `jq`, and an authenticated Codex CLI.

### Usage

```yml
- name: Mint App token
  id: app-token
  uses: actions/create-github-app-token@v3
  with:
    app-id: ${{ secrets.BANZAI_APP_ID }}
    private-key: ${{ secrets.BANZAI_APP_PRIVATE_KEY }}
    owner: framna-dk

- name: Run harness
  uses: framna-dk/actions/harness@main
  with:
    issue_id: ${{ inputs.issue_id }}
    attempt: ${{ inputs.attempt }}
    tracker_kind: ${{ inputs.tracker_kind }}
    tracker_project_id: ${{ inputs.tracker_project_id }}
    prompt_path: .banzai/prompt.md
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}
```

Referencing the action by repo (`framna-dk/actions/harness@<ref>`) means the
consuming workflow no longer needs an `actions/checkout` step to make a local
`./` path resolve — GitHub fetches the action automatically.
