# [build-android](./action.yml)

Builds Android APKs or app bundles with Gradle and exposes artifact and merged manifest paths.

Use a Linux or macOS runner with a compatible JDK and Android SDK already installed. Check out your project before this step, and ensure its
`gradlew` wrapper is executable. Gradle handles signing using your project's configuration.

```yml
- name: Build Android
  id: build-android
  uses: framna-dk/actions/build-android@main
  with:
    project-location: .
    module: app
    variant: release
    artifact-type: apk
    arguments: --stacktrace
```

The example uses `main`; you can pin a commit or a release containing this action.

The action has the following inputs:

| Name             | Required | Default Value | Description                                                                                                                            |
| ---------------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| project-location | No       | .             | Project root containing `gradlew` and the Gradle settings file. Relative paths resolve from the workflow workspace.                    |
| module           | No       | app           | Gradle module path, for example `app`, `:app`, or `:apps:mobile`. Nested module paths map to directories such as `apps/mobile`.        |
| variant          | No       | debug         | Full variant names, comma-separated, for example `demoDebug,demoRelease`. An explicitly empty value builds all variants in the module. |
| artifact-type    | No       | apk           | Artifact type: `apk` runs `assemble<Variant>`; `aab` runs `bundle<Variant>`.                                                           |
| arguments        | No       |               | Extra Gradle arguments with shell-style quoting, for example `--stacktrace -Pmessage="hello world"`.                                   |

For projects with product flavors, specify the full variant name, such as `demoRelease`. Discovery matches that exact variant and supports
standard APK paths such as `app/build/outputs/apk/demo/release/` and bundle paths such as `app/build/outputs/bundle/demoRelease/`.

Only outputs in the selected module and variants are returned. Existing outputs from up-to-date Gradle tasks are included alongside newly
generated files. APKs built for instrumented tests are excluded. Custom Gradle project-directory mappings and custom output locations are
not supported by automatic discovery.

The action has the following outputs:

| Name               | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| artifact-path      | Absolute path of the last APK/AAB in the sorted matching paths.                      |
| artifact-path-list | Deduplicated, sorted absolute APK/AAB paths, separated by `\|`. Includes split APKs. |
| manifest-path      | Absolute path of the last merged `AndroidManifest.xml` in the sorted matching paths. |
| manifest-path-list | Deduplicated, sorted absolute merged manifest paths, separated by `\|`.              |

Use the list outputs when building multiple variants or split APKs. The single outputs select the last path in alphabetical order,
independently of the order of the requested variants. Merged manifests are discovered under the selected variants in
`build/intermediates/merged_manifest` and `build/intermediates/merged_manifests`.

The action fails if Gradle fails or no matching APK/AAB is found. Missing merged manifests produce a warning and leave the manifest outputs
empty.

For example, to read the built artifact path in a later step:

```yml
- name: Inspect APK
  env:
    APK_PATH: ${{ steps.build-android.outputs.artifact-path }}
  run: ls -l "$APK_PATH"
```

To develop this action with Node.js 24:

```sh
cd build-android
npm ci
npm run all
```

This formats the package, checks lint and types, rebuilds `dist`, and runs the tests. Commit the rebuilt `dist` files with source changes.
Tests exercise discovery, wrapper execution, and the bundled action using temporary Gradle stubs; they do not compile a real Android
project.
