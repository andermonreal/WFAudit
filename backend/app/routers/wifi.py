"""API routes for WiFi scanning and WPA cracking (aircrack-ng suite)."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    WifiScanRequest, HandshakeCaptureRequest,
    WpaCrackRequest, DeauthRequest,
)
from app.services.aircrack_service import aircrack_service

router = APIRouter(prefix="/wifi", tags=["WiFi Audit"])


@router.post("/scan")
async def scan_networks(req: WifiScanRequest):
    """
    Scan for WiFi networks using airodump-ng.
    Returns discovered APs with security type, clients, signal strength, etc.
    Interface MUST be in monitor mode first.
    """
    return await aircrack_service.scan_networks(
        interface=req.interface,
        channel=req.channel,
        duration=req.duration,
        target_bssid=req.target_bssid,
    )


@router.post("/scan/targeted")
async def targeted_scan(interface: str, bssid: str, channel: int, duration: int = 60):
    """Focused scan on a single AP."""
    return await aircrack_service.targeted_scan(interface, bssid, channel, duration)


@router.get("/scans")
async def list_scans():
    """List all WiFi scan results."""
    return aircrack_service.list_scans()


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    """Get a specific scan result."""
    scan = aircrack_service.get_scan(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")
    return scan


@router.post("/scans/{scan_id}/stop")
async def stop_scan(scan_id: str):
    """Stop a running scan."""
    success = await aircrack_service.stop_scan(scan_id)
    return {"stopped": success}


@router.post("/handshake")
async def capture_handshake(req: HandshakeCaptureRequest):
    """
    Capture WPA/WPA2 handshake for offline cracking.
    Optionally sends deauth packets to force client re-authentication.
    """
    return await aircrack_service.capture_handshake(req)


@router.post("/crack")
async def crack_wpa(req: WpaCrackRequest):
    """
    Attempt to crack a captured WPA handshake using a wordlist.
    Default wordlist: rockyou.txt
    """
    wordlist = req.custom_wordlist_path or req.wordlist
    return await aircrack_service.crack_wpa(
        capture_file=req.capture_file,
        target_bssid=req.target_bssid,
        wordlist=wordlist,
    )


@router.post("/deauth")
async def send_deauth(req: DeauthRequest):
    """
    Send deauthentication packets to disconnect clients.
    Used to force handshake re-capture or test resilience.
    """
    return await aircrack_service.send_deauth(req)
