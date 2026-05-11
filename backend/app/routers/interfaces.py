from fastapi import APIRouter, HTTPException
from typing import Optional
from app.services.interface_service import interface_service

router = APIRouter(prefix="/interfaces", tags=["Interfaces"])

@router.get("/")
async def list_interfaces():
    return await interface_service.list_interfaces()

@router.get("/network-status")
async def network_status():
    """Report on all network interfaces and their roles (ethernet, managed wifi,
    monitor wifi). Useful to verify you have internet + a free adapter before
    starting a multi-interface attack like Evil Twin."""
    return await interface_service.network_status()

@router.get("/{name}")
async def get_interface(name: str):
    iface = await interface_service.get_interface(name)
    if not iface: raise HTTPException(404, f"Interface '{name}' not found")
    return iface

@router.post("/{name}/monitor")
async def enable_monitor(name: str, kill_conflicting: bool = False):
    """Switch interface to monitor mode.

    SAFE BY DEFAULT: kill_conflicting=False uses surgical per-interface mode
    switching that DOES NOT affect ethernet, other WiFi adapters, or NetworkManager
    globally. Your internet connection (cable or other wifi) keeps working.

    Set kill_conflicting=True only as a fallback if the surgical method fails
    (rare). The fallback uses airmon-ng which kills NetworkManager globally
    and may disconnect ethernet/other interfaces.
    """
    return await interface_service.set_monitor_mode(name, kill_conflicting)

@router.post("/{name}/managed")
async def enable_managed(name: str):
    """Return interface to managed mode without disrupting other interfaces."""
    return await interface_service.set_managed_mode(name)

@router.post("/{name}/mac")
async def change_mac(name: str, new_mac: Optional[str] = None, vendor_prefix: Optional[str] = None):
    """Change MAC: random, specific, or vendor-spoofed (e.g. vendor_prefix=00:1A:2B to mimic a vendor)."""
    return await interface_service.change_mac(name, new_mac, vendor_prefix)

@router.post("/{name}/txpower")
async def set_tx_power(name: str, power_dbm: int = 20):
    return await interface_service.set_tx_power(name, power_dbm)

@router.get("/{name}/channels")
async def get_channels(name: str):
    """List supported channels (2.4 GHz + 5 GHz) for an interface."""
    return await interface_service.get_supported_channels(name)
