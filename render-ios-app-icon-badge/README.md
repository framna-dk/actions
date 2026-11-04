## [render-ios-app-icon-badge](https://github.com/framna-dk/actions/tree/main/render-ios-app-icon-badge/action.yml)

Adds a badge to an iOS app icon to indicate that the app is meant for testing purposes.

```yml
- name: Render iOS App Icon Badge
  uses: framna-dk/actions/render-ios-app-icon-badge@v1
```

The action scans for app icons in the repository and automatically annotates all app icons it finds. You may optionally specify the root folder it should start scanning from, to limit the app icons to be annotated and improve performance.

```yml
- name: Render iOS App Icon Badge
  uses: framna-dk/actions/render-ios-app-icon-badge@v1
  with:
    search-directory: ./my/other/folder
```

The action automatically picks an appropriate color for the curl in the top-right corner. You may override this color by providing a hex color value to the `curl-color` argument.

```yml
- name: Render iOS App Icon Badge
  uses: framna-dk/actions/render-ios-app-icon-badge@v1
  with:
    curl-color: #1CC866
```

To only annotate the app icon when building a specific configuration of your app, you can use GitHub Actions' `if` argument. For example, in the following snippet, the action is only run when the user has chosen to run the workflow for the Beta configuration.

```yml
- name: Add Badge to App Icon
  if: ${{ inputs.configuration == 'Beta' }}
  uses: framna-dk/actions/render-ios-app-icon-badge@v1
```