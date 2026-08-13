// Finds an available simulator via `simctl list devices available --json` and
// exposes it as an xcodebuild destination specifier.
//
// Filters by the platform, os and device inputs, preferring the newest OS
// version among the matches. The os input follows the same template style as
// the xcode-select action: "26.5" matches exactly, "x" is a per-position
// wildcard ("26.x"), and positions left unspecified are wildcards ("26"
// behaves like "26.x").

const { execFileSync } = require("node:child_process")
const fs = require("node:fs")

class SelectionError extends Error {}

// Parses an OS filter template like "26.5" or "26.x" into a list of
// numbers and nulls, where null matches any value at that position.
function parseOsFilter(template) {
  return template.split(".").map(part => {
    if (part.toLowerCase() === "x") {
      return null
    }
    if (/^\d+$/.test(part)) {
      return parseInt(part, 10)
    }
    throw new SelectionError(`Invalid os filter '${template}': each component must be a number or 'x'`)
  })
}

function matchesOs(version, templateParts) {
  return templateParts.every((expected, position) => {
    if (expected === null) {
      return true
    }
    return (position < version.length ? version[position] : 0) === expected
  })
}

// Returns the generic simulator destination for the platform, which requires
// no installed runtime. Only valid for building, not for running tests.
function selectGeneric(platform, osFilter = "", deviceFilter = "") {
  if (osFilter || deviceFilter) {
    throw new SelectionError("The 'generic' input cannot be combined with the 'os' or 'device' inputs")
  }
  return {
    destination: `generic/platform=${platform} Simulator`,
    udid: "",
    name: "",
    "os-version": "",
  }
}

// Selects a simulator from simctl's runtime-to-devices mapping.
// Throws SelectionError if no device matches the filters.
function selectDevice(runtimes, platform, osFilter = "", deviceFilter = "") {
  const runtimeMarker = `.SimRuntime.${platform}-`
  const osParts = osFilter ? parseOsFilter(osFilter) : []

  const devices = Object.entries(runtimes)
    .filter(([runtime]) => runtime.includes(runtimeMarker))
    .flatMap(([runtime, runtimeDevices]) => {
      const versionString = runtime.slice(runtime.lastIndexOf(runtimeMarker) + runtimeMarker.length)
      const version = versionString.split("-").map(part => parseInt(part, 10))
      return runtimeDevices
        .filter(device => deviceFilter ? device.name === deviceFilter : device.name.startsWith("iPhone"))
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

  const matching = devices.filter(device => matchesOs(device.version, osParts))
  if (matching.length === 0) {
    const wantedDevice = deviceFilter ? `device '${deviceFilter}'` : "an iPhone"
    const wantedOs = osFilter ? `${platform} ${osFilter}` : `any ${platform} version`
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
    "os-version": selected.version.join("."),
  }
}

function main() {
  const platform = process.env["INPUT_PLATFORM"] || "iOS"
  const osFilter = (process.env["INPUT_OS"] || "").trim()
  const deviceFilter = (process.env["INPUT_DEVICE"] || "").trim()
  const generic = (process.env["INPUT_GENERIC"] || "").trim().toLowerCase()

  if (!["", "true", "false"].includes(generic)) {
    console.error(`Invalid generic input '${generic}': must be 'true' or 'false'`)
    process.exit(1)
  }

  let selected
  try {
    if (generic === "true") {
      selected = selectGeneric(platform, osFilter, deviceFilter)
      console.log(`The generic ${platform} Simulator destination was selected.`)
    } else {
      const runtimes = JSON.parse(
        execFileSync("xcrun", ["simctl", "list", "devices", "available", "--json"], { encoding: "utf8" })
      ).devices
      selected = selectDevice(runtimes, platform, osFilter, deviceFilter)
      console.log(`${selected.name} (${platform} ${selected["os-version"]}) was selected.`)
    }
  } catch (error) {
    if (error instanceof SelectionError) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }
  console.log(`Build destination: ${selected.destination}`)

  const outputs = Object.entries(selected).map(([key, value]) => `${key}=${value}\n`).join("")
  fs.appendFileSync(process.env["GITHUB_OUTPUT"], outputs)
  fs.appendFileSync(process.env["GITHUB_ENV"], `BUILD_DESTINATION=${selected.destination}\n`)
}

module.exports = { SelectionError, parseOsFilter, matchesOs, selectGeneric, selectDevice }

if (require.main === module) {
  main()
}
