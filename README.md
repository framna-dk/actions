<div align="center">
<h3>Actions used with <a href="https://github.com/features/actions">GitHub Actions</a> internally at <a href="https://framna.com">Framna Denmark</a>.</h4>
</div>

<hr />

<div align="center">
<a href="#-getting-started">🚀 Getting Started</a>&nbsp;&nbsp;&nbsp;&nbsp;
<a href="#-actions">🧩 Actions</a>&nbsp;&nbsp;&nbsp;&nbsp;
<a href="#-reusable-workflows">🔁 Reusable Workflows</a>&nbsp;&nbsp;&nbsp;&nbsp;
<a href="#%EF%B8%8F-versioning-model">🏷️ Versioning Model</a>&nbsp;&nbsp;&nbsp;&nbsp;
<a href="#%E2%80%8D-contributing">👩‍💻 Contributing</a>
</div>

<hr />

> [!WARNING]
> This repository is made public for transparency and reference purposes. These actions are primarily designed for internal use at Framna Denmark and are tailored to our specific workflows and infrastructure.
>
> **We provide no guarantees regarding:**
>
> - Backward compatibility between versions
> - Stability or suitability for external use cases
> - Response to external issues or pull requests
> - Documentation completeness for external users
>
> Use these actions at your own risk. Breaking changes may occur without prior notice.

<hr />

## 🚀 Getting Started

Several of these actions depend on the 1Password CLI being installed. Please use 1Password's [install-cli-action](https://github.com/1Password/install-cli-action) action to install the 1Password CLI or [load-secrets-action](https://github.com/1Password/load-secrets-action) to load secrets into the workflow's environment.

Inputs prefixed with `op-` expect a 1Password item reference, for example `op://My Vault/My Item/field`. The action will use `op read` to fetch the value or file from 1Password at runtime.

Click on any action name below to view detailed documentation, usage examples, and configuration options for that specific action.

## 🧩 Actions

<table>
  <thead>
    <tr>
      <th align="left">Action</th>
      <th align="left">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td nowrap><a href="./build-and-upload-to-app-store-connect/">build-and-upload-to-app-store-connect</a></td>
      <td>Builds an Xcode project, archives the app, exports an IPA from the archive, and uploads it to App Store Connect.</td>
    </tr>
    <tr>
      <td nowrap><a href="./connect-to-vpn/">connect-to-vpn</a></td>
      <td>Connects the runner to our a predefined Tailscale exit node.</td>
    </tr>
    <tr>
      <td nowrap><a href="./create-and-launch-avd/">create-and-launch-avd</a></td>
      <td>Creates and launches an Android Virtual Device.</td>
    </tr>
    <tr>
      <td nowrap><a href="./create-or-update-pr-comment/">create-or-update-pr-comment</a></td>
      <td>Creates (or updates if already exists) a PR comment. Always updates the same comment by default using a hidden marker.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-appiconannotator/">install-appiconannotator</a></td>
      <td>Installs <a href="https://github.com/shapehq/appiconannotator">appiconannotator</a>.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-artifactory-profile/">install-artifactory-profile</a></td>
      <td>Installs credentials with read access to our JFrog Artifactory.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-asc-api-key/">install-asc-api-key</a></td>
      <td>Installs an App Store Connect API key file on the runner and outputs the issuer ID, key ID, and file path of the AuthKey file.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-certificate/">install-certificate</a></td>
      <td>Installs the specified certificate in the keychain.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-ci-ssh-key/">install-ci-ssh-key</a></td>
      <td>Install the CI's SSH key.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-company-asc-api-key/">install-company-asc-api-key</a></td>
      <td>Installs our company App Store Connect API key file on the runner and outputs the issuer ID, key ID, and file path of the AuthKey file.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-company-development-certificate/">install-company-development-certificate</a></td>
      <td>Installs our default company development certificate in the keychain.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-company-distribution-certificate/">install-company-distribution-certificate</a></td>
      <td>Installs our default company distribution certificate in the keychain.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-provisioning-profile/">install-provisioning-profile</a></td>
      <td>Installs a provisioning profile.</td>
    </tr>
    <tr>
      <td nowrap><a href="./install-ssh-key/">install-ssh-key</a></td>
      <td>Installs an SSH key or a <a href="https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys">deploy key</a>, which is an SSH key that grants access to a single repository.</td>
    </tr>
    <tr>
      <td nowrap><a href="./jira-comment/">jira-comment</a></td>
      <td>Adds comment to a Jira issue.</td>
    </tr>
    <tr>
      <td nowrap><a href="./jira-issues-changelog/">jira-issues-changelog</a></td>
      <td>Outputs a list of Jira issue keys mentioned in commit messages between the current commit and the most recent tag.</td>
    </tr>
    <tr>
      <td nowrap><a href="./loco-translation-status-checker/">loco-translation-status-checker</a></td>
      <td>Checks if there are missing translations in the Localize.biz project throws error.</td>
    </tr>
    <tr>
      <td nowrap><a href="./loco-translation-status-poster/">loco-translation-status-poster</a></td>
      <td>Checks if there are missing translations in the Localize.biz project and posts warning to Slack.</td>
    </tr>
    <tr>
      <td nowrap><a href="./oasdiff/">oasdiff</a></td>
      <td>Runs <a href="https://github.com/tufin/oasdiff">oasdiff</a> changelog between two OpenAPI specs and outputs the differences.</td>
    </tr>
    <tr>
      <td nowrap><a href="./post-slack-message/">post-slack-message</a></td>
      <td>Posts a message to Slack.</td>
    </tr>
    <tr>
      <td nowrap><a href="./render-ios-app-icon-badge/">render-ios-app-icon-badge</a></td>
      <td>Adds a badge to an iOS app icon to indicate that the app is meant for testing purposes.</td>
    </tr>
    <tr>
      <td nowrap><a href="./swiftlint/">swiftlint</a></td>
      <td>Runs <a href="https://github.com/realm/SwiftLint">SwiftLint</a> on a codebase.</td>
    </tr>
    <tr>
      <td nowrap><a href="./upload-artifact-firebase/">upload-artifact-firebase</a></td>
      <td>Uploads an APK to Firebase App Distribution.</td>
    </tr>
    <tr>
      <td nowrap><a href="./upload-artifact-play-store/">upload-artifact-play-store</a></td>
      <td>Uploads a release build (.apk or .aab) to the internal track of the Play Store.</td>
    </tr>
    <tr>
      <td nowrap><a href="./xcode-select/">xcode-select</a></td>
      <td>Selects a version of Xcode. The major, minor, and patch values must all be specified, otherwise the action will throw an error.</td>
    </tr>
  </tbody>
