import {
  DeviceList,
  SelectionError,
  parseOsVersionTemplate,
  selectDeviceDestination,
  selectGenericDestination
} from "../src/DestinationSelector.js"

// Shaped like the "devices" object of `xcrun simctl list devices available --json`,
// mirroring a runner with two iOS runtimes plus tvOS and watchOS runtimes installed.
const RUNTIMES: DeviceList = {
  "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
    { name: "iPhone 16 Pro", udid: "UDID-IPHONE-16-PRO-18-5" },
    { name: "iPad Pro 11-inch (M4)", udid: "UDID-IPAD-M4-18-5" }
  ],
  "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
    { name: "iPhone 17 Pro", udid: "UDID-IPHONE-17-PRO-26-5" },
    { name: "iPhone 17 Pro Max", udid: "UDID-IPHONE-17-PRO-MAX-26-5" },
    { name: "iPad Pro 11-inch (M5)", udid: "UDID-IPAD-M5-26-5" }
  ],
  "com.apple.CoreSimulator.SimRuntime.tvOS-26-5": [
    { name: "Apple TV 4K (3rd generation)", udid: "UDID-APPLE-TV-26-5" }
  ],
  "com.apple.CoreSimulator.SimRuntime.watchOS-26-5": [
    { name: "Apple Watch Series 11 (46mm)", udid: "UDID-WATCH-26-5" }
  ]
}

describe("selectDeviceDestination", () => {
  it("defaults to an iPhone on the newest runtime", () => {
    const selected = selectDeviceDestination(RUNTIMES, "iOS")
    expect(selected.udid).toBe("UDID-IPHONE-17-PRO-MAX-26-5")
    expect(selected.name).toBe("iPhone 17 Pro Max")
    expect(selected.osVersion).toBe("26.5")
    expect(selected.destination).toBe("platform=iOS Simulator,id=UDID-IPHONE-17-PRO-MAX-26-5")
  })

  it("never picks an iPad by default", () => {
    const ipadsOnlyOnNewest: DeviceList = {
      "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
        { name: "iPhone 16 Pro", udid: "UDID-IPHONE-16-PRO-18-5" }
      ],
      "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
        { name: "iPad Pro 11-inch (M5)", udid: "UDID-IPAD-M5-26-5" }
      ]
    }
    expect(selectDeviceDestination(ipadsOnlyOnNewest, "iOS").udid).toBe("UDID-IPHONE-16-PRO-18-5")
  })

  it("matches an exact os filter", () => {
    const selected = selectDeviceDestination(RUNTIMES, "iOS", "18.5")
    expect(selected.udid).toBe("UDID-IPHONE-16-PRO-18-5")
    expect(selected.osVersion).toBe("18.5")
  })

  it("matches an os filter with a wildcard minor version", () => {
    expect(selectDeviceDestination(RUNTIMES, "iOS", "26.x").osVersion).toBe("26.5")
  })

  it("treats a major-only os filter like a wildcard minor version", () => {
    expect(selectDeviceDestination(RUNTIMES, "iOS", "18").osVersion).toBe("18.5")
  })

  it("throws when no runtime matches the os filter", () => {
    expect(() => selectDeviceDestination(RUNTIMES, "iOS", "17.5")).toThrow(SelectionError)
    expect(() => selectDeviceDestination(RUNTIMES, "iOS", "17.5")).toThrow(/iOS 17\.5.*18\.5, 26\.5/s)
  })

  it("matches a device filter by exact name", () => {
    expect(selectDeviceDestination(RUNTIMES, "iOS", "", "iPhone 17 Pro").udid).toBe("UDID-IPHONE-17-PRO-26-5")
  })

  it("matches an iPad with a device filter", () => {
    expect(selectDeviceDestination(RUNTIMES, "iOS", "", "iPad Pro 11-inch (M4)").udid).toBe("UDID-IPAD-M4-18-5")
  })

  it("prefers the newest runtime that has the filtered device", () => {
    const bothRuntimes: DeviceList = {
      "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
        { name: "iPhone 16 Pro", udid: "UDID-OLD" }
      ],
      "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
        { name: "iPhone 16 Pro", udid: "UDID-NEW" }
      ]
    }
    expect(selectDeviceDestination(bothRuntimes, "iOS", "", "iPhone 16 Pro").udid).toBe("UDID-NEW")
  })

  it("combines device and os filters", () => {
    expect(selectDeviceDestination(RUNTIMES, "iOS", "18.x", "iPhone 16 Pro").udid).toBe("UDID-IPHONE-16-PRO-18-5")
  })

  it("throws for an unknown device", () => {
    expect(() => selectDeviceDestination(RUNTIMES, "iOS", "", "iPhone 4S")).toThrow(/device 'iPhone 4S'/)
  })

  it("selects on other platforms", () => {
    const selected = selectDeviceDestination(RUNTIMES, "tvOS", "", "Apple TV 4K (3rd generation)")
    expect(selected.udid).toBe("UDID-APPLE-TV-26-5")
    expect(selected.destination).toBe("platform=tvOS Simulator,id=UDID-APPLE-TV-26-5")
  })

  it("ignores runtimes of other platforms", () => {
    const tvosOnly: DeviceList = {
      "com.apple.CoreSimulator.SimRuntime.tvOS-26-5": [
        { name: "Apple TV 4K (3rd generation)", udid: "UDID-APPLE-TV-26-5" }
      ]
    }
    expect(() => selectDeviceDestination(tvosOnly, "iOS")).toThrow(SelectionError)
  })

  it("orders versions numerically", () => {
    // 9.2 must sort below 17.5 — a lexicographic comparison would get this wrong.
    const legacyRuntimes: DeviceList = {
      "com.apple.CoreSimulator.SimRuntime.iOS-9-2": [
        { name: "iPhone 6s", udid: "UDID-IPHONE-6S-9-2" }
      ],
      "com.apple.CoreSimulator.SimRuntime.iOS-17-5": [
        { name: "iPhone 15 Pro", udid: "UDID-IPHONE-15-PRO-17-5" }
      ]
    }
    expect(selectDeviceDestination(legacyRuntimes, "iOS").udid).toBe("UDID-IPHONE-15-PRO-17-5")
  })

  it("throws when there are no devices at all", () => {
    expect(() => selectDeviceDestination({}, "iOS")).toThrow(/none/)
  })
})

