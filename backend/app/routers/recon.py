from fastapi import APIRouter, HTTPException
from app.models.schemas import NmapTarget, RouterProbeRequest
from app.services.nmap_service import nmap_service

router = APIRouter(prefix="/recon", tags=["Reconnaissance"])

@router.post("/scan")
async def nmap_scan(target: NmapTarget):
    return await nmap_service.scan(target)

@router.post("/discover")
async def discover_network(cidr: str = "192.168.0.0/24"):
    return await nmap_service.discover_network(cidr)

@router.post("/deep/{ip}")
async def deep_scan(ip: str):
    return await nmap_service.deep_scan_host(ip)

@router.post("/vuln/{ip}")
async def vulnerability_scan(ip: str):
    return await nmap_service.vuln_scan(ip)

@router.post("/router")
async def probe_router(req: RouterProbeRequest = None):
    return await nmap_service.probe_router(req.target_ip if req else "192.168.0.1")

@router.get("/scans")
async def list_scans():
    return nmap_service.list_scans()

@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    s = nmap_service.get_scan(scan_id)
    if not s: raise HTTPException(404, "Scan not found")
    return s
