## [create-and-launch-avd](https://github.com/framna-dk/actions/tree/main/create-and-launch-avd/action.yml)

Creates and launches an Android Virtual Device.
Note: This action must run on a GitHub runner that supports [KVM](https://linux-kvm.org/).

The action has the following inputs:
|Name|Required|Default|Description|
|-|-|-|-|
|`apiLevel`|YES|-|Android version of the system image that the AVD will run.|
|`avdName`|NO|ci_avd|The name of the created AVD.|

Example:
```yml
- name: Create and launch AVD
  uses: framna-dk/actions/create-and-launch-avd@v1
  with:
    apiLevel: 35
    avdName: my_avd

- name: Run instrumentation tests
  run: ./gradlew connectedAndroidTest
```
