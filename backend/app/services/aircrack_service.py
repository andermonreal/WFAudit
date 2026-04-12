"""Service wrapping the aircrack-ng suite — enhanced with band, PNL, ESSID support."""

import os
import uuid
import glob
import asyncio
import re
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import (
    WifiScanResult, ScanStatus, WifiBand,
    HandshakeCaptureRequest, DeauthRequest, WifiScanRequest,
)
from app.utils.process_manager import process_manager
from app.utils.parsers import parse_airodump_csv, analyze_pnl

logger = logging.getLogger(__name__)


class AircrackService:
    def __init__(self):
        self._scans: dict[str, WifiScanResult] = {}
        self._active_processes: dict[str, str] = {}

    async def scan_networks(self, req: WifiScanRequest) -> WifiScanResult:
        """Run airodump-ng scan with band/channel/ESSID filtering."""
        scan_id = str(uuid.uuid4())[:8]
        output_prefix = str(settings.CAPTURES_DIR / f"scan_{scan_id}")

        cmd = [
            "airodump-ng",
            "--write", output_prefix,
            "--output-format", "csv",
            "--write-interval", "3",
            "--band", req.band.value,  # bg, a, or abg
        ]

        if req.channel:
            cmd.extend(["--channel", str(req.channel)])
        if req.target_bssid:
            cmd.extend(["--bssid", req.target_bssid])
        if req.target_essid:
            cmd.extend(["--essid", req.target_essid])

        cmd.append(req.interface)

        scan = WifiScanResult(
            id=scan_id,
            status=ScanStatus.RUNNING,
            interface=req.interface,
            band=req.band.value,
            started_at=datetime.now(),
        )
        self._scans[scan_id] = scan

        managed = await process_manager.run(cmd, timeout=req.duration)
        self._active_processes[scan_id] = managed.id

        csv_files = glob.glob(f"{output_prefix}*.csv")
        if csv_files:
            # Use first non-kismet CSV
            main_csv = [f for f in csv_files if "kismet" not in f]
            if main_csv:
                aps, clients = parse_airodump_csv(main_csv[0])
                scan.access_points = aps
                scan.clients = clients
                scan.client_count = len(clients)
                scan.status = ScanStatus.COMPLETED
            else:
                scan.status = ScanStatus.FAILED
        else:
            scan.status = ScanStatus.FAILED

        scan.capture_files = glob.glob(f"{output_prefix}*")
        scan.finished_at = datetime.now()
        return scan

    async def get_pnl_report(self, scan_id: str) -> Optional[dict]:
        """Analyze Preferred Network Lists from a completed scan."""
        scan = self._scans.get(scan_id)
        if not scan or scan.status != ScanStatus.COMPLETED:
            return None
        report = analyze_pnl(scan_id, scan.clients, scan.access_points)
        return report.model_dump()

    async def capture_handshake(self, req: HandshakeCaptureRequest) -> dict:
        """Capture WPA handshake with enhanced options."""
        cap_id = str(uuid.uuid4())[:8]
        output_prefix = str(settings.HANDSHAKES_DIR / f"hs_{cap_id}")

        cap_cmd = [
            "airodump-ng",
            "--bssid", req.target_bssid,
            "--channel", str(req.channel),
            "--write", output_prefix,
            "--output-format", "pcap",
            "--band", req.band.value,
        ]
        if req.target_essid:
            cap_cmd.extend(["--essid", req.target_essid])
        cap_cmd.append(req.interface)

        cap_task = asyncio.create_task(
            process_manager.run(cap_cmd, timeout=req.timeout)
        )

        handshake_found = False

        if req.deauth_first:
            await asyncio.sleep(3)
            deauth_cmd = [
                "aireplay-ng",
                "--deauth", str(req.deauth_packets),
                "-a", req.target_bssid,
            ]
            if req.deauth_client:
                deauth_cmd.extend(["-c", req.deauth_client])
            deauth_cmd.append(req.interface)
            await process_manager.run(deauth_cmd, timeout=30)

        await cap_task

        cap_files = glob.glob(f"{output_prefix}*.cap")
        if cap_files:
            check_stdout, _, _ = await process_manager.run_sync(
                ["aircrack-ng", cap_files[0]], timeout=10
            )
            handshake_found = "1 handshake" in check_stdout.lower()

        return {
            "id": cap_id,
            "handshake_captured": handshake_found,
            "capture_file": cap_files[0] if cap_files else None,
            "all_files": glob.glob(f"{output_prefix}*"),
            "target_bssid": req.target_bssid,
            "target_essid": req.target_essid,
            "channel": req.channel,
        }

    async def crack_wpa(self, capture_file: str, target_bssid: str, wordlist: str) -> dict:
        """Crack WPA handshake with aircrack-ng."""
        if not os.path.isabs(wordlist):
            for candidate in [
                str(settings.WORDLISTS_DIR / wordlist),
                f"/usr/share/wordlists/{wordlist}",
                f"/usr/share/wordlists/{wordlist}.gz",
                f"/usr/share/seclists/Passwords/{wordlist}",
            ]:
                if os.path.exists(candidate):
                    wordlist = candidate
                    break

        cmd = ["aircrack-ng", "-b", target_bssid, "-w", str(wordlist), capture_file]
        result = await process_manager.run(cmd, timeout=3600)

        output = "\n".join(result.stdout_lines)
        match = re.search(r"KEY FOUND!\s*\[\s*(.+?)\s*\]", output)
        key = match.group(1) if match else None

        return {
            "success": key is not None,
            "key": key,
            "capture_file": capture_file,
            "wordlist": str(wordlist),
            "target_bssid": target_bssid,
        }

    async def send_deauth(self, req: DeauthRequest) -> dict:
        """Send deauth packets — supports BSSID or ESSID targeting."""
        cmd = ["aireplay-ng", "--deauth", str(req.packets)]

        if req.use_essid:
            cmd.extend(["-e", req.use_essid])
        else:
            cmd.extend(["-a", req.target_bssid])

        if req.client_mac:
            cmd.extend(["-c", req.client_mac])

        cmd.append(req.interface)
        result = await process_manager.run(cmd, timeout=60)

        return {
            "success": result.return_code == 0,
            "packets_sent": req.packets,
            "target": req.use_essid or req.target_bssid,
            "client": req.client_mac or "broadcast",
            "output": "\n".join(result.stdout_lines[-10:]),
        }

    def get_scan(self, scan_id: str) -> Optional[WifiScanResult]:
        return self._scans.get(scan_id)

    def list_scans(self) -> list[WifiScanResult]:
        return list(self._scans.values())

    async def stop_scan(self, scan_id: str) -> bool:
        proc_id = self._active_processes.get(scan_id)
        if proc_id:
            return await process_manager.cancel(proc_id)
        return False


aircrack_service = AircrackService()
