## [harness](https://github.com/framna-dk/actions/blob/main/harness/action.yml)

Runs a Codex agent against a single tracker issue inside a GitHub Actions job. Dispatched by [banzai-codes-worker](https://github.com/framna-dk/banzai-codes-worker), which polls a GitHub Projects v2 board and triggers one run per actionable issue. The action prepares a per-issue workspace, runs the agent, and updates the issue's board status.

This action is a thin composite: it shells out to the **`banzai-harness` CLI**, whose implementation lives in [banzai-codes-actions-harness](https://github.com/framna-dk/banzai-codes-actions-harness). The CLI must be installed on the runner (see prerequisites below).

The action has the following inputs:

| Name               | Description                                                                 | Required | Default                          |
| ------------------ | --------------------------------------------------------------------------- | -------- | -------------------------------- |
| github_project_board | Projects v2 board as its URL-path key, e.g. `orgs/framna-dk/projects/23` (org or user). The `PVT_…` node ID for writes is resolved from this. | `true`   | None                             |
| issue_number       | Issue number within its repo (e.g. `12`).                                    | `true`   | None                             |
| attempt            | Dispatch attempt counter from the orchestrator (`0` for the first run).      | `true`   | None                             |
| prompt_path        | Optional override for the prompt template (relative to the workspace repo, or absolute). When omitted, the harness uses its embedded canonical workflow template. An override is validated against the `banzai-workflow` version marker and fails fast if stale. | `false`  | `""` (embedded canonical workflow) |
| workspace_root     | Directory under which per-issue workspaces are created.                      | `false`  | `$HOME/banzai-workspaces`        |
| repo_url           | The issue's `owner/repo` (defaults to the current repo). Used to clone and to match the board item. | `false`  | `""`                             |
| base_branch        | Branch the workspace resets from on each run; the agent's working branch is cut from it. | `false`  | `main`                           |
| log_level          | `info` \| `warn` \| `error`.                                                 | `false`  | `info`                           |

The action talks to GitHub Projects entirely through the `gh` CLI (`gh project field-list`/`item-list`/`item-edit`), authenticating with the `GH_TOKEN` environment variable (a GitHub App installation token with org-level Projects v2 access; the token needs the `project` scope). Self-hosted runner prerequisites: `banzai-harness` (from [banzai-codes-actions-harness](https://github.com/framna-dk/banzai-codes-actions-harness)), `codex`, `gh`, `node`, `git`, `jq`, and an authenticated Codex CLI.

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
    github_project_board: orgs/framna-dk/projects/23
    issue_number: ${{ inputs.issue_number }}
    attempt: ${{ inputs.attempt }}
    repo_url: ${{ inputs.repo_url }}
    # prompt_path is optional — omit it to use the harness's embedded canonical
    # workflow, or set it to override with a custom template.
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}
```

Referencing the action by repo (`framna-dk/actions/harness@<ref>`) means the
consuming workflow no longer needs an `actions/checkout` step to make a local
`./` path resolve — GitHub fetches the action automatically.
