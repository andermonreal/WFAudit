"""API routes for advanced attacks: PMKID, AP-Less, Enterprise, WPA3."""
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    PmkidCaptureRequest, PmkidCrackRequest,
    ApLessAttackRequest, EnterpriseAttackRequest, Wpa3AttackRequest,
    WpsAttackRequest,
)
from app.services.pmkid_service import pmkid_service
from app.services.apless_service import apless_service
from app.services.enterprise_service import enterprise_service
from app.services.wpa3_service import wpa3_service
from app.services.wps_service import wps_service

router = APIRouter(prefix="/advanced", tags=["Advanced Attacks"])

# ── PMKID (Clientless WPA2) ──

@router.post("/pmkid/capture")
async def capture_pmkid(req: PmkidCaptureRequest):
    """Capture PMKID from AP (no clients needed). Uses hcxdumptool or airodump-ng fallback."""
    return await pmkid_service.capture_pmkid(req)

@router.post("/pmkid/crack")
async def crack_pmkid(req: PmkidCrackRequest):
    """Crack PMKID with hashcat or aircrack-ng."""
    return await pmkid_service.crack_pmkid(req)

@router.get("/pmkid/captures")
async def list_pmkid_captures():
    return pmkid_service.list_captures()

# ── AP-Less Attack (Honeypot) ──

@router.post("/apless/start")
async def start_apless(req: ApLessAttackRequest):
    """AP-less attack: Create honeypot AP to capture handshakes from probing clients. Requires 2 WiFi adapters."""
    return await apless_service.start(req)

@router.post("/apless/stop")
async def stop_apless():
    return await apless_service.stop()

@router.get("/apless/status")
async def apless_status():
    return apless_service.status()

@router.get("/apless/results")
async def list_apless_results():
    return apless_service.list_results()

# ── Enterprise (WPA2-Enterprise / 802.1X) ──

@router.post("/enterprise/start")
async def start_enterprise(req: EnterpriseAttackRequest):
    """Rogue RADIUS + Evil Twin to capture enterprise EAP credentials. Requires 2 WiFi adapters."""
    return await enterprise_service.start(req)

@router.post("/enterprise/stop")
async def stop_enterprise():
    return await enterprise_service.stop()

@router.get("/enterprise/status")
async def enterprise_status():
    return enterprise_service.status()

@router.get("/enterprise/credentials")
async def enterprise_creds():
    return enterprise_service.get_captured_creds()

# ── WPA3 Attacks ──

@router.post("/wpa3/attack")
async def wpa3_attack(req: Wpa3AttackRequest):
    """WPA3 attacks: transition_mode (check downgrade), downgrade (exploit), dos (SAE flood)."""
    return await wpa3_service.attack(req)

@router.get("/wpa3/results")
async def wpa3_results():
    return wpa3_service.list_results()

# ── WPS (reaver / bully) ──

@router.post("/wps/start")
async def start_wps(req: WpsAttackRequest):
    """WPS attack: Pixie-Dust (offline, fast) or PIN brute-force (online, slow) with reaver/bully."""
    return await wps_service.start(req)

@router.post("/wps/stop")
async def stop_wps():
    return await wps_service.stop()

@router.get("/wps/status")
async def wps_status():
    return wps_service.status()
