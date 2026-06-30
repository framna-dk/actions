## [makeitfly-preview](https://github.com/framna-dk/actions/blob/main/.github/workflows/makeitfly-preview.yml)

A reusable workflow that deploys a live [makeitfly](https://github.com/framna-dk/makeitfly) preview of a repo's Docker Compose stack to Fly.io for every pull request. It refreshes the preview in place on each push, tears it down when the PR closes, and keeps a single sticky comment with the URL up to date.

Unlike the other entries in this repo, this is a **reusable workflow** (`uses:` at the job level), not a composite action (`uses:` at the step level), so it lives under [`.github/workflows/`](../.github/workflows/makeitfly-preview.yml).

### Usage

Add a caller workflow at `.github/workflows/preview.yml` in the consuming repo:

```yaml
name: PR preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

# Serialize per PR so a rapid push + close can't race a deploy against a
# teardown. Don't cancel in-progress runs - a teardown must always finish.
concurrency:
  group: preview-${{ github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  preview:
    uses: shapehq/actions/.github/workflows/makeitfly-preview.yml@v1
    with:
      compose-file: docker-compose.preview.yml
      name-prefix: atl
      health-path: /api/health
    secrets:
      fly-api-token: ${{ secrets.FLY_API_TOKEN }}
      makeitfly-token: ${{ secrets.MAKEITFLY_TOKEN }}
      name-salt: ${{ secrets.PREVIEW_NAME_SALT }}
```

The caller owns the `pull_request` trigger (it must include `closed` to drive teardown) and the per-PR `concurrency` group. Everything else is in the reusable workflow.

### Inputs

| Name                   | Description                                                                                                      | Required | Default               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| compose-file           | Path to the Compose file to deploy.                                                                              | `false`  | `docker-compose.yml`  |
| name-prefix            | Prefix for the preview name, e.g. `atl` gives `atl-pr-<n>-<hash>`. Empty gives `pr-<n>-<hash>`.                  | `false`  | `""`                  |
| makeitfly-repo         | Repo to download the makeitfly release binary from.                                                             | `false`  | `framna-dk/makeitfly` |
| makeitfly-version      | makeitfly release tag (e.g. `v0.3.0`) or `latest`.                                                              | `false`  | `latest`              |
| fly-org                | Fly org new apps are created under. Empty uses makeitfly's default (`personal`).                                | `false`  | `""`                  |
| fly-region             | Fly region to deploy to. Empty uses makeitfly's default (`fra`).                                                | `false`  | `""`                  |
| health-path            | If set, gate the URL on this path returning HTTP 200 before advertising it, e.g. `/api/health`. Empty skips it. | `false`  | `""`                  |
| health-timeout-seconds | How long to wait for the health path before failing the deploy.                                                 | `false`  | `300`                 |
| runs-on                | Runner label for both jobs.                                                                                     | `false`  | `ubuntu-latest`       |

### Secrets

| Name            | Description                                                                                          | Required |
| --------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| fly-api-token   | Fly API token with access to the target org.                                                         | `true`   |
| makeitfly-token | Token with read access to the makeitfly repo's releases. Required while that repo is private.        | `false`  |
| name-salt       | Salt mixed into the preview-name hash so the resulting URL is unguessable. Optional but recommended. | `false`  |

### How it works

- **Naming.** The preview name is `[<name-prefix>-]pr-<number>-<hash>`, where `<hash>` is the first 10 hex chars of `sha256("<branch>|<name-salt>")`. It is constant for the life of the PR, so every push deploys to the same name and makeitfly replaces the machine in place (`makeitfly up ... -s none`). With `name-salt` set, the resulting `*.fly.dev` URL can't be guessed from the PR number alone.
- **Deploy** (`opened`/`synchronize`/`reopened`): checks out the PR head, downloads the makeitfly binary and `flyctl`, runs `makeitfly up`, optionally waits for `health-path` to return 200, then posts/updates the sticky comment.
- **Teardown** (`closed`): recomputes the same name and runs `makeitfly down` (which tolerates an already-gone app), then updates the comment.
- The sticky comment is posted via [`create-or-update-pr-comment`](../create-or-update-pr-comment/) using the `makeitfly-preview` marker.

> [!NOTE]
> The makeitfly binary is pulled from the `makeitfly-repo`'s GitHub releases. While that repo is private, supply `makeitfly-token` (a PAT with read access to it); for a public repo the default `github.token` is enough.
