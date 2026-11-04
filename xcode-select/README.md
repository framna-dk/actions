## [xcode-select](https://github.com/framna-dk/actions/tree/main/xcode-select)

Selects a version of Xcode. The major, minor, and patch values must all be specified, otherwise the action will throw an error.

The following will pin against the major and minor version, so the action may select Xcode 14.3 or Xcode 14.3.1.

```yaml
- name: Select Xcode Version
  uses: framna-dk/actions/xcode-select@v1
  with:
    version: 14.3.x
```

The following will pin against an exact version of Xcode and will not select any other version than the one specified.

```yaml
- name: Select Xcode Version
  uses: framna-dk/actions/xcode-select@v1
  with:
    version: 14.3.1
```

The following will pin against the major version only, so the action may select version 14.0, 14.3, or 14.3.1.

```yaml
- name: Select Xcode Version
  uses: framna-dk/actions/xcode-select@v1
  with:
    version: 14.x.x
```

> **Note**
> It is recommended to pin against a major and minor version of Xcode and leave the patch as a placeholder. The storage on GitHub Actions runners is limited and patch versions will be deleted and replaced without any prior communication.