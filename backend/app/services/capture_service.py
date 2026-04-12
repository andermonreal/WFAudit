"""Manage capture files (.cap, .csv, .pcapng, .22000, etc.)."""

import os
import glob
import re
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import CaptureFile
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)

CAPTURE_DIRS = [settings.CAPTURES_DIR, settings.HANDSHAKES_DIR, settings.PMKID_DIR]


class CaptureService:
    async def list_captures(self, directory: Optional[str] = None) -> list[CaptureFile]:
        """List all capture files across all data directories."""
        files = []
        dirs = [directory] if directory else [str(d) for d in CAPTURE_DIRS]

        for d in dirs:
            for pattern in ["*.cap", "*.pcap", "*.pcapng", "*.csv", "*.kismet.csv",
                            "*.kismet.netxml", "*.log.csv", "*.22000", "*.hc22000"]:
                for fp in glob.glob(os.path.join(d, pattern)):
                    stat = os.stat(fp)
                    fname = os.path.basename(fp)
                    ext = fname.split(".", 1)[1] if "." in fname else "unknown"

                    # Try to extract target ESSID from filename
                    essid = None
                    match = re.match(r"^(.+?)-\d+\.", fname)
                    if match:
                        essid = match.group(1).replace("_", " ")

                    files.append(CaptureFile(
                        filename=fname,
                        filepath=fp,
                        file_type=ext,
                        size_bytes=stat.st_size,
                        created_at=datetime.fromtimestamp(stat.st_ctime),
                        target_essid=essid,
                        has_handshake=False,
                        has_pmkid=False,
                    ))

        return sorted(files, key=lambda f: f.created_at or datetime.min, reverse=True)

    async def check_handshake(self, filepath: str) -> dict:
        """Check if a capture file contains a WPA handshake or PMKID."""
        stdout, _, rc = await process_manager.run_sync(
            ["aircrack-ng", filepath], timeout=15
        )
        out_lower = stdout.lower()
        return {
            "filepath": filepath,
            "has_handshake": "1 handshake" in out_lower,
            "has_pmkid": "pmkid" in out_lower,
            "networks_found": stdout.count("WPA (") + stdout.count("WPA2"),
            "raw_output": stdout[:500],
        }

    async def delete_capture(self, filepath: str) -> dict:
        """Delete a capture file."""
        # Security: only allow deletion within our data dirs
        abs_path = os.path.abspath(filepath)
        allowed = any(abs_path.startswith(str(d)) for d in CAPTURE_DIRS)
        if not allowed:
            return {"deleted": False, "error": "Path not in allowed directories"}
        try:
            os.remove(abs_path)
            return {"deleted": True, "filepath": abs_path}
        except FileNotFoundError:
            return {"deleted": False, "error": "File not found"}

    async def merge_captures(self, filepaths: list[str], output_name: str) -> dict:
        """Merge multiple cap files into one using mergecap."""
        output_path = str(settings.CAPTURES_DIR / output_name)
        cmd = ["mergecap", "-w", output_path] + filepaths
        result = await process_manager.run_sync(cmd, timeout=30)
        return {
            "success": result[2] == 0,
            "output": output_path,
            "merged_count": len(filepaths),
        }


capture_service = CaptureService()
