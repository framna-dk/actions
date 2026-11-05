import { jest } from "@jest/globals"

const getOptions = jest.fn<() => { platform: string, os: string, device: string, generic: boolean }>()
const simulatorSdkVersion = jest.fn<() => string>()
const listAvailableDevices = jest.fn()
const setOutput = jest.fn()
const setFailed = jest.fn()
jest.unstable_mockModule("@actions/core", () => ({ info: jest.fn(), setOutput, setFailed }))
jest.unstable_mockModule("../src/getOptions.js", () => ({ default: getOptions }))
jest.unstable_mockModule("../src/SimulatorSdkVersion.js", () => ({ default: simulatorSdkVersion }))
jest.unstable_mockModule("../src/SimctlDeviceListRepository.js", () => ({ default: listAvailableDevices }))

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  simulatorSdkVersion.mockReturnValue("26.6")
  listAvailableDevices.mockReturnValue({
    "com.apple.CoreSimulator.SimRuntime.iOS-26-6": [{ name: "iPhone 17 Pro", udid: "CURRENT" }],
    "com.apple.CoreSimulator.SimRuntime.iOS-27-2": [{ name: "iPhone Duo", udid: "NEWER" }]
  })
})

it("applies the selected SDK ceiling in the action's default path", async () => {
  getOptions.mockReturnValue({ platform: "iOS", os: "", device: "", generic: false })
  await import("../src/index.js")
  expect(setOutput).toHaveBeenCalledWith("udid", "CURRENT")
  expect(setFailed).not.toHaveBeenCalled()
})

it("skips SDK discovery for an explicit OS override", async () => {
  getOptions.mockReturnValue({ platform: "iOS", os: "27.x", device: "", generic: false })
  await import("../src/index.js")
  expect(simulatorSdkVersion).not.toHaveBeenCalled()
  expect(setOutput).toHaveBeenCalledWith("udid", "NEWER")
})

it("keeps generic destinations independent of installed SDKs and devices", async () => {
  getOptions.mockReturnValue({ platform: "iOS", os: "", device: "", generic: true })
  await import("../src/index.js")
  expect(simulatorSdkVersion).not.toHaveBeenCalled()
  expect(listAvailableDevices).not.toHaveBeenCalled()
  expect(setOutput).toHaveBeenCalledWith("destination", "generic/platform=iOS Simulator")
})
