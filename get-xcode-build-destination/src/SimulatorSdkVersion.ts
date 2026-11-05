import { execFileSync } from "node:child_process"
import { SelectionError } from "./DestinationSelector.js"

export default function simulatorSdkVersion(platform: string): string {
  const sdks: Record<string, string> = {
    iOS: "iphonesimulator",
    tvOS: "appletvsimulator",
    watchOS: "watchsimulator",
    visionOS: "xrsimulator"
  }
  const sdk = sdks[platform]
  if (!sdk) throw new SelectionError(`Unsupported simulator platform '${platform}'`)

  // xcrun respects DEVELOPER_DIR and xcode-select, unlike the installed runtime list.
  const version = execFileSync("xcrun", ["--sdk", sdk, "--show-sdk-version"], { encoding: "utf8" }).trim()
  if (!/^\d+(?:\.\d+)*$/.test(version)) {
    throw new SelectionError(`Cannot determine the selected Xcode's ${platform} simulator SDK version: '${version}'`)
  }
  return version
}
