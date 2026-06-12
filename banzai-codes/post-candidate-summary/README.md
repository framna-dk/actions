## [Banzai post candidate summary](action.yml)

Scans the harness (Development) GitHub Projects v2 board for work orders that reached the
review status (default `Human Review`) and have not yet been summarized, picks the
**oldest one**, and:

1. Gathers the issue's requirements and conversation, the linked pull request (resolved
   via the PR's closing reference, with a cross-reference fallback) and its conversation,
   and every image they contain.
2. Asks Codex for a Product-Manager-facing, **non-technical** summary of how the task was
   completed, embedding the images as proof of work.
3. Posts the summary as a comment on the issue. Banzai Codes ingests the most recent
   comment without one of its own chat markers as the candidate summary; stray HTML
   comments from the model are stripped, and the idempotency marker (default
   `<!-- banzai:summary:done -->`) is embedded **inside the summary comment** — a
   separate marker comment posted afterwards would shadow the summary.
4. Opens the acceptance gate: moves the work order's **Product-board** status to
   `Acceptance` (when `work-order-project-number` is set), so the Banzai Codes review
   gate surfaces a summary that is guaranteed to exist.

One issue, two boards: the work order sits on the Product board (user-facing lifecycle)
and the harness board (build pipeline) at the same time. This action reads the harness
board and writes the Product board.

One item is processed per invocation — a composite action cannot loop an LLM step — so
run it on a cron schedule and let the ticks drain the queue (see
[the folder README](../README.md)). The `remaining-count` output reports the backlog.
No repository checkout is required.

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | App installation token with org Projects read/write and Issues read/write on the work-order repository. | Yes | — |
| `openai-api-key` | OpenAI API key used by Codex to generate the summary. | Yes | — |
| `harness-project-owner` | Organization login that owns the harness (Development) project. | Yes | — |
| `harness-project-number` | Harness project number from the project URL. | Yes | — |
| `work-order-project-owner` | Organization login that owns the work-order (Product) project. | No | `harness-project-owner` |
| `work-order-project-number` | Work-order project number. When set, the Product-board status is moved to `acceptance-status` after posting; when empty, no status is changed. | No | — |
| `acceptance-status` | Status option set on the Product board after the summary is posted. | No | `Acceptance` |
| `repository` | Repository (`owner/repo`) whose issues on the harness board are eligible. | No | `${{ github.repository }}` |
| `trigger-status` | Status option on the harness board that makes an item eligible. | No | `Human Review` |
| `status-field-name` | Name of the single-select status field on both boards. | No | `Status` |
| `summary-marker` | Marker embedded in the summary comment, making the scan idempotent. | No | `<!-- banzai:summary:done -->` |
| `codex-model` | Model used by Codex. | No | `gpt-5.4` |
| `codex-effort` | Reasoning effort used by Codex. | No | — |
| `codex-sandbox` | Sandbox mode for Codex (summary generation needs no write access). | No | `read-only` |
| `codex-safety-strategy` | Safety strategy passed to codex-action. | No | `unsafe` |
| `extra-instructions` | Additional instructions appended to the summary prompt. | No | — |

### Outputs

| Name | Description |
|------|-------------|
| `processed` | `true` if an eligible item was summarized by this run. |
| `issue-url` | URL of the work-order issue handled by this run. |
| `summary-comment-url` | URL of the summary comment posted on the issue. |
| `remaining-count` | Number of eligible items still queued after this run. |

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

- uses: framna-dk/actions/banzai-codes/post-candidate-summary@main
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    harness-project-owner: framna-dk
    harness-project-number: 23
    work-order-project-number: 42
```

### Notes and troubleshooting

- **A failing item fails the run** and, because the scan always picks the oldest item,
  stalls the queue visibly. To skip a poisoned item, post a comment containing the
  `summary-marker` on the issue manually (or fix what made it fail) and let the next tick
  continue.
- The acceptance flip is what keeps the build agent's intermediate comments from being
  surfaced prematurely: Banzai Codes only shows the candidate at the review gate, and the
  gate only opens (Product status → `Acceptance`) after the summary comment exists.
- The build conversation happens on the same issue, so the gathered context includes the
  refinement chat and agent comments — useful input for the summary.
- Images are embedded as their original GitHub attachment URLs. On private repositories
  these render for anyone with repository access when viewed on GitHub; they may not
  render if the markdown is proxied elsewhere.
