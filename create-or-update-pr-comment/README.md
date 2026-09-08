## [create-or-update-pr-comment](https://github.com/shapehq/actions/blob/main/create-or-update-pr-comment/action.yml)

Creates (or updates if already exists) a PR comment. Always updates the same comment by default using a hidden marker. If you need to create more than one comment, you need to pass different markers as a parameter.

The action has the following inputs:

| Name            | Description                                                                                   | Required | Default              |
| --------------- | --------------------------------------------------------------------------------------------- | -------- | -------------------- |
| token           | GitHub token with issues:write permission. Usually `secrets.GITHUB_TOKEN`.                    | `true`   | None                 |
| body-file       | A path to a local Markdown file containing the contents of the comment.                       | `true`   | None                 |
| render-template | If `true`, replace `{{PLACEHOLDER}}` tokens with `TPL_`-prefixed environment variables.       | `false`  | `true`               |
| pr-number       | Pull request number; auto-detected on PR events if omitted.                                   | `false`  | Auto-detected on PRs |
| update-marker   | Stable marker token used to find/update the comment; allows multiple comments in the same PR. | `false`  | `pr-comment:default` |

and the following outputs:

| Name        | Description                          |
| ----------- | ------------------------------------ |
| comment-id  | ID of the resulting comment          |
| comment-url | URL linking to the resulting comment |

### Simple body file

```yml
- name: Prepare body comment
  id: prep-comment
  shell: bash
  run: |
    COMMENT_FILE="$RUNNER_TEMP/comment.md"
    echo "## Hello World!" > "$COMMENT_FILE"
    echo "comment_file=$COMMENT_FILE" >> "$GITHUB_OUTPUT"

- name: Create or update comment
  id: comment
  uses: shapehq/actions/create-or-update-pr-comment@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    body-file: ${{ steps.prep-comment.outputs.comment_file }}
```

### Template body file

By default, placeholders in the markdown file are replaced with `TPL_`-prefixed environment variables visible to the action step.

Template file:

```md
## Preview Links

- [Build 1]({{ PLACEHOLDER_1 }})
- [Build 2]({{PLACEHOLDER_2}})
```

Workflow step:

```yml
- name: Create or update comment
  id: comment
  uses: shapehq/actions/create-or-update-pr-comment@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    body-file: .github/actions/pr-template.md
  env:
    TPL_PLACEHOLDER_1: ${{ steps.build.outputs.url1 }}
    TPL_PLACEHOLDER_2: ${{ steps.build.outputs.url2 }}
```

Template rendering rules:

- Placeholders use `{{PLACEHOLDER}}` or `{{ PLACEHOLDER }}` syntax.
- Placeholder values are read only from environment variables prefixed with `TPL_`. For example, `{{PLACEHOLDER_1}}` reads from `TPL_PLACEHOLDER_1`.
- Values are substituted raw. If a value needs URL encoding, encode it in the workflow before passing it to the action.
- Missing placeholders emit a warning and remain unchanged in the posted comment.
- `TPL_` is reserved for this action's template variables.

> [!NOTE]
> To disable templating, set `render-template` to `false`
