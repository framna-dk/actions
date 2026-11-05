import * as core from "@actions/core"
import simulatorSdkVersion from "./SimulatorSdkVersion.js"
import getOptions from "./getOptions.js"
import listAvailableDevices from "./SimctlDeviceListRepository.js"
import { selectDeviceDestination, selectGenericDestination } from "./DestinationSelector.js"

try {
  const options = getOptions()
  if (options.generic) {
    const destination = selectGenericDestination(options.platform, options.os, options.device)
    core.info(`The generic ${options.platform} Simulator destination was selected.`)
    emit(destination)
  } else {
    const maximumOsVersion = options.os.length === 0 ? simulatorSdkVersion(options.platform) : undefined
    if (maximumOsVersion !== undefined) {
      core.info(`Limiting simulator selection to ${options.platform} <= ${maximumOsVersion} from the selected Xcode SDK.`)
    }
    const destination = selectDeviceDestination(listAvailableDevices(), options.platform, options.os, options.device, maximumOsVersion)
    core.info(`${destination.name} (${options.platform} ${destination.osVersion}) was selected.`)
    emit(destination)
  }
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error))
}

function emit(destination: { destination: string, udid: string, name: string, osVersion: string }) {
  core.info(`Build destination: ${destination.destination}`)
  core.setOutput("destination", destination.destination)
  core.setOutput("udid", destination.udid)
  core.setOutput("name", destination.name)
  core.setOutput("os-version", destination.osVersion)
}
