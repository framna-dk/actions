## [Banzai handoff work orders](action.yml)

Scans a work-order GitHub Projects v2 board and, for every open issue sitting in the
handoff status (default `In Progress`) that does not yet have a harness issue, creates one:

1. Creates a new issue in `target-repository` with the work order's title and body
   (plus a trailing `Work order: <url>` provenance line).
2. Links the work-order issue as the **parent** of the new issue via GitHub sub-issues.
3. Adds the new issue to the harness board and sets its initial status (default `Todo`),
   where [banzai-codes-worker](https://github.com/framna-dk/banzai-codes-worker) picks it up.

The scan is **idempotent and self-healing**: the sub-issue relationship is the marker, so
re-runs create nothing new; a sub-issue that fell off the harness board (or never got its
status) is repaired. An existing non-empty status is never overwritten — once the
orchestrator owns the issue, this action keeps its hands off.

GitHub Actions cannot trigger on Projects v2 status changes, so run this on a cron
schedule (see [the folder README](../README.md) for the full pipeline workflow).

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | App installation token with org Projects read/write and Issues read/write on the work-order and target repositories. | Yes | — |
| `work-order-project-owner` | Organization login that owns the work-order project. | Yes | — |
| `work-order-project-number` | Work-order project number from the project URL. | Yes | — |
| `work-order-status` | Status option on the work-order board that triggers the handoff. | No | `In Progress` |
| `target-repository` | Repository (`owner/repo`) in which harness issues are created. | Yes | — |
| `harness-project-owner` | Organization login that owns the harness project. | Yes | — |
| `harness-project-number` | Harness project number from the project URL. | Yes | — |
| `harness-status` | Initial status option set on newly created harness issues. | No | `Todo` |
| `status-field-name` | Name of the single-select status field on both boards. | No | `Status` |
| `max-items` | Maximum number of work orders acted on per scan. | No | `10` |
| `dry-run` | Log intended changes without performing any mutation. | No | `false` |

### Outputs

| Name | Description |
|------|-------------|
| `created-issue-urls` | Newline-separated URLs of harness issues created by this run. |
| `created-count` | Number of harness issues created by this run. |
| `repaired-count` | Number of existing harness issues healed (re-added to the board or given their initial status). |
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
    repositories: my-app,banzai-work-orders

- uses: framna-dk/actions/banzai/handoff-work-orders@main
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    work-order-project-owner: framna-dk
    work-order-project-number: 42
    target-repository: framna-dk/my-app
    harness-project-owner: framna-dk
    harness-project-number: 23
```

### Notes

- Only organization-owned projects are supported (matching the rest of the Banzai tooling).
- A failed work order is reported and skipped; the rest of the scan continues. The run
  still fails at the end so the error is visible in the Actions UI.
- If a run dies between creating the issue and linking it as a sub-issue, the next scan
  creates a duplicate (the window is one API call wide). Every other partial state is
  converged on the next run.
