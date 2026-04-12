"""
OUI (Organizationally Unique Identifier) lookup for manufacturer identification.
Downloads IEEE OUI database and performs MAC address lookups.
"""

import os
import re
import logging
from typing import Optional
from app.config import settings
from app.models.schemas import OuiLookupResult

logger = logging.getLogger(__name__)

# Common OUI prefixes for quick lookup (avoids needing full DB for common vendors)
COMMON_OUI = {
    "00:1A:2B": "Ayecom Technology", "00:50:F2": "Microsoft",
    "00:0C:29": "VMware", "00:50:56": "VMware",
    "DC:A6:32": "Raspberry Pi", "B8:27:EB": "Raspberry Pi",
    "00:1E:58": "D-Link", "00:26:5A": "D-Link",
    "00:14:BF": "Linksys", "00:1C:10": "Linksys",
    "00:1F:33": "Netgear", "00:26:F2": "Netgear",
    "F8:1A:67": "TP-Link", "50:C7:BF": "TP-Link",
    "00:0F:66": "Cisco", "00:1B:D4": "Cisco",
    "00:25:00": "Apple", "3C:22:FB": "Apple", "A4:83:E7": "Apple",
    "00:1A:11": "Google", "F4:F5:D8": "Google",
    "30:B4:9E": "TP-Link", "60:E3:27": "TP-Link",
    "AC:84:C6": "TP-Link", "C0:25:E9": "TP-Link",
    "88:71:B1": "China Mobile", "00:25:9C": "Cisco-Linksys",
    "3C:37:86": "Netgear", "A0:63:91": "Netgear",
    "00:24:B2": "Netgear", "00:1E:2A": "Netgear",
    "68:7F:74": "Cisco-Linksys", "C8:D7:19": "Cisco-Linksys",
    "38:4C:4F": "Various (Huawei/Meraki)", "9C:3D:CF": "Netgear",
    "00:1F:1F": "Edimax", "00:0E:2E": "Edimax",
    "00:C0:CA": "Alfa Networks", "00:C0:A8": "GVC/Alfa",
    "00:1B:11": "D-Link", "1C:AF:F7": "D-Link",
    "B0:BE:76": "TP-Link", "EC:08:6B": "TP-Link",
    "34:E8:94": "TP-Link", "50:3E:AA": "TP-Link",
    "8C:21:0A": "TP-Link", "C4:6E:1F": "TP-Link",
    "00:1D:0F": "TP-Link", "14:CC:20": "TP-Link",
    "C0:4A:00": "TP-Link", "94:D9:B3": "TP-Link",
    "84:16:F9": "TP-Link", "70:4F:57": "TP-Link",
    "AC:CF:23": "Hi Flying Electronics",
    "B4:75:0E": "Belkin", "08:86:3B": "Belkin",
    "EC:1A:59": "Belkin", "94:10:3E": "Belkin",
    "00:11:50": "Belkin", "00:17:3F": "Belkin",
    "E4:F0:42": "Google", "F4:F5:E8": "Google",
    "54:60:09": "Google", "A4:77:33": "Google",
    "00:24:D7": "Intel", "00:13:E8": "Intel",
    "3C:A9:F4": "Intel", "68:17:29": "Intel",
    "7C:B2:7D": "Intel", "80:86:F2": "Intel",
    "8C:8D:28": "Samsung", "00:21:19": "Samsung",
    "00:26:37": "Samsung", "BC:72:B1": "Samsung",
    "F8:04:2E": "Samsung", "C0:97:27": "Samsung",
}

# Locally administered MAC address: second hex digit is odd in the first octet
# This indicates a randomized/spoofed MAC
_OUI_CACHE: dict = {}


def _is_randomized_mac(mac: str) -> bool:
    """Check if MAC is locally administered (randomized)."""
    try:
        first_byte = int(mac.split(":")[0], 16)
        return bool(first_byte & 0x02)  # Second-least significant bit of first octet
    except (ValueError, IndexError):
        return False


def _load_oui_db():
    """Load the full OUI database if available."""
    global _OUI_CACHE
    if _OUI_CACHE:
        return
    oui_path = settings.OUI_DB_PATH
    if not oui_path.exists():
        logger.info("No OUI database found at %s — using built-in lookup only", oui_path)
        return
    try:
        with open(oui_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                # Format: XX-XX-XX   (hex)   Manufacturer Name
                match = re.match(r"^\s*([0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2})\s+\(hex\)\s+(.+)$", line)
                if match:
                    oui = match.group(1).replace("-", ":").upper()
                    vendor = match.group(2).strip()
                    _OUI_CACHE[oui] = vendor
        logger.info("Loaded %d OUI entries from database", len(_OUI_CACHE))
    except Exception as e:
        logger.error("Error loading OUI database: %s", e)


def lookup_manufacturer(mac: str) -> OuiLookupResult:
    """Look up the manufacturer for a MAC address."""
    mac = mac.upper().strip()
    oui = mac[:8]  # First 3 octets: "XX:XX:XX"
    is_rand = _is_randomized_mac(mac)

    # Try common lookup first
    vendor = COMMON_OUI.get(oui)

    # Try full DB
    if not vendor:
        _load_oui_db()
        vendor = _OUI_CACHE.get(oui)

    if is_rand and not vendor:
        vendor = "Randomized MAC"

    return OuiLookupResult(
        mac=mac,
        oui=oui,
        manufacturer=vendor,
        is_randomized=is_rand,
    )


def enrich_manufacturer(mac: str) -> Optional[str]:
    """Quick helper that returns just the manufacturer string."""
    result = lookup_manufacturer(mac)
    return result.manufacturer


async def download_oui_db() -> dict:
    """Download the IEEE OUI database."""
    import asyncio
    oui_path = str(settings.OUI_DB_PATH)
    proc = await asyncio.create_subprocess_exec(
        "wget", "-q", "-O", oui_path,
        "http://standards-oui.ieee.org/oui/oui.txt",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    success = proc.returncode == 0
    if success:
        global _OUI_CACHE
        _OUI_CACHE = {}  # Force reload
    return {"success": success, "path": oui_path, "error": stderr.decode() if not success else None}