</table>

### Legacy Actions

<table>
  <thead>
    <tr>
      <th align="left">Action</th>
      <th align="left">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td nowrap><a href="./install-shipshape/">install-shipshape</a></td>
      <td>Installs Shipshape and sets an activation code.</td>
    </tr>
    <tr>
      <td nowrap><a href="./upload-apk-shipshape/">upload-apk-shipshape</a></td>
      <td>Uploads an APK to Shipshape.</td>
    </tr>
  </tbody>
</table>

## 🔁 Reusable Workflows

Unlike the actions above (which are `uses:`-ed at the step level), these are [reusable workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows) called at the job level. They live under [`.github/workflows/`](./.github/workflows/).

<table>
  <thead>
    <tr>
      <th align="left">Workflow</th>
      <th align="left">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td nowrap><a href="./makeitfly-preview/">makeitfly-preview</a></td>
      <td>Deploys a <a href="https://github.com/framna-dk/makeitfly">makeitfly</a> PR preview of a repo's Docker Compose stack to Fly.io, refreshes it on each push, tears it down on PR close, and keeps a sticky comment with the URL.</td>
    </tr>
  </tbody>
</table>

## 🏷️ Versioning Model

This repository is versioned as a whole, meaning all actions share the same version.

We follow [Semantic Versioning](https://semver.org/). Version bumps are based on changes merged into `main`:

- **Major**: Breaking changes to one or more actions (e.g. removed/renamed inputs, changed outputs, changed behavior in an incompatible way).
- **Minor**: Backwards-compatible changes (e.g. new action, new functionality, new inputs, enhancements).
- **Patch**: Bug fixes and other backwards-compatible maintenance changes.

## 👩‍💻 Contributing

Pull requests with bugfixes and new features are appreciated. We are happy to review PRs and merge them once they are ready, as long as the changes fit the vision of Framna Denmark and align with our internal tech stack and needs.

Clone the repository to get started:

```
git clone git@github.com:shapehq/actions.git
```
