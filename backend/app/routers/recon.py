"""API routes for network reconnaissance (nmap)."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import NmapTarget, RouterProbeRequest
from app.services.nmap_service import nmap_service

router = APIRouter(prefix="/recon", tags=["Reconnaissance"])


@router.post("/scan")
async def nmap_scan(target: NmapTarget):
    """
    Run an nmap scan with configurable profiles:
    - quick: Ping sweep (host discovery)
    - full: All ports + services + OS detection
    - vuln: Vulnerability scripts
    - os_detect: OS fingerprinting
    - service: Service version detection
    - stealth: SYN scan with fragmentation
    - udp: Top 100 UDP ports
    - custom: Your own nmap arguments
    """
    return await nmap_service.scan(target)


@router.post("/discover")
async def discover_network(cidr: str = "192.168.0.0/24"):
    """Quick ping sweep to find all live hosts on a network."""
    return await nmap_service.discover_network(cidr)


@router.post("/deep/{ip}")
async def deep_scan(ip: str):
    """Full port scan + service detection + OS fingerprinting on a single host."""
    return await nmap_service.deep_scan_host(ip)


@router.post("/vuln/{ip}")
async def vulnerability_scan(ip: str):
    """Run nmap vulnerability scripts against a host."""
    return await nmap_service.vuln_scan(ip)


@router.post("/router")
async def probe_router(req: RouterProbeRequest = None):
    """
    CTF objective: Probe the router/gateway.
    Checks HTTP, HTTPS, SSH, Telnet access and identifies model/firmware.
    """
    ip = req.target_ip if req else "192.168.0.1"
    return await nmap_service.probe_router(ip)


@router.get("/scans")
async def list_scans():
    """List all nmap scan results."""
    return nmap_service.list_scans()


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    """Get a specific nmap scan result."""
    scan = nmap_service.get_scan(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")
    return scan
