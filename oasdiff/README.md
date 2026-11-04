# OpenAPI Diff

Runs [oasdiff](https://github.com/tufin/oasdiff) changelog between two OpenAPI specs and outputs the differences as a nicely formatted markdown table.

## Usage

```yaml
- name: Diff OpenAPI Specs
  id: oasdiff
  uses: framna-dk/actions/oasdiff@v1
  with:
    base: path/to/base-spec.yml
    head: path/to/head-spec.yml

- name: Show diff
  run: echo "${{ steps.oasdiff.outputs.diff }}"
```

### With PR Comments

A common pattern is to show API changes in pull request comments:

```yaml
name: OpenAPI Diff

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  oasdiff:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          path: pr

      - name: Checkout base branch
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.ref }}
          path: base

      - name: Diff API
        id: diff
        uses: framna-dk/actions/oasdiff@v1
        with:
          base: base/openapi.yml
          head: pr/openapi.yml

      - name: Build comment
        run: |
          cat > comment.md << 'EOF'
          ## OpenAPI Diff Report

          ${{ steps.diff.outputs.diff }}

          ---
          *Updated for commit ${{ github.event.pull_request.head.sha }}*
          EOF

      - name: Post PR comment
        uses: framna-dk/actions/create-or-update-pr-comment@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          body-file: comment.md
          update-marker: oasdiff-report
```

### Multiple API Specs

For projects with multiple OpenAPI specs:

```yaml
- name: Diff Invoicing API
  id: diff-invoicing
  uses: framna-dk/actions/oasdiff@v1
  with:
    base: base/invoicing-api.yml
    head: pr/invoicing-api.yml

- name: Diff Reporting API
  id: diff-reporting
  uses: framna-dk/actions/oasdiff@v1
  with:
    base: base/reporting-api.yml
    head: pr/reporting-api.yml

- name: Build comment
  run: |
    cat > comment.md << 'EOF'
    ## OpenAPI Diff Report

    ### Invoicing API
    ${{ steps.diff-invoicing.outputs.diff }}

    ### Reporting API
    ${{ steps.diff-reporting.outputs.diff }}
    EOF
```

## Inputs

| Name     | Description                                        | Required | Default |
| -------- | -------------------------------------------------- | -------- | ------- |
| `base`   | Path to the base OpenAPI spec file                 | Yes      |         |
| `head`   | Path to the head OpenAPI spec file                 | Yes      |         |
| `format` | Output format: `table`, `text`, `html`, or `json`  | No       | `table` |

## Outputs

| Name          | Description                                |
| ------------- | ------------------------------------------ |
| `diff`        | The formatted diff output                  |
| `has-changes` | Whether there are changes (`true`/`false`) |

## Output Formats

- **table**: Markdown table with color-coded severity indicators (default)
- **text**: Plain text changelog from oasdiff
- **html**: Full HTML with styling
- **json**: Raw JSON for programmatic processing

## Example Output

With the default `table` format, the output looks like this:

---

**8 changes:** 3 breaking, 2 warning, 3 info

| | Endpoint | Change |
|:---:|:---|:---|
| 🔴 | `GET` /api/users | removed the required property 'email' from the response |
| 🔴 | `POST` /api/users | added the new required request property 'role' |
| 🔴 | `DELETE` /api/users/{id} | endpoint removed |
| 🟡 | `PUT` /api/users/{id} | removed the request property 'nickname' |
| 🟡 | `PUT` /api/users/{id} | removed the request property 'avatar' |
| 🟢 | `GET` /api/users | added the new optional query parameter 'filter' |
| 🟢 | `POST` /api/users | added the optional property 'bio' to the response |
| 🟢 | _components_ | added the schema 'UserRole' |

---

- 🔴 **Breaking changes** - Will break existing clients
- 🟡 **Warnings** - May affect some clients
- 🟢 **Info** - Non-breaking additions or changes
