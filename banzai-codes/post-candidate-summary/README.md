## [Banzai post candidate summary](action.yml)

Scans a harness GitHub Projects v2 board for issues that reached the review status
(default `Human Review`) and have not yet been summarized, picks the **oldest one**, and:

1. Gathers the issue's requirements and conversation, the linked pull request (resolved
   via the PR's closing reference, with a cross-reference fallback) and its conversation,
   and every image they contain.
2. Asks Codex for a Product-Manager-facing, **non-technical** summary of how the task was
   completed, embedding the images as proof of work.
3. Posts the summary as an **unmarked** comment on the **parent work-order issue** —
   Banzai Codes ingests the latest unmarked comment as the candidate summary, so the
   comment is defensively stripped of any HTML comments before posting.
4. Posts a marker comment (default `<!-- banzai:summary:done -->`) on the harness issue,
   which is what makes the scan idempotent.

One item is processed per invocation — a composite action cannot loop an LLM step — so
run it on a cron schedule and let the ticks drain the queue (see
[the folder README](../README.md)). The `remaining-count` output reports the backlog.
No repository checkout is required.

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | App installation token with org Projects read and Issues read/write on the harness and work-order repositories. | Yes | — |
| `openai-api-key` | OpenAI API key used by Codex to generate the summary. | Yes | — |
| `harness-project-owner` | Organization login that owns the harness project. | Yes | — |
| `harness-project-number` | Harness project number from the project URL. | Yes | — |
| `repository` | Repository (`owner/repo`) whose issues on the harness board are eligible. | No | `${{ github.repository }}` |
| `trigger-status` | Status option on the harness board that makes an item eligible. | No | `Human Review` |
| `status-field-name` | Name of the single-select status field on the harness board. | No | `Status` |
| `summary-marker` | Marker comment posted on the harness issue once its summary has been delivered. | No | `<!-- banzai:summary:done -->` |
| `codex-model` | Model used by Codex. | No | `gpt-5.4` |
| `codex-effort` | Reasoning effort used by Codex. | No | — |
| `codex-sandbox` | Sandbox mode for Codex (summary generation needs no write access). | No | `read-only` |
| `codex-safety-strategy` | Safety strategy passed to codex-action. | No | `unsafe` |
| `extra-instructions` | Additional instructions appended to the summary prompt. | No | — |

### Outputs

| Name | Description |
|------|-------------|
| `processed` | `true` if an eligible item was summarized by this run. |
| `harness-issue-url` | URL of the harness issue handled by this run. |
| `work-order-issue-url` | URL of the parent work-order issue that received the summary. |
| `summary-comment-url` | URL of the summary comment posted on the work-order issue. |
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
    repositories: my-app,banzai-work-orders

- uses: framna-dk/actions/banzai-codes/post-candidate-summary@main
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    harness-project-owner: framna-dk
    harness-project-number: 23
```

### Notes and troubleshooting

- **A failing item fails the run** and, because the scan always picks the oldest item,
  stalls the queue visibly. To skip a poisoned item, post the `summary-marker` comment on
  the harness issue manually (or fix what made it fail) and let the next tick continue.
- Items in the trigger status **without a parent work order** are warned about and passed
  over; they don't block the queue.
- If the run dies between posting the summary and posting the marker, the next run posts
  the summary again. Banzai Codes reads the *latest* unmarked comment, so the duplicate
  is benign.
- Images are embedded as their original GitHub attachment URLs. On private repositories
  these render for anyone with repository access when viewed on GitHub; they may not
  render if the markdown is proxied elsewhere.
