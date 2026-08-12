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

platform = os.environ["PLATFORM"]
os_filter = os.environ.get("OS_FILTER", "").strip()
device_filter = os.environ.get("DEVICE_FILTER", "").strip()
runtime_marker = f".SimRuntime.{platform}-"


def parse_os_filter(template):
    parts = []
    for part in template.split("."):
        if part.lower() == "x":
            parts.append(None)
        elif part.isdigit():
            parts.append(int(part))
        else:
            sys.exit(f"Invalid os filter '{template}': each component must be a number or 'x'")
    return parts


def matches_os(version, template_parts):
    for position, expected in enumerate(template_parts):
        if expected is None:
            continue
        actual = version[position] if position < len(version) else 0
        if actual != expected:
            return False
    return True


os_parts = parse_os_filter(os_filter) if os_filter else []

runtimes = json.load(sys.stdin)["devices"]
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
    sys.exit(
        f"No available simulator matching {wanted_device} on {wanted_os}. "
        f"Installed {platform} versions with matching devices: {installed}"
    )

version, name, udid = matching[-1]
os_version = ".".join(map(str, version))
print(f"Selected {name} ({platform} {os_version}, {udid})", file=sys.stderr)

print(f"destination=platform={platform} Simulator,id={udid}")
print(f"udid={udid}")
print(f"name={name}")
print(f"os-version={os_version}")
