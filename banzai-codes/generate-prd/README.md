## [Banzai generate PRD](action.yml)

Generates — or incrementally updates — a Product Requirements Document for the
checked-out application and opens a pull request with the result. The PRD is a folder of
markdown files (default `docs/prd/`): an `index.md` product overview plus one file per
feature area, written for LLM readability. Banzai Codes uses it to ground the define
flow, so new feature requests are refined against how the application actually works
today.

Codex explores the codebase and writes the documentation; the action then verifies that
nothing outside the PRD folder was touched, commits to a fixed branch (force-pushed, so
re-runs update rather than stack), and creates or updates the pull request.

When the PRD folder already exists, the prompt switches to incremental mode: existing
files are read first, structure and file names are preserved, and only statements the
codebase contradicts (or gaps it reveals) are changed. The PRD deliberately contains no
file paths or code snippets — behavior, not implementation — so it stays valid across
refactors.

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `github-token` | Token with Contents read/write and Pull requests read/write on the repository. | Yes | — |
| `openai-api-key` | OpenAI API key used by Codex. | Yes | — |
| `output-directory` | PRD folder, relative to the repository root. | No | `docs/prd` |
| `base-branch` | Base branch for the pull request. | No | currently checked-out branch |
| `branch-name` | Working branch the PRD is pushed to (fixed name = idempotent re-runs). | No | `banzai/prd-update` |
| `codex-model` | Model used by Codex. | No | `gpt-5.4` |
| `codex-effort` | Reasoning effort used by Codex. | No | — |
| `codex-sandbox` | Sandbox mode for Codex. | No | `workspace-write` |
| `codex-safety-strategy` | Safety strategy passed to codex-action. | No | `unsafe` |
| `extra-instructions` | Additional instructions appended to the PRD prompt. | No | — |
| `pr-title` | Title for the PRD pull request. | No | `Update product requirements documentation` |

### Outputs

| Name | Description |
|------|-------------|
| `changed` | Whether the PRD changed in this run. |
| `pr-url` | URL of the created or updated pull request (empty when unchanged). |
| `pr-number` | Number of the created or updated pull request (empty when unchanged). |

### Usage

```yml
name: Generate PRD
on:
  workflow_dispatch:
    inputs:
      extra-instructions:
        description: Optional focus areas for this PRD pass.
        required: false

jobs:
  prd:
    runs-on: framna-dk-macos-default
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: framna-dk/actions/banzai-codes/generate-prd@main
        with:
          github-token: ${{ github.token }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          extra-instructions: ${{ inputs.extra-instructions }}
```

### Notes

- The repository **must be checked out** before this action runs; it fails fast otherwise.
- The branch push uses the credentials persisted by `actions/checkout`; the
  `github-token` input is only used for the pull-request API calls. If your organization
  blocks `github.token` from creating pull requests, mint a GitHub App token with
  Contents + Pull requests write and pass it to both `actions/checkout` and this action.
- If Codex modifies anything outside `output-directory`, the run fails before committing
  (scope guard), so a bad generation can never reach the repository.
