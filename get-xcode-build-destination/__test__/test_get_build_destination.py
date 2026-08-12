"""Tests for the simulator selection logic.

Run from the get-xcode-build-destination directory with:
    python3 -m unittest discover __test__
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from get_build_destination import SelectionError, parse_os_filter, select_device

# Shaped like the "devices" object of `xcrun simctl list devices available --json`,
# mirroring a runner with two iOS runtimes plus tvOS and watchOS runtimes installed.
RUNTIMES = {
    "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
        {"name": "iPhone 16 Pro", "udid": "UDID-IPHONE-16-PRO-18-5"},
        {"name": "iPad Pro 11-inch (M4)", "udid": "UDID-IPAD-M4-18-5"},
    ],
    "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
        {"name": "iPhone 17 Pro", "udid": "UDID-IPHONE-17-PRO-26-5"},
        {"name": "iPhone 17 Pro Max", "udid": "UDID-IPHONE-17-PRO-MAX-26-5"},
        {"name": "iPad Pro 11-inch (M5)", "udid": "UDID-IPAD-M5-26-5"},
    ],
    "com.apple.CoreSimulator.SimRuntime.tvOS-26-5": [
        {"name": "Apple TV 4K (3rd generation)", "udid": "UDID-APPLE-TV-26-5"},
    ],
    "com.apple.CoreSimulator.SimRuntime.watchOS-26-5": [
        {"name": "Apple Watch Series 11 (46mm)", "udid": "UDID-WATCH-26-5"},
    ],
}


class SelectDeviceTests(unittest.TestCase):
    def test_defaults_to_iphone_on_newest_runtime(self):
        selected = select_device(RUNTIMES, "iOS")
        self.assertEqual(selected["udid"], "UDID-IPHONE-17-PRO-MAX-26-5")
        self.assertEqual(selected["name"], "iPhone 17 Pro Max")
        self.assertEqual(selected["os-version"], "26.5")
        self.assertEqual(selected["destination"], "platform=iOS Simulator,id=UDID-IPHONE-17-PRO-MAX-26-5")

    def test_default_never_picks_an_ipad(self):
        ipads_only_on_newest = {
            "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
                {"name": "iPhone 16 Pro", "udid": "UDID-IPHONE-16-PRO-18-5"},
            ],
            "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
                {"name": "iPad Pro 11-inch (M5)", "udid": "UDID-IPAD-M5-26-5"},
            ],
        }
        selected = select_device(ipads_only_on_newest, "iOS")
        self.assertEqual(selected["udid"], "UDID-IPHONE-16-PRO-18-5")

    def test_os_filter_exact_match(self):
        selected = select_device(RUNTIMES, "iOS", os_filter="18.5")
        self.assertEqual(selected["udid"], "UDID-IPHONE-16-PRO-18-5")
        self.assertEqual(selected["os-version"], "18.5")

    def test_os_filter_with_wildcard_minor(self):
        selected = select_device(RUNTIMES, "iOS", os_filter="26.x")
        self.assertEqual(selected["os-version"], "26.5")

    def test_os_filter_major_only_behaves_like_wildcard_minor(self):
        selected = select_device(RUNTIMES, "iOS", os_filter="18")
        self.assertEqual(selected["os-version"], "18.5")

    def test_os_filter_no_matching_runtime(self):
        with self.assertRaises(SelectionError) as context:
            select_device(RUNTIMES, "iOS", os_filter="17.5")
        self.assertIn("iOS 17.5", str(context.exception))
        self.assertIn("18.5, 26.5", str(context.exception))

    def test_device_filter_exact_name(self):
        selected = select_device(RUNTIMES, "iOS", device_filter="iPhone 17 Pro")
        self.assertEqual(selected["udid"], "UDID-IPHONE-17-PRO-26-5")

    def test_device_filter_matches_ipad(self):
        selected = select_device(RUNTIMES, "iOS", device_filter="iPad Pro 11-inch (M4)")
        self.assertEqual(selected["udid"], "UDID-IPAD-M4-18-5")

    def test_device_filter_prefers_newest_runtime_with_that_device(self):
        both_runtimes = {
            "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
                {"name": "iPhone 16 Pro", "udid": "UDID-OLD"},
            ],
            "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
                {"name": "iPhone 16 Pro", "udid": "UDID-NEW"},
            ],
        }
        selected = select_device(both_runtimes, "iOS", device_filter="iPhone 16 Pro")
        self.assertEqual(selected["udid"], "UDID-NEW")

    def test_device_and_os_filters_combined(self):
        selected = select_device(RUNTIMES, "iOS", os_filter="18.x", device_filter="iPhone 16 Pro")
        self.assertEqual(selected["udid"], "UDID-IPHONE-16-PRO-18-5")

    def test_device_filter_unknown_device(self):
        with self.assertRaises(SelectionError) as context:
            select_device(RUNTIMES, "iOS", device_filter="iPhone 4S")
        self.assertIn("device 'iPhone 4S'", str(context.exception))

    def test_other_platform(self):
        selected = select_device(RUNTIMES, "tvOS", device_filter="Apple TV 4K (3rd generation)")
        self.assertEqual(selected["udid"], "UDID-APPLE-TV-26-5")
        self.assertEqual(selected["destination"], "platform=tvOS Simulator,id=UDID-APPLE-TV-26-5")

    def test_ios_selection_ignores_other_platform_runtimes(self):
        tvos_only = {
            "com.apple.CoreSimulator.SimRuntime.tvOS-26-5": [
                {"name": "Apple TV 4K (3rd generation)", "udid": "UDID-APPLE-TV-26-5"},
            ],
        }
        with self.assertRaises(SelectionError):
            select_device(tvos_only, "iOS")

    def test_numeric_version_ordering(self):
        # 9.2 must sort below 17.5 — a lexicographic comparison would get this wrong.
        legacy_runtimes = {
            "com.apple.CoreSimulator.SimRuntime.iOS-9-2": [
                {"name": "iPhone 6s", "udid": "UDID-IPHONE-6S-9-2"},
            ],
            "com.apple.CoreSimulator.SimRuntime.iOS-17-5": [
                {"name": "iPhone 15 Pro", "udid": "UDID-IPHONE-15-PRO-17-5"},
            ],
        }
        selected = select_device(legacy_runtimes, "iOS")
        self.assertEqual(selected["udid"], "UDID-IPHONE-15-PRO-17-5")

    def test_no_devices_at_all(self):
        with self.assertRaises(SelectionError) as context:
            select_device({}, "iOS")
        self.assertIn("none", str(context.exception))


class ParseOsFilterTests(unittest.TestCase):
    def test_exact_version(self):
        self.assertEqual(parse_os_filter("26.5"), [26, 5])

    def test_wildcard(self):
        self.assertEqual(parse_os_filter("26.x"), [26, None])
        self.assertEqual(parse_os_filter("26.X"), [26, None])

    def test_invalid_component(self):
        with self.assertRaises(SelectionError):
            parse_os_filter("26.foo")

    def test_empty_component(self):
        with self.assertRaises(SelectionError):
            parse_os_filter("26.")


if __name__ == "__main__":
    unittest.main()
