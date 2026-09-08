## [upload-artifact-firebase](https://github.com/shapehq/actions/tree/main/upload-artifact-firebase/action.yml)

Uploads an APK to Firebase App Distribution.

The action has the following inputs:

| Name                            | Required | Description                                                                          |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `appId`                         | YES      | Firebase App ID                                                                      |
| `apkPath`                       | YES      | Path to the APK that will be uploaded                                                |
| `serviceCredentialsOpReference` | NO       | 1Password reference to Google service account credentials json file (without quotes). Omit if authentication is handled externally (e.g. `google-github-actions/auth` with workload identity federation). |
| `releaseNotes`                  | NO       | Release notes for this distribution                                                  |
| `groups`                        | NO       | Comma separated list of Firebase tester group names                                  |
| `testers`                       | NO       | Comma separated email list of testers to invite                                      |

and the following outputs:
|Name|Description|
|-|-|
|`firebase-console-uri`|Link to the release in the Firebase console|
|`testing-uri`|Link to the release in the Firebase App Tester app|
|`binary-download-uri`|Link to the app binary (APK or AAB file). Expires after one hour.|

Example:

```yml
- name: Upload to Firebase distribution
  uses: shapehq/actions/upload-artifact-firebase@v1
  with:
    serviceCredentialsOpReference: op://1Password vault/1Password json key item/credentials-file-name.json
    appId: 1:123456789012:android:1234567890abcdef1234567
    apkPath: app/build/outputs/apk/inhouse/app-inhouse.apk
    releaseNotes: ${{ inputs.releaseNotes }}
    groups: ${{ inputs.groups }}
    testers: ${{ inputs.testers }}
```