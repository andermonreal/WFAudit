"""Parsers for tool outputs (airodump CSV, nmap XML, etc.)."""

import csv
import re
import io
import xml.etree.ElementTree as ET
from typing import Optional
from datetime import datetime
from app.models.schemas import AccessPoint, SecurityType, DiscoveredHost


def parse_security(enc: str, cipher: str, auth: str) -> SecurityType:
    enc = enc.strip().upper()
    if "WPA3" in enc:
        return SecurityType.WPA3
    if "WPA2" in enc:
        return SecurityType.WPA2
    if "WPA" in enc:
        return SecurityType.WPA
    if "WEP" in enc:
        return SecurityType.WEP
    if "OPN" in enc or enc == "":
        return SecurityType.OPEN
    return SecurityType.UNKNOWN


def parse_airodump_csv(filepath: str) -> tuple[list[AccessPoint], list[dict]]:
    """
    Parse airodump-ng CSV output.
    The file has two sections separated by a blank line:
    1. Access Points
    2. Clients (stations)
    """
    access_points = []
    clients = []

    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except FileNotFoundError:
        return [], []

    # Split into AP section and client section
    sections = re.split(r"\n\s*\n", content, maxsplit=1)

    # ── Parse APs ──
    if len(sections) >= 1:
        ap_lines = sections[0].strip().split("\n")
        if ap_lines:
            # Skip header
            for line in ap_lines[1:]:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 14:
                    continue
                try:
                    bssid = parts[0]
                    if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", bssid):
                        continue

                    ap = AccessPoint(
                        bssid=bssid,
                        channel=int(parts[3]) if parts[3].strip().lstrip("-").isdigit() else 0,
                        power=int(parts[8]) if parts[8].strip().lstrip("-").isdigit() else 0,
                        beacons=int(parts[9]) if parts[9].strip().isdigit() else 0,
                        data_packets=int(parts[10]) if parts[10].strip().isdigit() else 0,
                        security=parse_security(parts[5], parts[6], parts[7]),
                        cipher=parts[6].strip() or None,
                        auth=parts[7].strip() or None,
                        essid=parts[13].strip(),
                        first_seen=_parse_dt(parts[1]),
                        last_seen=_parse_dt(parts[2]),
                    )
                    access_points.append(ap)
                except (ValueError, IndexError):
                    continue

    # ── Parse Clients ──
    if len(sections) >= 2:
        client_lines = sections[1].strip().split("\n")
        for line in client_lines[1:]:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 6:
                continue
            mac = parts[0]
            if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", mac):
                continue
            client = {
                "mac": mac,
                "bssid": parts[5].strip() if len(parts) > 5 else None,
                "power": int(parts[3]) if parts[3].strip().lstrip("-").isdigit() else 0,
                "packets": int(parts[4]) if parts[4].strip().isdigit() else 0,
                "probes": parts[6].strip() if len(parts) > 6 else "",
            }
            clients.append(client)

    # Associate clients with APs
    for client in clients:
        for ap in access_points:
            if client.get("bssid") == ap.bssid:
                ap.clients.append(client["mac"])

    return access_points, clients


def _parse_dt(s: str) -> Optional[datetime]:
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def parse_nmap_xml(xml_content: str) -> list[DiscoveredHost]:
    """Parse nmap XML output into DiscoveredHost list."""
    hosts = []
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError:
        return []

    for host_el in root.findall("host"):
        state_el = host_el.find("status")
        if state_el is not None and state_el.get("state") != "up":
            continue

        ip = ""
        mac = None
        for addr in host_el.findall("address"):
            if addr.get("addrtype") == "ipv4":
                ip = addr.get("addr", "")
            elif addr.get("addrtype") == "mac":
                mac = addr.get("addr")

        hostname = None
        hostnames_el = host_el.find("hostnames")
        if hostnames_el is not None:
            hn = hostnames_el.find("hostname")
            if hn is not None:
                hostname = hn.get("name")

        os_guess = None
        os_el = host_el.find("os")
        if os_el is not None:
            osmatch = os_el.find("osmatch")
            if osmatch is not None:
                os_guess = f"{osmatch.get('name', '')} ({osmatch.get('accuracy', '')}%)"

        ports_list = []
        services_list = []
        ports_el = host_el.find("ports")
        if ports_el is not None:
            for port_el in ports_el.findall("port"):
                port_state = port_el.find("state")
                if port_state is None:
                    continue
                port_info = {
                    "port": int(port_el.get("portid", 0)),
                    "protocol": port_el.get("protocol", "tcp"),
                    "state": port_state.get("state", ""),
                }
                svc = port_el.find("service")
                if svc is not None:
                    svc_info = {
                        "port": port_info["port"],
                        "name": svc.get("name", ""),
                        "product": svc.get("product", ""),
                        "version": svc.get("version", ""),
                        "extra": svc.get("extrainfo", ""),
                    }
                    port_info["service"] = svc_info["name"]
                    services_list.append(svc_info)

                # Script outputs
                scripts = {}
                for script_el in port_el.findall("script"):
                    scripts[script_el.get("id", "")] = script_el.get("output", "")
                if scripts:
                    port_info["scripts"] = scripts

                ports_list.append(port_info)

        hosts.append(DiscoveredHost(
            ip=ip,
            mac=mac,
            hostname=hostname,
            os_guess=os_guess,
            state="up",
            ports=ports_list,
            services=services_list,
        ))

    return hosts
