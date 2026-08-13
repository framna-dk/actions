// Tests for the simulator selection logic.
//
// Run from the get-xcode-build-destination directory with:
//     node --test __test__/

const { test } = require("node:test")
const assert = require("node:assert/strict")

const { SelectionError, parseOsFilter, selectGeneric, selectDevice } = require("../index.js")

// Shaped like the "devices" object of `xcrun simctl list devices available --json`,
// mirroring a runner with two iOS runtimes plus tvOS and watchOS runtimes installed.
const RUNTIMES = {
  "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
    { name: "iPhone 16 Pro", udid: "UDID-IPHONE-16-PRO-18-5" },
    { name: "iPad Pro 11-inch (M4)", udid: "UDID-IPAD-M4-18-5" },
  ],
  "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
    { name: "iPhone 17 Pro", udid: "UDID-IPHONE-17-PRO-26-5" },
    { name: "iPhone 17 Pro Max", udid: "UDID-IPHONE-17-PRO-MAX-26-5" },
    { name: "iPad Pro 11-inch (M5)", udid: "UDID-IPAD-M5-26-5" },
  ],
  "com.apple.CoreSimulator.SimRuntime.tvOS-26-5": [
    { name: "Apple TV 4K (3rd generation)", udid: "UDID-APPLE-TV-26-5" },
  ],
  "com.apple.CoreSimulator.SimRuntime.watchOS-26-5": [
    { name: "Apple Watch Series 11 (46mm)", udid: "UDID-WATCH-26-5" },
  ],
}

test("defaults to iPhone on newest runtime", () => {
  const selected = selectDevice(RUNTIMES, "iOS")
  assert.equal(selected.udid, "UDID-IPHONE-17-PRO-MAX-26-5")
  assert.equal(selected.name, "iPhone 17 Pro Max")
  assert.equal(selected["os-version"], "26.5")
  assert.equal(selected.destination, "platform=iOS Simulator,id=UDID-IPHONE-17-PRO-MAX-26-5")
})

test("default never picks an iPad", () => {
  const ipadsOnlyOnNewest = {
    "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
      { name: "iPhone 16 Pro", udid: "UDID-IPHONE-16-PRO-18-5" },
    ],
    "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
      { name: "iPad Pro 11-inch (M5)", udid: "UDID-IPAD-M5-26-5" },
    ],
  }
  assert.equal(selectDevice(ipadsOnlyOnNewest, "iOS").udid, "UDID-IPHONE-16-PRO-18-5")
})

test("os filter exact match", () => {
  const selected = selectDevice(RUNTIMES, "iOS", "18.5")
  assert.equal(selected.udid, "UDID-IPHONE-16-PRO-18-5")
  assert.equal(selected["os-version"], "18.5")
})

test("os filter with wildcard minor", () => {
  assert.equal(selectDevice(RUNTIMES, "iOS", "26.x")["os-version"], "26.5")
})

test("os filter major only behaves like wildcard minor", () => {
  assert.equal(selectDevice(RUNTIMES, "iOS", "18")["os-version"], "18.5")
})

test("os filter with no matching runtime", () => {
  assert.throws(
    () => selectDevice(RUNTIMES, "iOS", "17.5"),
    error => error instanceof SelectionError
      && error.message.includes("iOS 17.5")
      && error.message.includes("18.5, 26.5")
  )
})

test("device filter exact name", () => {
  assert.equal(selectDevice(RUNTIMES, "iOS", "", "iPhone 17 Pro").udid, "UDID-IPHONE-17-PRO-26-5")
})

test("device filter matches iPad", () => {
  assert.equal(selectDevice(RUNTIMES, "iOS", "", "iPad Pro 11-inch (M4)").udid, "UDID-IPAD-M4-18-5")
})

test("device filter prefers newest runtime with that device", () => {
  const bothRuntimes = {
    "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
      { name: "iPhone 16 Pro", udid: "UDID-OLD" },
    ],
    "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
      { name: "iPhone 16 Pro", udid: "UDID-NEW" },
    ],
  }
  assert.equal(selectDevice(bothRuntimes, "iOS", "", "iPhone 16 Pro").udid, "UDID-NEW")
})

test("device and os filters combined", () => {
  assert.equal(selectDevice(RUNTIMES, "iOS", "18.x", "iPhone 16 Pro").udid, "UDID-IPHONE-16-PRO-18-5")
})

test("device filter with unknown device", () => {
  assert.throws(
    () => selectDevice(RUNTIMES, "iOS", "", "iPhone 4S"),
    error => error instanceof SelectionError && error.message.includes("device 'iPhone 4S'")
  )
})

test("other platform", () => {
  const selected = selectDevice(RUNTIMES, "tvOS", "", "Apple TV 4K (3rd generation)")
  assert.equal(selected.udid, "UDID-APPLE-TV-26-5")
  assert.equal(selected.destination, "platform=tvOS Simulator,id=UDID-APPLE-TV-26-5")
})

test("iOS selection ignores other platform runtimes", () => {
  const tvosOnly = {
    "com.apple.CoreSimulator.SimRuntime.tvOS-26-5": [
      { name: "Apple TV 4K (3rd generation)", udid: "UDID-APPLE-TV-26-5" },
    ],
  }
  assert.throws(() => selectDevice(tvosOnly, "iOS"), SelectionError)
})

test("numeric version ordering", () => {
  // 9.2 must sort below 17.5 — a lexicographic comparison would get this wrong.
  const legacyRuntimes = {
    "com.apple.CoreSimulator.SimRuntime.iOS-9-2": [
      { name: "iPhone 6s", udid: "UDID-IPHONE-6S-9-2" },
    ],
    "com.apple.CoreSimulator.SimRuntime.iOS-17-5": [
      { name: "iPhone 15 Pro", udid: "UDID-IPHONE-15-PRO-17-5" },
    ],
  }
  assert.equal(selectDevice(legacyRuntimes, "iOS").udid, "UDID-IPHONE-15-PRO-17-5")
})

test("no devices at all", () => {
  assert.throws(
    () => selectDevice({}, "iOS"),
    error => error instanceof SelectionError && error.message.includes("none")
  )
})

test("generic destination", () => {
  const selected = selectGeneric("iOS")
  assert.equal(selected.destination, "generic/platform=iOS Simulator")
  assert.equal(selected.udid, "")
  assert.equal(selected.name, "")
  assert.equal(selected["os-version"], "")
})

test("generic respects platform", () => {
  assert.equal(selectGeneric("tvOS").destination, "generic/platform=tvOS Simulator")
})

test("generic rejects os filter", () => {
  assert.throws(
    () => selectGeneric("iOS", "26.x"),
    error => error instanceof SelectionError && error.message.includes("cannot be combined")
  )
})

test("generic rejects device filter", () => {
  assert.throws(() => selectGeneric("iOS", "", "iPhone 17 Pro"), SelectionError)
})

test("parse os filter exact version", () => {
  assert.deepEqual(parseOsFilter("26.5"), [26, 5])
})

test("parse os filter wildcard", () => {
  assert.deepEqual(parseOsFilter("26.x"), [26, null])
  assert.deepEqual(parseOsFilter("26.X"), [26, null])
})

test("parse os filter invalid component", () => {
  assert.throws(() => parseOsFilter("26.foo"), SelectionError)
})

test("parse os filter empty component", () => {
  assert.throws(() => parseOsFilter("26."), SelectionError)
})
