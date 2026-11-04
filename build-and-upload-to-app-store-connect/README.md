## [build-and-upload-to-app-store-connect](https://github.com/framna-dk/actions/blob/main/build-and-upload-to-app-store-connect/action.yml)

Builds an Xcode project, archives the app, exports an IPA from the archive, and uploads it to App Store Connect.
As a side effect, the action will upload the dSYM files as an artifact to the job.

```yml
- name: Build and Upload to App Store Connect
  uses: framna-dk/actions/build-and-upload-to-app-store-connect@v1
  with:
    scheme: Example
    configuration: Debug
    op-app-store-connect-api-key-issuer-id-reference: op://GitHub Actions/Company App Store Connect API Key/Issuer ID
    op-app-store-connect-api-key-id-reference: op://GitHub Actions/Company App Store Connect API Key/Key ID
    op-app-store-connect-api-key-file-reference: op://GitHub Actions/Company App Store Connect API Key/AuthKey.p8
    op-development-certificate-reference: op://GitHub Actions/Company Development Certificate/Certificate.p12
    op-development-certificate-password-reference: op://GitHub Actions/Company Development Certificate/password
```

You may use the `marketing-version` and `build-number` inputs to automatically set a version number and build number prior to building the project.

```yml
- name: Build and Upload to App Store Connect
  uses: framna-dk/actions/build-and-upload-to-app-store-connect@v1
  with:
    scheme: Example
    configuration: Debug
    marketing-version: ${{ inputs.version_number }}
    build-number: ${{ github.run_number }}
    op-app-store-connect-api-key-issuer-id-reference: op://GitHub Actions/Company App Store Connect API Key/Issuer ID
    op-app-store-connect-api-key-id-reference: op://GitHub Actions/Company App Store Connect API Key/Key ID
    op-app-store-connect-api-key-file-reference: op://GitHub Actions/Company App Store Connect API Key/AuthKey.p8
    op-development-certificate-reference: op://GitHub Actions/Company Development Certificate/Certificate.p12
    op-development-certificate-password-reference: op://GitHub Actions/Company Development Certificate/password
```

The action supports the following inputs.

| Name                                             | Required | Default Value | Description                                                                                                                                                                            |
| ------------------------------------------------ | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| working-directory                                | Yes      | .             | The directory to run the action in. This should be the directory in which the Xcode project resides.                                                                                   |
| scheme                                           | Yes      |               | The Xcode project's scheme to build. This specifies which set of build settings and targets to use when building your app.                                                             |
| configuration                                    | Yes      | Release       | Specifies the build configuration that Xcode should use. Commonly set to "Release" for production builds meant for App Store distribution.                                             |
| marketing-version                                | No       |               | The marketing version number of the app, such as "1.0.0". This sets the MARKETING_VERSION in Xcode, determining the version displayed on the App Store.                                |
| build-number                                     | No       |               | An incrementing number specifying the build version, which is used to uniquely identify an archive or build sent to the App Store Connect.                                             |
| testflight-internal-testing-only                 | Yes      | false         | When enabled, the build cannot be distributed via external TestFlight or the App Store. Must be either "true" or "false".                                                              |
| op-app-store-connect-api-key-issuer-id-reference | Yes      |               | A reference to the location in 1Password where the Issuer ID for the App Store Connect API key is stored. This ID is crucial for API interactions with App Store Connect.              |
| op-app-store-connect-api-key-id-reference        | Yes      |               | A reference to the location in 1Password where the App Store Connect API Key ID is stored, used for authentication during API requests.                                                |
| op-app-store-connect-api-key-file-reference      | Yes      |               | A reference to the 1Password field containing the AuthKey.p8 file, essential for establishing connections to App Store Connect.                                                        |
| op-development-certificate-reference             | Yes      |               | Points to a field in 1Password where the development certificate and its corresponding private key (.p12 file) are stored, necessary for signing the app during the development phase. |
| op-development-certificate-password-reference    | Yes      |               | Indicates the location in 1Password where the password for decrypting the development certificate (.p12 file) is kept.                                                                 |
| additional-archive-args                          | No       |               | Additional arguments passed to xcodebuild when archiving the app.                                                                                                                      |
| additional-altool-args                           | No       |               | Additional arguments passed to altool when uploading the app.                                                                                                                          |
| build-directory                                  | Yes      | .build        | Defines the directory where the build artifacts, like the final binary or intermediate files, will be stored.                                                                          |
| dsyms-archive-name                               | Yes      | dSYMs         | Name of the uploaded archive containing the dSYMs.                                                                                                                                     |
| pretty-xcodebuild-output                         | Yes      | true          | Whether to pipe xcodebuild output through [xcbeautify](https://github.com/cpisciotta/xcbeautify) for prettier formatting.                                                              |