describe("selectGenericDestination", () => {
  it("returns the generic destination", () => {
    const selected = selectGenericDestination("iOS")
    expect(selected.destination).toBe("generic/platform=iOS Simulator")
    expect(selected.udid).toBe("")
    expect(selected.name).toBe("")
    expect(selected.osVersion).toBe("")
  })

  it("respects the platform", () => {
    expect(selectGenericDestination("tvOS").destination).toBe("generic/platform=tvOS Simulator")
  })

  it("rejects an os filter", () => {
    expect(() => selectGenericDestination("iOS", "26.x")).toThrow(/cannot be combined/)
  })

  it("rejects a device filter", () => {
    expect(() => selectGenericDestination("iOS", "", "iPhone 17 Pro")).toThrow(SelectionError)
  })
})

describe("parseOsVersionTemplate", () => {
  it("parses an exact version", () => {
    expect(parseOsVersionTemplate("26.5")).toEqual([26, 5])
  })

  it("parses wildcards", () => {
    expect(parseOsVersionTemplate("26.x")).toEqual([26, null])
    expect(parseOsVersionTemplate("26.X")).toEqual([26, null])
  })

  it("throws for an invalid component", () => {
    expect(() => parseOsVersionTemplate("26.foo")).toThrow(SelectionError)
  })

  it("throws for an empty component", () => {
    expect(() => parseOsVersionTemplate("26.")).toThrow(SelectionError)
  })
})
