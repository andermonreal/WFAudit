"""Service wrapping nmap for network reconnaissance."""

import uuid
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import NmapScanResult, NmapScanType, NmapTarget, ScanStatus
from app.utils.process_manager import process_manager
from app.utils.parsers import parse_nmap_xml

logger = logging.getLogger(__name__)

SCAN_PROFILES = {
    NmapScanType.QUICK: "-sn",
    NmapScanType.FULL: "-sV -sC -O -p-",
    NmapScanType.VULN: "--script vuln -sV",
    NmapScanType.OS_DETECT: "-O -sV",
    NmapScanType.SERVICE: "-sV -sC",
    NmapScanType.STEALTH: "-sS -T2 -f",
    NmapScanType.UDP: "-sU --top-ports 100",
}


class NmapService:
    def __init__(self):
        self._scans: dict[str, NmapScanResult] = {}

    async def scan(self, target: NmapTarget) -> NmapScanResult:
        scan_id = str(uuid.uuid4())[:8]
        xml_output = str(settings.REPORTS_DIR / f"nmap_{scan_id}.xml")

        if target.scan_type == NmapScanType.CUSTOM and target.custom_args:
            args = target.custom_args.split()
        else:
            args = SCAN_PROFILES[target.scan_type].split()

        if target.ports:
            args.extend(["-p", target.ports])

        cmd = ["nmap"] + args + ["-oX", xml_output, target.target]

        scan = NmapScanResult(
            id=scan_id, status=ScanStatus.RUNNING, target=target.target,
            scan_type=target.scan_type, started_at=datetime.now(), command=" ".join(cmd),
        )
        self._scans[scan_id] = scan

        await process_manager.run(cmd, timeout=target.timeout)

        try:
            with open(xml_output, "r") as f:
                xml_content = f.read()
            scan.raw_xml = xml_content
            scan.hosts = parse_nmap_xml(xml_content)
            scan.status = ScanStatus.COMPLETED
        except FileNotFoundError:
            scan.status = ScanStatus.FAILED

        scan.finished_at = datetime.now()
        return scan

    async def discover_network(self, cidr: str) -> NmapScanResult:
        return await self.scan(NmapTarget(target=cidr, scan_type=NmapScanType.QUICK, timeout=120))

    async def deep_scan_host(self, ip: str) -> NmapScanResult:
        return await self.scan(NmapTarget(target=ip, scan_type=NmapScanType.FULL, timeout=600))

    async def vuln_scan(self, ip: str) -> NmapScanResult:
        return await self.scan(NmapTarget(target=ip, scan_type=NmapScanType.VULN, timeout=600))

    async def probe_router(self, ip: str = "192.168.0.1") -> dict:
        scan = await self.scan(NmapTarget(
            target=ip, scan_type=NmapScanType.SERVICE, ports="22,23,53,80,443,8080,8443", timeout=120,
        ))
        if not scan.hosts:
            return {"target": ip, "reachable": False, "scan_id": scan.id}

        host = scan.hosts[0]
        port_map = {p["port"]: p for p in host.ports}
        return {
            "target": ip, "reachable": True, "scan_id": scan.id,
            "hostname": host.hostname, "os_guess": host.os_guess, "mac": host.mac,
            "http_open": 80 in port_map and port_map[80]["state"] == "open",
            "https_open": 443 in port_map and port_map[443]["state"] == "open",
            "ssh_open": 22 in port_map and port_map[22]["state"] == "open",
            "telnet_open": 23 in port_map and port_map[23]["state"] == "open",
            "services": host.services, "all_ports": host.ports,
        }

    def get_scan(self, scan_id: str) -> Optional[NmapScanResult]:
        return self._scans.get(scan_id)

    def list_scans(self) -> list[NmapScanResult]:
        return list(self._scans.values())


nmap_service = NmapService()
