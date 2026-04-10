"""API routes for attack vectors (Evil Twin, MITM)."""

from fastapi import APIRouter
from app.models.schemas import EvilTwinRequest, MitmRequest
from app.services.evil_twin_service import evil_twin_service
from app.services.mitm_service import mitm_service

router = APIRouter(prefix="/attacks", tags=["Attack Vectors"])


# ── Evil Twin ──

@router.post("/evil-twin/start")
async def start_evil_twin(req: EvilTwinRequest):
    """
    Start an Evil Twin access point cloning the target ESSID.
    Creates a rogue AP with the same name to capture client connections.
    Optionally enables captive portal and internet forwarding.
    """
    return await evil_twin_service.start(req)


@router.post("/evil-twin/stop")
async def stop_evil_twin():
    """Stop the Evil Twin and clean up iptables/processes."""
    return await evil_twin_service.stop()


@router.get("/evil-twin/status")
async def evil_twin_status():
    """Check if an Evil Twin is currently active."""
    return evil_twin_service.status()


# ── MITM ──

@router.post("/mitm/start")
async def start_mitm(req: MitmRequest):
    """
    Start Man-in-the-Middle attack:
    - ARP spoofs target IPs
    - Redirects traffic through mitmproxy
    - Captures HTTP(S) flows
    """
    return await mitm_service.start(req)


@router.post("/mitm/stop")
async def stop_mitm():
    """Stop MITM and clean up."""
    return await mitm_service.stop()


@router.get("/mitm/status")
async def mitm_status():
    """Check if MITM is currently active."""
    return mitm_service.status()
