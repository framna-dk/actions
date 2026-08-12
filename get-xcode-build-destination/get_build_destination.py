"""Finds an available simulator from `simctl list devices available --json` on stdin.

Filters by the PLATFORM, OS_FILTER and DEVICE_FILTER environment variables, preferring
the newest OS version among the matches. OS_FILTER follows the same template style as
the xcode-select action: "26.5" matches exactly, "x" is a per-position wildcard
("26.x"), and positions left unspecified are wildcards ("26" behaves like "26.x").

Writes GitHub Actions output assignments (destination, udid, name, os-version) to stdout.
"""

import json
import os
import sys


class SelectionError(Exception):
    pass


def parse_os_filter(template):
    """Parses an OS filter template like "26.5" or "26.x" into a list of
    ints and Nones, where None matches any value at that position."""
    parts = []
    for part in template.split("."):
        if part.lower() == "x":
            parts.append(None)
        elif part.isdigit():
            parts.append(int(part))
        else:
            raise SelectionError(f"Invalid os filter '{template}': each component must be a number or 'x'")
    return parts


def matches_os(version, template_parts):
    for position, expected in enumerate(template_parts):
        if expected is None:
            continue
        actual = version[position] if position < len(version) else 0
        if actual != expected:
            return False
    return True


def select_generic(platform, os_filter="", device_filter=""):
    """Returns the generic simulator destination for the platform, which requires
    no installed runtime. Only valid for building, not for running tests."""
    if os_filter or device_filter:
        raise SelectionError("The 'generic' input cannot be combined with the 'os' or 'device' inputs")
    return {
        "destination": f"generic/platform={platform} Simulator",
        "udid": "",
        "name": "",
        "os-version": "",
    }


def select_device(runtimes, platform, os_filter="", device_filter=""):
    """Selects a simulator from simctl's runtime-to-devices mapping.

    Returns a dict with "destination", "udid", "name" and "os-version" keys.
    Raises SelectionError if no device matches the filters.
    """
    runtime_marker = f".SimRuntime.{platform}-"
    os_parts = parse_os_filter(os_filter) if os_filter else []

    devices = sorted(
        (tuple(int(part) for part in runtime.rsplit(runtime_marker, 1)[1].split("-")), device["name"], device["udid"])
        for runtime, runtime_devices in runtimes.items()
        if runtime_marker in runtime
        for device in runtime_devices
        if (device["name"] == device_filter if device_filter else device["name"].startswith("iPhone"))
    )
    matching = [entry for entry in devices if matches_os(entry[0], os_parts)]

    if not matching:
        wanted_device = f"device '{device_filter}'" if device_filter else "an iPhone"
        wanted_os = f"{platform} {os_filter}" if os_filter else f"any {platform} version"
        installed = ", ".join(sorted({".".join(map(str, entry[0])) for entry in devices})) or "none"
        raise SelectionError(
            f"No available simulator matching {wanted_device} on {wanted_os}. "
            f"Installed {platform} versions with matching devices: {installed}"
        )

    version, name, udid = matching[-1]
    return {
        "destination": f"platform={platform} Simulator,id={udid}",
        "udid": udid,
        "name": name,
        "os-version": ".".join(map(str, version)),
    }


def main():
    platform = os.environ["PLATFORM"]
    os_filter = os.environ.get("OS_FILTER", "").strip()
    device_filter = os.environ.get("DEVICE_FILTER", "").strip()
    generic = os.environ.get("GENERIC", "").strip().lower()

    if generic not in ("", "true", "false"):
        sys.exit(f"Invalid generic input '{generic}': must be 'true' or 'false'")

    try:
        if generic == "true":
            selected = select_generic(platform, os_filter, device_filter)
            print(f"Using generic {platform} Simulator destination", file=sys.stderr)
        else:
            runtimes = json.load(sys.stdin)["devices"]
            selected = select_device(runtimes, platform, os_filter, device_filter)
            print(f"Selected {selected['name']} ({platform} {selected['os-version']}, {selected['udid']})", file=sys.stderr)
    except SelectionError as error:
        sys.exit(str(error))

    for key, value in selected.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
