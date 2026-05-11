"""API routes for attack vectors — Evil Twin, MITM with real-time flow viewing."""
import os
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse
from app.models.schemas import EvilTwinRequest, MitmRequest
from app.services.evil_twin_service import evil_twin_service
from app.services.mitm_service import mitm_service

router = APIRouter(prefix="/attacks", tags=["Attack Vectors"])

@router.post("/evil-twin/start")
async def start_evil_twin(req: EvilTwinRequest):
    """Launch Evil Twin with optional deauth of legitimate AP + traffic monitoring."""
    return await evil_twin_service.start(req)

@router.post("/evil-twin/stop")
async def stop_evil_twin():
    return await evil_twin_service.stop()

@router.get("/evil-twin/status")
async def evil_twin_status():
    return evil_twin_service.status()

@router.get("/evil-twin/flows")
async def evil_twin_flows(
    limit: int = 100,
    host: Optional[str] = None,
    method: Optional[str] = None,
):
    """
    Get captured flows from clients connected to the Evil Twin.
    Shows DNS queries, TLS SNI, and HTTP requests from all connected devices.
    """
    return await evil_twin_service.get_flows(
        limit=limit, host_filter=host, method_filter=method
    )

@router.post("/evil-twin/deauth")
async def standalone_deauth(req: dict):
    """
    Standalone deauth attack — does NOT require active Evil Twin.
    
    Required: interface, target_bssid
    Optional: client_mac (specific client, default broadcast),
              packets (default 50), channel (default current)
    """
    return await evil_twin_service.standalone_deauth(
        interface=req.get("interface"),
        target_bssid=req.get("target_bssid"),
        client_mac=req.get("client_mac"),
        packets=req.get("packets", 50),
        channel=req.get("channel"),
    )

@router.post("/mitm/start")
async def start_mitm(req: MitmRequest):
    """Start MITM with bidirectional ARP spoof + optimized mitmproxy."""
    return await mitm_service.start(req)

@router.post("/mitm/stop")
async def stop_mitm():
    return await mitm_service.stop()

@router.get("/mitm/status")
async def mitm_status():
    return mitm_service.status()

@router.get("/mitm/flows")
async def mitm_flows(
    limit: int = 50,
    offset: int = 0,
    host: Optional[str] = None,
    method: Optional[str] = None,
    credentials_only: bool = False,
):
    """
    Get captured MITM flows with filtering.
    - limit: Max flows to return (default 50)
    - offset: Skip first N flows
    - host: Filter by hostname (partial match)
    - method: Filter by HTTP method (GET, POST, etc.)
    - credentials_only: Only show flows with detected credentials
    """
    return await mitm_service.get_flows(
        limit=limit, offset=offset,
        host_filter=host, method_filter=method,
        credentials_only=credentials_only,
    )

@router.get("/mitm/ca-cert")
async def mitm_ca_cert():
    """
    Get mitmproxy CA certificate info and download paths.
    Install this cert on the target device to avoid HTTPS warnings.
    """
    home = os.path.expanduser("~")
    cert_dir = os.path.join(home, ".mitmproxy")
    certs = {}
    for name, desc in [
        ("mitmproxy-ca-cert.pem", "PEM format (Android/Linux/macOS)"),
        ("mitmproxy-ca-cert.cer", "CER format (iOS/Windows)"),
        ("mitmproxy-ca-cert.p12", "PKCS12 format (Windows)"),
    ]:
        path = os.path.join(cert_dir, name)
        certs[name] = {"exists": os.path.isfile(path), "path": path, "description": desc}

    return {
        "cert_dir": cert_dir,
        "certs": certs,
        "instructions": {
            "android": "1. Download the .pem cert. 2. Settings → Security → Install certificate → CA certificate. 3. Select the file.",
            "ios": "1. Download the .cer cert via Safari. 2. Settings → Profile Downloaded → Install. 3. Settings → General → About → Certificate Trust → Enable.",
            "windows": "1. Download .cer. 2. Double-click → Install Certificate → Local Machine → Trusted Root CAs.",
            "linux": "1. Copy .pem to /usr/local/share/ca-certificates/mitmproxy.crt. 2. Run: sudo update-ca-certificates",
        },
    }

@router.get("/mitm/ca-cert/download/{format}")
async def download_ca_cert(format: str):
    """Download the CA cert. format: pem, cer, or p12."""
    home = os.path.expanduser("~")
    ext_map = {"pem": "mitmproxy-ca-cert.pem", "cer": "mitmproxy-ca-cert.cer", "p12": "mitmproxy-ca-cert.p12"}
    filename = ext_map.get(format)
    if not filename:
        return JSONResponse({"error": f"Invalid format: {format}. Use: pem, cer, p12"}, status_code=400)
    path = os.path.join(home, ".mitmproxy", filename)
    if not os.path.isfile(path):
        return JSONResponse({"error": f"Certificate not found at {path}. Run mitmdump once to generate it."}, status_code=404)
    return FileResponse(path, filename=filename)
