## [post-slack-message](https://github.com/framna-dk/actions/tree/main/post-slack-message/action.yml)

Posts a message to Slack.

```yml
- name: Post to Slack
  uses: framna-dk/actions/post-slack-message@v1
  with:
    channel: "#my-channel"
    message: "Started a new build 🏃‍♀️"
    op-slack-token-reference: op://My Vault/My Slack Token/token
```

The action will automatically add the following details to the Slack message:

- Workflow name
- Runner name
- Branch name
- GitHub username of the person who started the job
- Link to view the logs produced by the workflow

The details above can be omitted by setting the `add-workflow-info-fields` and `add-view-logs-button` inputs to false.

```yml
- name: Post to Slack
  uses: framna-dk/actions/post-slack-message@v1
  with:
    channel: "#my-channel"
    message: "Started a new build 🏃‍♀️"
    op-slack-token-reference: op://My Vault/My Slack Token/token
    add-workflow-info-fields: false
    add-view-logs-button: false
```

If you wish to only post to Slack if the jobs fails you can use the `failure()` status check function:

```yml
- name: Post Slack message on failure
  if: ${{ failure() }}
  uses: framna-dk/actions/post-slack-message@v1
  with:
    channel: "#my-channel"
    message: "Failed building project 💥"
    op-slack-token-reference: op://My Vault/My Slack Token/token
```

Similarly, you can have the action only post a message on success using the `success()` status check function:

```yml
- name: Post Slack message on success
  if: ${{ success() }}
  uses: framna-dk/actions/post-slack-message@v1
  with:
    channel: "#my-channel"
    message: "Successfully built project 🚀"
    op-slack-token-reference: op://My Vault/My Slack Token/token
```

Custom fields and buttons can be added to the message as shown below. The fields and buttons must be JSON encoded as GitHub Actions inputs do not support arrays.

```yml
- name: Post to Slack
  uses: framna-dk/actions/post-slack-message@v1
  with:
    channel: "#my-channel"
    message: Hello world!
    fields: '[{"title": "Foo", "value": "Bar"}]'
    buttons: '[{"title": "Open Website", "url": "https://example.com"}]'
    op-slack-token-reference: op://GitHub Actions/Slack Token/token
```

You may use the Slack token residing in the shared GitHub Actions vault to post messages.

```yml
- name: Post to Slack
  uses: framna-dk/actions/post-slack-message@v1
  with:
    channel: "#my-channel"
    message: "Hello world!"
    op-slack-token-reference: op://GitHub Actions/Slack Token/token
```