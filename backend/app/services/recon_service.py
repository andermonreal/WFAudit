"""Reconocimiento de red con mapa persistente y escaneos en segundo plano.

Mantiene UN mapa de red persistente en disco (RECON_DIR/network_map.json):

  - Descubrimiento de hosts activos: se elige automáticamente la herramienta
    (arp-scan en la LAN — L2, rápido y no lo filtran los firewalls; nmap -sn si
    el rango no es local o arp-scan no está disponible).
  - Por cada host se ACUMULAN los resultados de varios escaneos de puertos:
        stealth (silencioso, -sS -p-)
        full    (completo: -sS -sV -sC -O -p- --script vuln)
        udp     (-sU --top-ports 100 -sV -sC)
  - Los escaneos corren en segundo plano (asyncio.create_task) y el mapa se
    persiste en cada cambio, así que sobrevive a cambios de pestaña y reinicios.

Hay un único mapa activo. Al reiniciar el backend, los escaneos que quedaran
"running" se marcan como interrumpidos (sus procesos ya no existen).
"""
import asyncio
import ipaddress
import json
import logging
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config import settings
from app.utils.parsers import parse_nmap_xml
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)

MAP_FILE = settings.RECON_DIR / "network_map.json"

# Perfiles de escaneo de puertos (los flags los pidió el usuario).
SCAN_PROFILES = {
    "stealth": ["-sS", "-p-", "-T4"],
    "full":    ["-sS", "-sV", "-sC", "-O", "-p-", "--script", "vuln", "-T4"],
    "udp":     ["-sU", "--top-ports", "100", "-sV", "-sC", "-T4"],
}
SCAN_LABELS = {"stealth": "Silencioso", "full": "Completo", "udp": "UDP"}
SCAN_TIMEOUTS = {"stealth": 1800, "full": 5400, "udp": 1800}


def _now() -> str:
    return datetime.now().isoformat()


