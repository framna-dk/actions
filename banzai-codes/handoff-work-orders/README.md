## [Banzai handoff work orders](action.yml)

Scans the work-order (Product) GitHub Projects v2 board and adds every open issue sitting
in the handoff status (default `In Progress`) to the harness (Development) board with an
initial status (default `Todo`), where
[banzai-codes-worker](https://github.com/framna-dk/banzai-codes-worker) picks it up.

One issue, two boards: the work order itself is the unit of work throughout the pipeline.
The Product board tracks the user-facing lifecycle (`Define → In Progress → Acceptance →
Done`) while the Development board tracks the build pipeline — both as Status fields on
the same issue. No duplicate issue is created.

The scan is **idempotent and self-healing**: harness-board membership is the marker, so
re-runs add nothing twice; an issue whose harness status was never set gets it repaired.
An existing harness status is never overwritten — once the orchestrator owns the issue,
this action keeps its hands off.

GitHub Actions cannot trigger on Projects v2 status changes, so run this on a cron
schedule (see [the folder README](../README.md) for the full pipeline workflow).

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | App installation token with org Projects read/write and Issues read on the work-order repository. | Yes | — |
| `work-order-project-owner` | Organization login that owns the work-order (Product) project. | Yes | — |
| `work-order-project-number` | Work-order project number from the project URL. | Yes | — |
| `work-order-status` | Status option on the work-order board that triggers the handoff. | No | `In Progress` |
| `harness-project-owner` | Organization login that owns the harness (Development) project. | Yes | — |
| `harness-project-number` | Harness project number from the project URL. | Yes | — |
| `harness-status` | Initial status option set when an issue is added to the harness board. | No | `Todo` |
| `status-field-name` | Name of the single-select status field on both boards. | No | `Status` |
| `repository` | Optional repository (`owner/repo`) filter; when set, only issues in this repository are handed off. | No | — |
| `max-items` | Maximum number of work orders acted on per scan. | No | `10` |
| `dry-run` | Log intended changes without performing any mutation. | No | `false` |

### Outputs

| Name | Description |
|------|-------------|
| `added-issue-urls` | Newline-separated URLs of issues added to the harness board by this run. |
| `added-count` | Number of issues added to the harness board by this run. |
| `repaired-count` | Number of issues healed (given their missing initial status on the harness board). |
| `errors` | Newline-separated per-work-order error summaries (empty on a clean run). |

### Usage

```yml
- name: Mint App token
  id: app-token
  uses: actions/create-github-app-token@v3
  with:
    app-id: ${{ vars.PROJECTS_APP_ID }}
    private-key: ${{ secrets.PROJECTS_APP_PEM }}
    owner: framna-dk
    repositories: my-app

- uses: framna-dk/actions/banzai-codes/handoff-work-orders@main
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    work-order-project-owner: framna-dk
    work-order-project-number: 42
    harness-project-owner: framna-dk
    harness-project-number: 23
```

### Notes

- Only organization-owned projects are supported (matching the rest of the Banzai tooling).
- A failed work order is reported and skipped; the rest of the scan continues. The run
  still fails at the end so the error is visible in the Actions UI.
- Defaults match the banzai-codes contracts: the Product board's `In Progress` means
  "published; the build pipeline owns it", and `Todo` is a banzai-codes-worker active
  state, so the coding agent is dispatched on the worker's next tick.
