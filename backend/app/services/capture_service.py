"""Manage capture files (.cap, .csv, .pcapng, .22000, etc.).

CRITICAL FIX: Directory scanning is now RECURSIVE using os.walk() instead of
glob.glob() (which is shallow). This way:
  - Files in any subdirectory of the data dirs are detected
  - Per-session subdirectories (captures/{session_id}/...) work correctly
  - All existing files on disk are visible after a PC restart

Also adds optional session_id filtering so the frontend can show only files
belonging to the active audit session.
"""

import os
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from app.config import settings
from app.models.schemas import CaptureFile
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)

CAPTURE_DIRS = [settings.CAPTURES_DIR, settings.HANDSHAKES_DIR, settings.PMKID_DIR]

# Recognized extensions
VALID_EXTENSIONS = {
    ".cap", ".pcap", ".pcapng",
    ".csv", ".netxml",
    ".22000", ".hc22000", ".hccapx",
    ".log", ".txt", ".json", ".xml", ".flow",
}


class CaptureService:
    def __init__(self):
        # caché de análisis por (ruta, mtime, tamaño) para no re-verificar en cada listado
        self._hs_cache: dict = {}

    async def _analyze_capture(self, fp, primary_ext: str, mtime: float, size: int):
        """Devuelve (has_handshake, has_pmkid) para un fichero de captura.

        - Formatos hash (.22000/.16800/.hccapx): por extensión.
        - Capturas (.cap/.pcap/.pcapng): con aircrack-ng, cacheado.
        - El resto (.csv, .netxml, .log, .txt, .json…): no son crackeables → (False, False).
        """
        if primary_ext in (".22000", ".16800", ".hc22000"):
            return (False, True)
        if primary_ext == ".hccapx":
            return (True, False)
        if primary_ext in (".cap", ".pcap", ".pcapng"):
            key = (str(fp), mtime, size)
            if key in self._hs_cache:
                return self._hs_cache[key]
            try:
                r = await self.check_handshake(str(fp))
                res = (bool(r.get("has_handshake")), bool(r.get("has_pmkid")))
            except Exception:
                res = (False, False)
            self._hs_cache[key] = res
            return res
        return (False, False)

    async def list_captures(
        self,
        directory: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> list[CaptureFile]:
        """List all capture files RECURSIVELY across all data directories.

        Args:
            directory: optional specific directory to scan (else all data dirs)
            session_id: optional filter — only files in subdirs named after
                        this session id, OR files with sidecar .meta.json
                        referencing this session.
        """
        files: list[CaptureFile] = []
        dirs = [Path(directory)] if directory else [Path(d) for d in CAPTURE_DIRS]

        for base in dirs:
            if not base.exists():
                continue
            # RECURSIVE walk — finds files in subdirectories (e.g. per-session)
            for root, _, fnames in os.walk(base):
                root_path = Path(root)
                for fname in fnames:
                    fp = root_path / fname
                    ext = "".join(fp.suffixes).lower()  # handles .kismet.csv etc
                    primary_ext = fp.suffix.lower()
                    if primary_ext not in VALID_EXTENSIONS:
                        # Allow combined extensions like .kismet.csv
                        if not any(fname.lower().endswith(e) for e in VALID_EXTENSIONS):
                            continue

                    try:
                        stat = fp.stat()
                    except (OSError, FileNotFoundError):
                        continue

                    # Detect session_id from path or sidecar .meta.json
                    detected_session = self._detect_session(fp, base)

                    # Filter by session_id if requested
                    if session_id and detected_session != session_id:
                        continue

                    # Try to extract target ESSID from filename
                    essid = None
                    match = re.match(r"^(.+?)-\d+\.", fname)
                    if match:
                        essid = match.group(1).replace("_", " ")

                    hs, pk = await self._analyze_capture(fp, primary_ext, stat.st_mtime, stat.st_size)
                    files.append(CaptureFile(
                        filename=fname,
                        filepath=str(fp),
                        file_type=primary_ext.lstrip(".") or "unknown",
                        size_bytes=stat.st_size,
                        created_at=datetime.fromtimestamp(stat.st_ctime),
                        target_essid=essid,
                        has_handshake=hs,
                        has_pmkid=pk,
                    ))

        # Newest first
        files.sort(key=lambda f: f.created_at or datetime.min, reverse=True)
        return files

    def _detect_session(self, fp: Path, base: Path) -> Optional[str]:
        """Determine if a capture belongs to a session.

        Strategy:
          1. If file is in a subdirectory whose name looks like a session id
             (8-char hex, matches our session id format) → that's the session.
          2. If a sidecar file <name>.meta.json exists, read session_id from it.
        """
        try:
            rel = fp.relative_to(base)
            parts = rel.parts
            # If file is in a subdirectory, check the first dir name
            if len(parts) > 1:
                first = parts[0]
                # Session ids are 8-char hex (uuid prefix)
                if re.match(r"^[0-9a-f]{8}$", first):
                    return first
        except ValueError:
            pass

        # Try sidecar .meta.json
        meta_path = fp.with_suffix(fp.suffix + ".meta.json")
        if meta_path.exists():
            try:
                import json as _json
                with open(meta_path) as f:
                    meta = _json.load(f)
                return meta.get("session_id")
            except Exception:
                pass
        return None

    async def write_session_metadata(self, filepath: str, session_id: str,
                                     extra: Optional[dict] = None) -> dict:
        """Attach session metadata to a capture file via sidecar JSON.

        Called by capture-creating services (handshake, pmkid, etc.) when an
        active session_id is provided.
        """
        import json as _json
        fp = Path(filepath)
        if not fp.exists():
            return {"success": False, "error": "File not found"}
        meta = {"session_id": session_id, "tagged_at": datetime.now().isoformat()}
        if extra:
            meta.update(extra)
        meta_path = fp.with_suffix(fp.suffix + ".meta.json")
        try:
            with open(meta_path, "w") as f:
                _json.dump(meta, f, indent=2)
            return {"success": True, "meta_file": str(meta_path)}
        except Exception as e:
            logger.error(f"Failed to write session metadata: {e}")
            return {"success": False, "error": str(e)}

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
            # Also remove sidecar metadata if present
            meta_path = abs_path + ".meta.json"
            if os.path.exists(meta_path):
                os.remove(meta_path)
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
