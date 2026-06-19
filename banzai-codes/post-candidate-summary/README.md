## [Banzai post candidate summary](action.yml)

Summarizes a **closed issue** for a Product Manager and posts the summary as a comment on
the issue. Drive it from a workflow that triggers on `issues: closed`, passing the closed
issue's number.

For the given issue it:

1. Gathers the issue's requirements and conversation, the linked pull request (resolved
   via the PR's closing reference, with a cross-reference fallback) and its conversation,
   and every image they contain.
2. Asks Codex for a Product-Manager-facing, **non-technical** summary of how the task was
   completed, embedding the images as proof of work.
3. Posts the summary as a comment on the issue. Stray HTML comments from the model are
   stripped, and the idempotency marker (default `<!-- banzai:summary:done -->`) is
   embedded **inside the summary comment**.

The marker makes the action idempotent: if a summary comment is already present (for
example after a reopen→close cycle), the action skips and posts nothing. No repository
checkout is required, and the action reads and writes nothing outside the issue — no
project boards are touched.

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | App installation token with Issues read/write on the repository. | Yes | — |
| `openai-api-key` | OpenAI API key used by Codex to generate the summary. | Yes | — |
| `issue-number` | Number of the closed issue to summarize. | Yes | — |
| `repository` | Repository (`owner/repo`) that owns the issue. | No | `${{ github.repository }}` |
| `summary-marker` | Marker embedded in the summary comment, making the post idempotent across repeated closes. | No | `<!-- banzai:summary:done -->` |
| `codex-model` | Model used by Codex. | No | `gpt-5.4` |
| `codex-effort` | Reasoning effort used by Codex. | No | — |
| `codex-sandbox` | Sandbox mode for Codex (summary generation needs no write access). | No | `read-only` |
| `codex-safety-strategy` | Safety strategy passed to codex-action. | No | `unsafe` |
| `extra-instructions` | Additional instructions appended to the summary prompt. | No | — |

### Outputs

| Name | Description |
|------|-------------|
| `processed` | `true` if the issue was summarized by this run. |
| `issue-url` | URL of the issue handled by this run. |
| `summary-comment-url` | URL of the summary comment posted on the issue. |

### Usage

```yml
on:
  issues:
    types: [closed]

jobs:
  summary:
    runs-on: ubuntu-latest
    if: github.event.issue.state_reason == 'completed'
    steps:
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
          issue-number: ${{ github.event.issue.number }}
```

### Notes and troubleshooting

- The action runs once per close. Gate the workflow on
  `github.event.issue.state_reason == 'completed'` so `not planned` closures (wontfix,
  duplicate) don't get a summary.
- The build conversation happens on the same issue, so the gathered context includes the
  refinement chat and agent comments — useful input for the summary.
- Images are embedded as their original GitHub attachment URLs. On private repositories
  these render for anyone with repository access when viewed on GitHub; they may not
  render if the markdown is proxied elsewhere.
