## [upload-apk-shipshape](https://github.com/framna-dk/actions/tree/main/upload-apk-shipshape/action.yml)

Uploads an APK to Shipshape.

The action has the following inputs:

| Name                        | Description                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| projectName                 | The project/client name.                                                                                                                                       |
| targetName                  | The project name with the build variant.                                                                                                                       |
| apkPath                     | The path to the APK file that needs to be uploaded.                                                                                                            |
| manifestPath                | The path to the AndroidManifest.xml for the same build.                                                                                                        |
| appIconPath                 | The path to a PNG icon to be shown in Shipshape.                                                                                                               |
| distributionListDefinitions | The available distribution lists in JSON format. E.g. `{"Shape": ["a@shape.dk", "b@shape.dk"], "Client": ["a@example.com", "b@example.com"]}`                  |
| distributionListTargets     | The distribution lists that will receive the builds, comma-separated. Should be one or more of the keys in `distributionListDefinitions`. E.g. `Shape,Client`. |
| releaseNotes                | The release notes that are going to be shown in Shipshape for this build.                                                                                      |

Example:

```yml
- name: Upload to Shipshape
  uses: framna-dk/actions/upload-apk-shipshape@v1
  with:
    projectName: Client
    targetName: Client (${{ env.BUILD_TYPE }})
    apkPath: app/build/outputs/apk/${{ env.BUILD_TYPE }}/app-${{ env.BUILD_TYPE }}.apk
    manifestPath: app/build/intermediates/merged_manifests/${{ env.BUILD_TYPE }}/AndroidManifest.xml
    appIconPath: shipshape_icon.png
    distributionListDefinitions: ${{ vars.DISTRIBUTION_LISTS }}
    distributionListTargets: ${{ github.event.inputs.DISTRIBUTION_LISTS }}
    releaseNotes: ${{ github.event.inputs.RELEASE_NOTES }}
```