# Banzai review

Reviews one pull request. A thin composite over the
`banzai-harness review` CLI (see
[framna-dk/banzai-codes-harness](https://github.com/framna-dk/banzai-codes-harness)):
it boots the review agent on the PR head, reads the diff, and posts a concise
review — inline comments plus one summary (`COMMENT`/`REQUEST_CHANGES`, never
`APPROVE`). The review is **static** (no file edits, no commits), so it never
re-triggers itself.

This is the sibling of the `harness` action and shares the same self-hosted
runner pool: `banzai-harness`, `gh`, and `git` (plus the runner's configured
review agent) must be on `PATH`.

## Inputs

| Input | Required | Default | Notes |
|-------|----------|---------|-------|
| `pr_number` | yes | — | PR to review, e.g. `42`. |
| `repo_url` | no | current repo | `owner/repo`. |
| `base_branch` | no | `main` | Branch the PR targets. |
| `prompt_path` | no | embedded template | Override review template; validated against the `banzai-review` version marker. |
| `workspace_root` | no | `$HOME/banzai-workspaces` | Per-PR review workspaces. |
| `log_level` | no | `info` | `info` \| `warn` \| `error`. |

`GH_TOKEN` is read from the environment, never passed on the command line:
export it in the calling job. The review agent's own credentials are configured
on the runner, not supplied through this action.

## Usage

```yaml
name: PR review
on:
  pull_request:
    types: [opened, synchronize, reopened]

# One review per PR; a new push cancels the in-flight one.
concurrency:
  group: banzai-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: [self-hosted]
    steps:
      - uses: framna-dk/actions/review@main
        with:
          pr_number: ${{ github.event.pull_request.number }}
          base_branch: ${{ github.event.pull_request.base.ref }}
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

The agent reacts 👀 on the PR when it starts, then posts the review. It writes a
`review-outcome.json` to `${{ runner.temp }}` (`outcome`, `reason`, `pr_number`,
`head_sha`, `turn_count`, `tokens`, `ended_at_ms`).
