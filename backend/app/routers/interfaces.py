"""API routes for network interface management."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import SetModeRequest, InterfaceMode
from app.services.interface_service import interface_service

router = APIRouter(prefix="/interfaces", tags=["Interfaces"])


@router.get("/")
async def list_interfaces():
    """List all wireless network interfaces."""
    return await interface_service.list_interfaces()


@router.get("/{name}")
async def get_interface(name: str):
    """Get details of a specific interface."""
    iface = await interface_service.get_interface(name)
    if not iface:
        raise HTTPException(404, f"Interface '{name}' not found")
    return iface


@router.post("/{name}/monitor")
async def enable_monitor(name: str, kill_conflicting: bool = True):
    """Put interface into monitor mode (required for WiFi auditing)."""
    return await interface_service.set_monitor_mode(name, kill_conflicting)


@router.post("/{name}/managed")
async def enable_managed(name: str):
    """Restore interface to managed mode."""
    return await interface_service.set_managed_mode(name)


@router.post("/{name}/mac")
async def change_mac(name: str, new_mac: str = None):
    """Change or randomize MAC address."""
    return await interface_service.change_mac(name, new_mac)
