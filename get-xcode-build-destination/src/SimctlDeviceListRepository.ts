import { execFileSync } from "node:child_process"
import { DeviceList } from "./DestinationSelector.js"

export default function listAvailableDevices(): DeviceList {
  const json = execFileSync("xcrun", ["simctl", "list", "devices", "available", "--json"], { encoding: "utf8" })
  return JSON.parse(json).devices as DeviceList
}
