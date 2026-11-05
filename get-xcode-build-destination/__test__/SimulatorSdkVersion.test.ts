import { jest } from "@jest/globals"

const execFileSync = jest.fn<(...args: unknown[]) => string>()
jest.unstable_mockModule("node:child_process", () => ({ execFileSync }))
const { default: simulatorSdkVersion } = await import("../src/SimulatorSdkVersion.js")

beforeEach(() => execFileSync.mockReset())

it.each([
  ["iOS", "iphonesimulator"],
  ["tvOS", "appletvsimulator"],
  ["watchOS", "watchsimulator"],
  ["visionOS", "xrsimulator"]
])("reads the selected Xcode SDK for %s", (platform, sdk) => {
  execFileSync.mockReturnValue("26.6\n")
  expect(simulatorSdkVersion(platform)).toBe("26.6")
  expect(execFileSync).toHaveBeenCalledWith("xcrun", ["--sdk", sdk, "--show-sdk-version"], { encoding: "utf8" })
})

it("fails when the SDK version cannot be read instead of disabling the ceiling", () => {
  execFileSync.mockImplementation(() => { throw new Error("SDK unavailable") })
  expect(() => simulatorSdkVersion("iOS")).toThrow("SDK unavailable")
  execFileSync.mockReturnValue("unknown")
  expect(() => simulatorSdkVersion("iOS")).toThrow(/Cannot determine/)
})
