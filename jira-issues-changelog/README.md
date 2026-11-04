## [jira-issues-changelog](https://github.com/framna-dk/actions/tree/main/jira-issues-changelog/action.yml)

Outputs a list of Jira issue keys mentioned in commit messages between the current commit you are at and the most recent tag that does not include the inputted app version. For example, let's say you are on a release branch for a version 1.1.0 of an app. This action will then look for Jira issue keys mentioned in commit messages between your current commit and the most recent tag that does not contain "1.1.0", which would for example be your latest 1.0.0 release. This should ensure we find all issues included in the 1.1.0 release.

```yml
- name: Jira issues from changelog
  id: changelog
  uses: framna-dk/actions/jira-issues-changelog@v1
  with:
    jira-project-id: Jira project ID, e.g. SL
    marketing-version: Marketing version, e.g. 1.0.0
```