class ReconService:
    def __init__(self):
        self._bg: set = set()
        self._load()

    # ─────────────────────────── persistencia ───────────────────────────
    def _default_legend(self) -> dict:
        # color -> significado (editable por el usuario). Ejemplos por defecto.
        return {"#ee5253": "Comprometido", "#1dd1a1": "Siguiente objetivo"}

    def _blank(self) -> dict:
        return {
            "id": str(uuid.uuid4())[:8],
            "cidr": None,
            "gateway": None,
            "discovering": False,
            "discover_via": None,
            "legend": self._default_legend(),
            "created_at": _now(),
            "updated_at": _now(),
            "hosts": {},
        }

    def _load(self):
        self._map = self._blank()
        try:
            if MAP_FILE.exists():
                self._map = json.loads(MAP_FILE.read_text())
                # los procesos no sobreviven a un reinicio
                self._map["discovering"] = False
                self._map.setdefault("gateway", None)
                self._map.setdefault("legend", self._default_legend())
                for h in self._map.get("hosts", {}).values():
                    for sc in h.get("scans", {}).values():
                        if sc.get("status") == "running":
                            sc["status"] = "failed"
                            sc["error"] = "Interrumpido (reinicio del backend)"
                logger.info("Recon map rehydrated (%d hosts)", len(self._map.get("hosts", {})))
        except Exception as e:
            logger.warning("No se pudo cargar el mapa de recon: %s", e)
            self._map = self._blank()

    def _touch(self):
        self._map["updated_at"] = _now()

    def _persist(self):
        try:
            settings.RECON_DIR.mkdir(parents=True, exist_ok=True)
            MAP_FILE.write_text(json.dumps(self._map, indent=2, default=str))
        except Exception as e:
            logger.error("No se pudo persistir el mapa de recon: %s", e)

    def _launch(self, coro):
        """Lanza una corrutina en segundo plano manteniendo la referencia."""
        t = asyncio.create_task(coro)
        self._bg.add(t)
        t.add_done_callback(self._bg.discard)

    # ─────────────────────────── consulta ───────────────────────────
    def get_map(self) -> dict:
        return self._map

    # ─────────────────────────── hosts ───────────────────────────
    def _ensure_host(self, ip: str, via: str = "scan") -> dict:
        ent = self._map["hosts"].get(ip)
        if not ent:
            ent = {
                "ip": ip, "mac": None, "vendor": None, "hostname": None,
                "discovered_via": via, "discovered_at": _now(), "scans": {},
                "label": "", "notes": "", "color": None, "x": None, "y": None,
            }
            self._map["hosts"][ip] = ent
        return ent

    def update_host(self, ip: str, updates: dict) -> dict:
        """Edita etiqueta/notas/color/posición de un host (para el grafo y las notas)."""
        ent = self._map["hosts"].get(ip)
        if not ent:
            return {"error": "Host no encontrado"}
        for k in ("label", "notes", "color", "x", "y"):
            if k in updates and updates[k] is not None:
                ent[k] = updates[k]
        self._touch()
        self._persist()
        return ent

    def add_host(self, ip: str) -> dict:
        ip = (ip or "").strip()
        if not ip:
            return {"error": "IP vacía"}
        ent = self._ensure_host(ip, via="manual")
        self._touch()
        self._persist()
        return ent

    def remove_host(self, ip: str) -> dict:
        self._map["hosts"].pop(ip, None)
        self._touch()
        self._persist()
        return {"deleted": True}

    def clear_map(self) -> dict:
        self._map = self._blank()
        self._persist()
        return self._map

    def update_legend(self, legend: dict) -> dict:
        """Guarda la leyenda de colores (color -> significado)."""
        self._map["legend"] = {str(k): str(v) for k, v in (legend or {}).items() if str(v).strip()}
        self._touch()
        self._persist()
        return self._map["legend"]

    # ─────────────────────────── descubrimiento ───────────────────────────
    def _local_networks(self) -> list:
        nets = []
        try:
            import psutil
            for _name, addrs in psutil.net_if_addrs().items():
                for a in addrs:
                    if getattr(a.family, "name", "") == "AF_INET" and a.address and a.netmask:
                        if a.address.startswith("127."):
                            continue
                        try:
                            nets.append(ipaddress.ip_network(f"{a.address}/{a.netmask}", strict=False))
                        except Exception:
                            pass
        except Exception:
            pass
        return nets

    def _pick_tool(self, cidr: str) -> str:
        """arp-scan si el rango es local (L2) y está disponible; nmap si no."""
        if not (shutil.which("arp-scan") or Path("/usr/sbin/arp-scan").exists()):
            return "nmap"
        try:
            net = ipaddress.ip_network(cidr, strict=False)
        except Exception:
            return "nmap"  # IP suelta o rango raro → nmap
        for ln in self._local_networks():
            try:
                if net.overlaps(ln):
                    return "arp-scan"
            except Exception:
                pass
        return "nmap"

    def _parse_arpscan(self, out: str) -> list:
        import re
        hosts = []
        rx = re.compile(r"^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s*(.*)$")
        for line in out.splitlines():
            m = rx.match(line.strip())
            if m:
                hosts.append({
                    "ip": m.group(1),
                    "mac": m.group(2).lower(),
                    "vendor": (m.group(3) or "").strip() or None,
                    "hostname": None,
                })
        return hosts

    async def _nmap_discover(self, cidr: str) -> list:
        scan_id = str(uuid.uuid4())[:8]
        xml = str(settings.RECON_DIR / f"disc_{scan_id}.xml")
        await process_manager.run(["nmap", "-sn", "-oX", xml, cidr], timeout=180)
        parsed = []
        try:
            parsed = parse_nmap_xml(Path(xml).read_text())
        except FileNotFoundError:
            parsed = []
        finally:
            try:
                Path(xml).unlink()
            except Exception:
                pass
        return [{"ip": h.ip, "mac": h.mac, "vendor": None, "hostname": h.hostname}
                for h in parsed if h.ip]

    def _merge_hosts(self, found: list, via: str):
        for h in found:
            ip = (h.get("ip") or "").strip()
            if not ip:
                continue
            # _ensure_host conserva escaneos, etiqueta, notas, color y posición
            ent = self._ensure_host(ip, via=via)
            for k in ("mac", "vendor", "hostname"):
                if h.get(k) and not ent.get(k):
                    ent[k] = h[k]

    def discover(self, cidr: str) -> dict:
        cidr = (cidr or "").strip()
        if not cidr:
            return {"error": "CIDR vacío"}
        self._map["cidr"] = cidr
        self._map["discovering"] = True
        self._touch()
        self._persist()
        self._launch(self._do_discover(cidr))
        return self._map

    async def _detect_gateway(self) -> Optional[str]:
        try:
            out, _, _ = await process_manager.run_sync(["ip", "route", "show", "default"], timeout=4)
            m = re.search(r"default via (\d+\.\d+\.\d+\.\d+)", out or "")
            return m.group(1) if m else None
        except Exception:
            return None

    async def _do_discover(self, cidr: str):
        gw = await self._detect_gateway()
        if gw:
            self._map["gateway"] = gw
        via = self._pick_tool(cidr)
        found = []
        try:
            if via == "arp-scan":
                binp = shutil.which("arp-scan") or "/usr/sbin/arp-scan"
                m = await process_manager.run(
                    [binp, "--retry=2", "--timeout=300", cidr], timeout=180)
                found = self._parse_arpscan("\n".join(m.stdout_lines))
                if not found:  # fallback si arp-scan no devuelve nada
                    via = "nmap"
                    found = await self._nmap_discover(cidr)
            else:
                found = await self._nmap_discover(cidr)
        except Exception as e:
            logger.warning("Descubrimiento falló: %s", e)
        self._merge_hosts(found, via)
        self._map["discover_via"] = via
        self._map["discovering"] = False
        self._touch()
        self._persist()

    # ─────────────────────────── escaneo de puertos ───────────────────────────
    def scan_host(self, ip: str, scan_type: str) -> dict:
        ip = (ip or "").strip()
        if not ip:
            return {"error": "IP vacía"}
        if scan_type not in SCAN_PROFILES:
            return {"error": "Tipo de escaneo inválido"}
        ent = self._ensure_host(ip)
        ent["scans"][scan_type] = {
            "type": scan_type, "label": SCAN_LABELS[scan_type], "status": "running",
            "command": None, "started_at": _now(), "finished_at": None,
            "ports": [], "os": None, "error": None,
        }
        self._touch()
        self._persist()
        self._launch(self._do_scan(ip, scan_type))
        return ent

    async def _do_scan(self, ip: str, scan_type: str):
        scan_id = str(uuid.uuid4())[:8]
        xml = str(settings.RECON_DIR / f"scan_{scan_id}.xml")
        cmd = ["nmap"] + SCAN_PROFILES[scan_type] + ["-oX", xml, ip]

        ent = self._map["hosts"].get(ip)
        if ent and scan_type in ent.get("scans", {}):
            ent["scans"][scan_type]["command"] = " ".join(cmd)
            self._persist()

        try:
            await process_manager.run(cmd, timeout=SCAN_TIMEOUTS[scan_type])
            parsed = []
            try:
                parsed = parse_nmap_xml(Path(xml).read_text())
            except FileNotFoundError:
                parsed = []

            ent = self._map["hosts"].get(ip)
            if ent is None:
                return
            sc = ent["scans"].get(scan_type)
            if sc is None:
                return

            host_obj = next((x for x in parsed if x.ip == ip), parsed[0] if parsed else None)
            if host_obj is None:
                sc["status"] = "failed"
                sc["error"] = "El host no respondió al escaneo"
            else:
                svc_by_port = {s["port"]: s for s in host_obj.services}
                ports = []
                for p in host_obj.ports:
                    sp = svc_by_port.get(p["port"], {})
                    ports.append({
                        "port": p["port"],
                        "protocol": p.get("protocol", "tcp"),
                        "state": p.get("state", ""),
                        "service": p.get("service") or sp.get("name", ""),
                        "product": sp.get("product", ""),
                        "version": sp.get("version", ""),
                        "extra": sp.get("extra", ""),
                        "scripts": p.get("scripts") or {},
                    })
                sc["ports"] = ports
                sc["os"] = host_obj.os_guess
                sc["status"] = "completed"
                if host_obj.hostname and not ent.get("hostname"):
                    ent["hostname"] = host_obj.hostname
                if host_obj.mac and not ent.get("mac"):
                    ent["mac"] = host_obj.mac
            sc["finished_at"] = _now()
        except Exception as e:
            ent = self._map["hosts"].get(ip)
            if ent and scan_type in ent.get("scans", {}):
                sc = ent["scans"][scan_type]
                sc["status"] = "failed"
                sc["error"] = str(e)
                sc["finished_at"] = _now()
        finally:
            try:
                Path(xml).unlink()
            except Exception:
                pass
            self._touch()
            self._persist()


recon_service = ReconService()
