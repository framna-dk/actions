# get-xcode-build-destination

Finds an available simulator on the runner and exposes it as a destination specifier for xcodebuild's `-destination` flag. The specifier targets the simulator by UDID, so it works regardless of which device names and OS runtimes the runner image ships with.

The destination is exported to the job environment as `BUILD_DESTINATION` and is also available as the `destination` output.

> **Note**
> Run this action *after* selecting an Xcode version (e.g. with `xcode-select`), since the available simulator runtimes depend on the selected Xcode.

The following selects the newest available iPhone simulator — use this unless you need a specific OS or device:

```yaml
- name: Get Build Destination
  uses: framna-dk/actions/get-xcode-build-destination@v1

- name: Build
  run: |
    xcodebuild build \
      -scheme MyApp \
      -sdk iphonesimulator \
      -destination "${BUILD_DESTINATION}"
```

The following pins the OS major version. As with `xcode-select`, `x` is a placeholder matching any value, so this selects the newest installed 26.* runtime:

```yaml
- name: Get Build Destination
  uses: framna-dk/actions/get-xcode-build-destination@v1
  with:
    os: 26.x
```

The following pins the device by exact name, on the newest OS runtime that has it installed:

```yaml
- name: Get Build Destination
  uses: framna-dk/actions/get-xcode-build-destination@v1
  with:
    device: iPhone 17 Pro
```

`os` and `device` can be combined. A `platform` input (default `iOS`) selects among `iOS`, `tvOS`, `watchOS` and `visionOS` simulators; when no `device` is given, iOS defaults to iPhones (excluding iPads).

## Outputs

| Output | Description |
| --- | --- |
| `destination` | Value for xcodebuild's `-destination` flag, e.g. `platform=iOS Simulator,id=<udid>`. Also exported as `BUILD_DESTINATION`. |
| `udid` | UDID of the selected simulator. |
| `name` | Device name of the selected simulator, e.g. `iPhone 17 Pro`. |
| `os-version` | OS version of the selected simulator, e.g. `26.5`. |

If nothing matches the filters, the action fails and lists the OS versions that are installed on the runner for the requested device.
