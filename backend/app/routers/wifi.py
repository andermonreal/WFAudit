from fastapi import APIRouter, HTTPException
from app.models.schemas import WifiScanRequest, HandshakeCaptureRequest, WpaCrackRequest, DeauthRequest
from app.services.aircrack_service import aircrack_service

router = APIRouter(prefix="/wifi", tags=["WiFi Audit"])

@router.post("/scan")
async def scan_networks(req: WifiScanRequest):
    """Scan WiFi networks. Supports 2.4 GHz (bg), 5 GHz (a), or dual-band (abg)."""
    return await aircrack_service.scan_networks(req)

@router.get("/scans")
async def list_scans():
    return aircrack_service.list_scans()

@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    s = aircrack_service.get_scan(scan_id)
    if not s: raise HTTPException(404, "Scan not found")
    return s

@router.post("/scans/{scan_id}/stop")
async def stop_scan(scan_id: str):
    return {"stopped": await aircrack_service.stop_scan(scan_id)}

@router.get("/scans/{scan_id}/pnl")
async def get_pnl_report(scan_id: str):
    """Analyze Preferred Network Lists from client probes in a scan. Identifies evil twin candidates."""
    r = await aircrack_service.get_pnl_report(scan_id)
    if not r: raise HTTPException(404, "Scan not found or not completed")
    return r

@router.post("/handshake")
async def capture_handshake(req: HandshakeCaptureRequest):
    """Capture WPA/WPA2 handshake. Supports targeting specific clients and band selection."""
    return await aircrack_service.capture_handshake(req)

@router.post("/crack")
async def crack_wpa(req: WpaCrackRequest):
    return await aircrack_service.crack_wpa(req.capture_file, req.target_bssid, req.custom_wordlist_path or req.wordlist)

@router.post("/deauth")
async def send_deauth(req: DeauthRequest):
    """Send deauth packets. Can target by BSSID or ESSID, broadcast or specific client."""
    return await aircrack_service.send_deauth(req)
