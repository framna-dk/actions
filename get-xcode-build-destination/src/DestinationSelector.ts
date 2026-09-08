export class SelectionError extends Error {}

export interface SimulatorDevice {
  readonly name: string
  readonly udid: string
}

// The "devices" object of `xcrun simctl list devices available --json`,
// mapping runtime identifiers to the devices that exist for that runtime.
export type DeviceList = Readonly<Record<string, readonly SimulatorDevice[]>>

export interface BuildDestination {
  readonly destination: string
  readonly udid: string
  readonly name: string
  readonly osVersion: string
}

// Parses an OS filter template like "26.5" or "26.x" into a list of
// numbers and nulls, where null matches any value at that position.
export function parseOsVersionTemplate(template: string): (number | null)[] {
  return template.split(".").map(component => {
    if (component.toLowerCase() === "x") {
      return null
    }
    if (/^\d+$/.test(component)) {
      return parseInt(component, 10)
    }
    throw new SelectionError(`Invalid os filter '${template}': each component must be a number or 'x'`)
  })
}

function matchesOsVersion(version: readonly number[], templateComponents: readonly (number | null)[]): boolean {
  return templateComponents.every((expected, position) => {
    return expected === null || (position < version.length ? version[position] : 0) === expected
  })
}

// Returns the generic simulator destination for the platform, which requires
// no installed runtime. Only valid for building, not for running tests.
export function selectGenericDestination(platform: string, osFilter = "", deviceFilter = ""): BuildDestination {
  if (osFilter.length > 0 || deviceFilter.length > 0) {
    throw new SelectionError("The 'generic' input cannot be combined with the 'os' or 'device' inputs")
  }
  return {
    destination: `generic/platform=${platform} Simulator`,
    udid: "",
    name: "",
    osVersion: ""
  }
}

// Selects a simulator from simctl's runtime-to-devices mapping, filtered by
// the platform and the optional os and device filters, preferring the newest
// OS version among the matches. Throws SelectionError if nothing matches.
export function selectDeviceDestination(
  deviceList: DeviceList,
  platform: string,
  osFilter = "",
  deviceFilter = ""
): BuildDestination {
  const runtimeMarker = `.SimRuntime.${platform}-`
  const templateComponents = osFilter.length > 0 ? parseOsVersionTemplate(osFilter) : []

  const devices = Object.entries(deviceList)
    .filter(([runtime]) => runtime.includes(runtimeMarker))
    .flatMap(([runtime, runtimeDevices]) => {
      const versionString = runtime.slice(runtime.lastIndexOf(runtimeMarker) + runtimeMarker.length)
      const version = versionString.split("-").map(component => parseInt(component, 10))
      return runtimeDevices
        .filter(device => deviceFilter.length > 0 ? device.name === deviceFilter : device.name.startsWith("iPhone"))
        .map(device => ({ version, name: device.name, udid: device.udid }))
    })
    .sort((a, b) => {
      for (let i = 0; i < Math.max(a.version.length, b.version.length); i++) {
        const difference = (a.version[i] ?? 0) - (b.version[i] ?? 0)
        if (difference !== 0) {
          return difference
        }
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })

  const matching = devices.filter(device => matchesOsVersion(device.version, templateComponents))
  if (matching.length === 0) {
    const wantedDevice = deviceFilter.length > 0 ? `device '${deviceFilter}'` : "an iPhone"
    const wantedOs = osFilter.length > 0 ? `${platform} ${osFilter}` : `any ${platform} version`
    const installed = [...new Set(devices.map(device => device.version.join(".")))].sort().join(", ") || "none"
    throw new SelectionError(
      `No available simulator matching ${wantedDevice} on ${wantedOs}. `
      + `Installed ${platform} versions with matching devices: ${installed}`
    )
  }

  const selected = matching[matching.length - 1]
  return {
    destination: `platform=${platform} Simulator,id=${selected.udid}`,
    udid: selected.udid,
    name: selected.name,
    osVersion: selected.version.join(".")
  }
}
