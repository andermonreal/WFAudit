"""Service wrapping the aircrack-ng suite."""

import os
import uuid
import glob
import asyncio
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import (
    AccessPoint, WifiScanResult, ScanStatus,
    HandshakeCaptureRequest, DeauthRequest,
)
from app.utils.process_manager import process_manager
from app.utils.parsers import parse_airodump_csv

logger = logging.getLogger(__name__)


class AircrackService:
    def __init__(self):
        self._scans: dict[str, WifiScanResult] = {}
        self._active_processes: dict[str, str] = {}  # scan_id -> proc_id

    async def scan_networks(
        self,
        interface: str,
        channel: Optional[int] = None,
        duration: int = 30,
        target_bssid: Optional[str] = None,
    ) -> WifiScanResult:
        """Run airodump-ng scan and return discovered networks."""
        scan_id = str(uuid.uuid4())[:8]
        output_prefix = str(settings.CAPTURES_DIR / f"scan_{scan_id}")

        cmd = [
            "airodump-ng",
            "--write", output_prefix,
            "--output-format", "csv",
            "--write-interval", "3",
        ]

        if channel:
            cmd.extend(["--channel", str(channel)])
        if target_bssid:
            cmd.extend(["--bssid", target_bssid])

        cmd.append(interface)

        scan = WifiScanResult(
            id=scan_id,
            status=ScanStatus.RUNNING,
            interface=interface,
            started_at=datetime.now(),
        )
        self._scans[scan_id] = scan

        # Run airodump with timeout
        managed = await process_manager.run(cmd, timeout=duration)
        self._active_processes[scan_id] = managed.id

        # Parse CSV output
        csv_files = glob.glob(f"{output_prefix}*.csv")
        if csv_files:
            aps, clients = parse_airodump_csv(csv_files[0])
            scan.access_points = aps
            scan.client_count = len(clients)
            scan.status = ScanStatus.COMPLETED
        else:
            scan.status = ScanStatus.FAILED

        scan.finished_at = datetime.now()
        return scan

    async def targeted_scan(
        self,
        interface: str,
        bssid: str,
        channel: int,
        duration: int = 60,
    ) -> WifiScanResult:
        """Focused scan on a single AP (for handshake capture prep)."""
        return await self.scan_networks(
            interface=interface,
            channel=channel,
            duration=duration,
            target_bssid=bssid,
        )

    async def capture_handshake(self, req: HandshakeCaptureRequest) -> dict:
        """
        Capture WPA handshake:
        1. Start airodump-ng on target channel/BSSID
        2. Optionally send deauth to force reconnection
        3. Wait for handshake capture
        """
        cap_id = str(uuid.uuid4())[:8]
        output_prefix = str(settings.HANDSHAKES_DIR / f"hs_{cap_id}")

        # Start capture in background
        cap_cmd = [
            "airodump-ng",
            "--bssid", req.target_bssid,
            "--channel", str(req.channel),
            "--write", output_prefix,
            "--output-format", "pcap",
            req.interface,
        ]

        cap_task = asyncio.create_task(
            process_manager.run(cap_cmd, timeout=req.timeout)
        )

        handshake_found = False

        # Send deauth if requested
        if req.deauth_first:
            await asyncio.sleep(3)  # Let capture settle
            deauth_cmd = [
                "aireplay-ng",
                "--deauth", str(req.deauth_packets),
                "-a", req.target_bssid,
                req.interface,
            ]
            deauth_result = await process_manager.run(deauth_cmd, timeout=30)
            logger.info(f"Deauth sent: {deauth_result.status}")

        cap_result = await cap_task

        # Check for handshake in cap file
        cap_files = glob.glob(f"{output_prefix}*.cap")
        if cap_files:
            check_stdout, _, rc = await process_manager.run_sync(
                ["aircrack-ng", cap_files[0]], timeout=10
            )
            handshake_found = "1 handshake" in check_stdout.lower()

        return {
            "id": cap_id,
            "handshake_captured": handshake_found,
            "capture_file": cap_files[0] if cap_files else None,
            "target_bssid": req.target_bssid,
            "channel": req.channel,
            "duration": req.timeout,
        }

    async def crack_wpa(
        self,
        capture_file: str,
        target_bssid: str,
        wordlist: str,
    ) -> dict:
        """Attempt to crack WPA handshake using aircrack-ng + wordlist."""
        # Resolve wordlist path
        if not os.path.isabs(wordlist):
            wl_path = settings.WORDLISTS_DIR / wordlist
            if not wl_path.exists():
                # Check common locations
                for common in [
                    f"/usr/share/wordlists/{wordlist}",
                    f"/usr/share/wordlists/{wordlist}.gz",
                    f"/usr/share/seclists/Passwords/{wordlist}",
                ]:
                    if os.path.exists(common):
                        wl_path = common
                        break
        else:
            wl_path = wordlist

        cmd = [
            "aircrack-ng",
            "-b", target_bssid,
            "-w", str(wl_path),
            capture_file,
        ]

        result = await process_manager.run(cmd, timeout=3600)  # 1h max

        key_found = None
        output = "\n".join(result.stdout_lines)
        match = __import__("re").search(r"KEY FOUND!\s*\[\s*(.+?)\s*\]", output)
        if match:
            key_found = match.group(1)

        return {
            "success": key_found is not None,
            "key": key_found,
            "capture_file": capture_file,
            "wordlist": str(wl_path),
            "target_bssid": target_bssid,
        }

    async def send_deauth(self, req: DeauthRequest) -> dict:
        """Send deauthentication packets."""
        cmd = [
            "aireplay-ng",
            "--deauth", str(req.packets),
            "-a", req.target_bssid,
        ]
        if req.client_mac:
            cmd.extend(["-c", req.client_mac])

        cmd.append(req.interface)
        result = await process_manager.run(cmd, timeout=30)

        return {
            "success": result.return_code == 0,
            "packets_sent": req.packets,
            "target": req.target_bssid,
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
