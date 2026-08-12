# get-xcode-build-destination

Finds an available simulator on the runner and exposes it as a destination specifier for xcodebuild's `-destination` flag. The specifier targets the simulator by UDID, so it works regardless of which device names and OS runtimes the runner image ships with.

> **Note**
> Run this action *after* selecting an Xcode version (e.g. with `xcode-select`), since the available simulator runtimes depend on the selected Xcode.

## Using the result

The action exposes the destination in two equivalent ways — pick whichever fits your workflow:

**1. Via the `BUILD_DESTINATION` environment variable.** The action exports the destination to the job environment, so any later step in the same job can use it without wiring up step outputs:

```yaml
- name: Get Build Destination
  uses: framna-dk/actions/get-xcode-build-destination@v1

- name: Run unit tests
  run: |
    xcodebuild test \
      -scheme MyApp \
      -sdk iphonesimulator \
      -destination "${BUILD_DESTINATION}"
```

**2. Via step outputs.** Give the step an `id` and reference its outputs. Use this when you need the value in a `with:`/`env:` block, in another job, or want the device metadata:

```yaml
- name: Get Build Destination
  id: destination
  uses: framna-dk/actions/get-xcode-build-destination@v1

- name: Run unit tests
  run: |
    xcodebuild test \
      -scheme MyApp \
      -sdk iphonesimulator \
      -destination "${{ steps.destination.outputs.destination }}"

- name: Upload test results
  uses: actions/upload-artifact@v4
  with:
    name: test-results-${{ steps.destination.outputs.name }}-${{ steps.destination.outputs.os-version }}
    path: TestResults.xcresult
```

### Outputs

| Output | Example | Description |
| --- | --- | --- |
| `destination` | `platform=iOS Simulator,id=23FE1E29-…` | Value for xcodebuild's `-destination` flag. Identical to `BUILD_DESTINATION`. |
| `udid` | `23FE1E29-E292-4D86-B8A8-B19057A182DC` | UDID of the selected simulator, e.g. for `xcrun simctl` commands. |
| `name` | `iPhone 17 Pro` | Device name of the selected simulator. |
| `os-version` | `26.5` | OS version of the selected simulator. |

## Choosing the simulator

Without inputs, the action selects the newest available iPhone simulator — use this unless you need a specific OS or device.

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

If nothing matches the filters, the action fails and lists the OS versions that are installed on the runner for the requested device.

### Compile-only jobs

Jobs that only build — no test running — don't need a concrete simulator at all. Pass `generic: true` to get the generic destination (`generic/platform=iOS Simulator`), which works regardless of which runtimes are installed:

```yaml
- name: Get Build Destination
  uses: framna-dk/actions/get-xcode-build-destination@v1
  with:
    generic: true

- name: Build
  run: |
    xcodebuild build \
      -scheme MyApp \
      -sdk iphonesimulator \
      -destination "${BUILD_DESTINATION}"
```

`generic` cannot be combined with `os` or `device` (a generic destination has no specific OS or device), and the `udid`, `name` and `os-version` outputs will be empty. A generic destination cannot run tests — use the simulator selection above for test jobs.

## Tests

The selection logic is covered by unit tests, run automatically on pull requests that touch this action:

```bash
cd get-xcode-build-destination
python3 -m unittest discover __test__
```
