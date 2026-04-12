"""Check availability of required system tools."""

import shutil
import platform
import os

REQUIRED_TOOLS = {
    "airmon-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "airodump-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "aireplay-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "aircrack-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "nmap": {"package": "nmap", "critical": True, "category": "recon"},
    "iwconfig": {"package": "wireless-tools", "critical": True, "category": "wifi"},
    "iw": {"package": "iw", "critical": False, "category": "wifi"},
    "ip": {"package": "iproute2", "critical": False, "category": "system"},
    "hostapd": {"package": "hostapd", "critical": False, "category": "attack"},
    "dnsmasq": {"package": "dnsmasq", "critical": False, "category": "attack"},
    "mitmproxy": {"package": "mitmproxy (pip)", "critical": False, "category": "attack"},
    "mitmdump": {"package": "mitmproxy (pip)", "critical": False, "category": "attack"},
    "iptables": {"package": "iptables", "critical": False, "category": "system"},
    "macchanger": {"package": "macchanger", "critical": False, "category": "wifi"},
    "arpspoof": {"package": "dsniff", "critical": False, "category": "attack"},
    "hcxdumptool": {"package": "hcxdumptool", "critical": False, "category": "pmkid"},
    "hcxpcapngtool": {"package": "hcxtools", "critical": False, "category": "pmkid"},
    "hashcat": {"package": "hashcat", "critical": False, "category": "crack"},
    "freeradius": {"package": "freeradius", "critical": False, "category": "enterprise"},
    "airgeddon": {"package": "airgeddon (git)", "critical": False, "category": "suite"},
    "wpa_supplicant": {"package": "wpasupplicant", "critical": False, "category": "wifi"},
    "tcpdump": {"package": "tcpdump", "critical": False, "category": "capture"},
    "tshark": {"package": "tshark (wireshark-cli)", "critical": False, "category": "capture"},
    "ettercap": {"package": "ettercap-text-only", "critical": False, "category": "attack"},
    "reaver": {"package": "reaver", "critical": False, "category": "wps"},
    "bully": {"package": "bully", "critical": False, "category": "wps"},
    "crunch": {"package": "crunch", "critical": False, "category": "wordlist"},
    "cewl": {"package": "cewl", "critical": False, "category": "wordlist"},
}


async def check_tools() -> dict:
    results = {}
    for tool, meta in REQUIRED_TOOLS.items():
        path = shutil.which(tool)
        results[tool] = {
            "installed": path is not None,
            "path": path,
            "package": meta["package"],
            "critical": meta["critical"],
            "category": meta["category"],
        }
    return results


async def check_tools_by_category() -> dict:
    tools = await check_tools()
    categories = {}
    for name, info in tools.items():
        cat = info["category"]
        if cat not in categories:
            categories[cat] = {"tools": {}, "all_installed": True}
        categories[cat]["tools"][name] = info
        if not info["installed"]:
            categories[cat]["all_installed"] = False
    return categories


async def check_root() -> bool:
    return os.geteuid() == 0


async def get_system_info() -> dict:
    return {
        "os": platform.system(),
        "release": platform.release(),
        "arch": platform.machine(),
        "python": platform.python_version(),
        "is_root": await check_root(),
        "distro": _get_distro(),
    }


def _get_distro() -> str:
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    return line.split("=", 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return "Unknown"
