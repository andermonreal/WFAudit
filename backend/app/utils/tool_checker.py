"""Check availability of required system tools."""

import shutil
import asyncio
from app.config import settings


REQUIRED_TOOLS = {
    "airmon-ng": {"package": "aircrack-ng", "critical": True},
    "airodump-ng": {"package": "aircrack-ng", "critical": True},
    "aireplay-ng": {"package": "aircrack-ng", "critical": True},
    "aircrack-ng": {"package": "aircrack-ng", "critical": True},
    "nmap": {"package": "nmap", "critical": True},
    "iwconfig": {"package": "wireless-tools", "critical": True},
    "iw": {"package": "iw", "critical": False},
    "ip": {"package": "iproute2", "critical": False},
    "hostapd": {"package": "hostapd", "critical": False},
    "dnsmasq": {"package": "dnsmasq", "critical": False},
    "mitmproxy": {"package": "mitmproxy (pip)", "critical": False},
    "iptables": {"package": "iptables", "critical": False},
    "macchanger": {"package": "macchanger", "critical": False},
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
        }
    return results


async def check_root() -> bool:
    import os
    return os.geteuid() == 0


async def get_system_info() -> dict:
    import platform
    return {
        "os": platform.system(),
        "release": platform.release(),
        "arch": platform.machine(),
        "python": platform.python_version(),
        "is_root": await check_root(),
    }
