## [jira-comment](https://github.com/framna-dk/actions/tree/main/jira-comment/action.yml)

Adds comment to a Jira issue.

```yml
- name: Add comment to a Jira issue
  uses: framna-dk/actions/jira-comment@v1
  with:
    message: This issue is included in *Solar* v. ${{ inputs.marketing_version }} (${{ github.run_number }}) available on Shipshape.
    issues: ${{ steps.changelog.outputs.issues }}
    jira-base-url: https://shapedk.atlassian.net
    jira-user-email: ci@shape.dk
    op-jira-api-token-reference: op://My Vault/Shape CI Bot API Token for Jira credentials
```