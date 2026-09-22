"""Check availability of required system tools."""

import shutil
import platform
import os
import socket
import getpass
import time

try:
    import psutil
except ImportError:  # pragma: no cover
    psutil = None

REQUIRED_TOOLS = {
    "airmon-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "airodump-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "aireplay-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "aircrack-ng": {"package": "aircrack-ng", "critical": True, "category": "wifi"},
    "nmap": {"package": "nmap", "critical": True, "category": "recon"},
    "arp-scan": {"package": "arp-scan", "critical": False, "category": "recon"},
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


def _cpu_model() -> str:
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.lower().startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or "—"


async def get_system_info() -> dict:
    info = {
        "os": platform.system(),
        "distro": _get_distro(),
        "hostname": socket.gethostname(),
        "kernel": platform.release(),
        "release": platform.release(),
        "arch": platform.machine(),
        "python": platform.python_version(),
        "python_version": platform.python_version(),
        "user": getpass.getuser(),
        "is_root": await check_root(),
        "cpu_model": _cpu_model(),
    }
    if psutil is not None:
        try:
            vm = psutil.virtual_memory()
            du = psutil.disk_usage("/")
            info.update({
                "cpu_count": psutil.cpu_count(logical=True),
                "cpu_count_physical": psutil.cpu_count(logical=False),
                "cpu_percent": psutil.cpu_percent(interval=0.15),
                "memory_total_gb": round(vm.total / 1e9, 2),
                "memory_used_gb": round(vm.used / 1e9, 2),
                "memory_available_gb": round(vm.available / 1e9, 2),
                "memory_percent": vm.percent,
                "disk_total_gb": round(du.total / 1e9, 2),
                "disk_used_gb": round(du.used / 1e9, 2),
                "disk_percent": du.percent,
                "uptime_seconds": int(time.time() - psutil.boot_time()),
            })
        except Exception:
            pass
    try:
        info["load_avg"] = [round(x, 2) for x in os.getloadavg()]
    except Exception:
        info["load_avg"] = None
    return info


def _get_distro() -> str:
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    return line.split("=", 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return "Unknown"
