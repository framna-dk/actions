## [swiftlint](https://github.com/framna-dk/actions/tree/main/swiftlint/action.yml)

Runs [SwiftLint](https://github.com/realm/SwiftLint) on a codebase.

```yml
- name: SwiftLint
  uses: framna-dk/actions/swiftlint@v1
```

You may optionally run SwiftLint in strict mode as shown below. This treats warnings as errors.

```yml
- name: SwiftLint
  uses: framna-dk/actions/swiftlint@v1
  with:
    args: --strict
```

The motivation for using this over running the `swiftlint` CLI directly is that this action can be run on an Ubuntu runner.
Consider running the `swiftlint` CLI directly if you are using a macOS runner.

```yml
- name: SwiftLint
  runs: swiftlint --quiet --strict --reporter github-actions-logging
```