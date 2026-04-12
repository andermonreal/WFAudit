"""Parsers for tool outputs (airodump CSV, nmap XML, etc.)."""

import re
import xml.etree.ElementTree as ET
from typing import Optional
from datetime import datetime
from app.models.schemas import (
    AccessPoint, SecurityType, DiscoveredHost, WirelessClient, PnlAnalysis, PnlReport,
)
from app.utils.oui_lookup import enrich_manufacturer


def parse_security(enc: str, cipher: str, auth: str) -> SecurityType:
    enc_up = enc.strip().upper()
    auth_up = auth.strip().upper()
    if "WPA3" in enc_up or "SAE" in auth_up:
        if "EAP" in auth_up or "MGT" in auth_up:
            return SecurityType.WPA3_ENTERPRISE
        return SecurityType.WPA3
    if "WPA2" in enc_up:
        if "EAP" in auth_up or "MGT" in auth_up:
            return SecurityType.WPA2_ENTERPRISE
        return SecurityType.WPA2
    if "WPA" in enc_up:
        return SecurityType.WPA
    if "WEP" in enc_up:
        return SecurityType.WEP
    if "OPN" in enc_up or enc_up == "":
        return SecurityType.OPEN
    return SecurityType.UNKNOWN


def _detect_band(channel: int) -> str:
    if channel <= 14:
        return "2.4 GHz"
    return "5 GHz"


def _parse_dt(s: str) -> Optional[datetime]:
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def parse_airodump_csv(filepath: str) -> tuple[list[AccessPoint], list[WirelessClient]]:
    """Parse airodump-ng CSV output into APs and Clients with enrichment."""
    access_points = []
    clients = []

    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except FileNotFoundError:
        return [], []

    sections = re.split(r"\n\s*\n", content, maxsplit=1)

    # ── Parse APs ──
    if len(sections) >= 1:
        for line in sections[0].strip().split("\n")[1:]:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 14:
                continue
            try:
                bssid = parts[0]
                if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", bssid):
                    continue
                ch = int(parts[3]) if parts[3].strip().lstrip("-").isdigit() else 0
                essid = parts[13].strip()

                ap = AccessPoint(
                    bssid=bssid,
                    channel=ch,
                    power=int(parts[8]) if parts[8].strip().lstrip("-").isdigit() else 0,
                    beacons=int(parts[9]) if parts[9].strip().isdigit() else 0,
                    data_packets=int(parts[10]) if parts[10].strip().isdigit() else 0,
                    security=parse_security(parts[5], parts[6], parts[7]),
                    cipher=parts[6].strip() or None,
                    auth=parts[7].strip() or None,
                    essid=essid,
                    first_seen=_parse_dt(parts[1]),
                    last_seen=_parse_dt(parts[2]),
                    max_speed=int(parts[4]) if parts[4].strip().isdigit() else None,
                    manufacturer=enrich_manufacturer(bssid),
                    band=_detect_band(ch),
                    is_hidden=(essid == "" or len(essid) == 0),
                )
                access_points.append(ap)
            except (ValueError, IndexError):
                continue

    # ── Parse Clients / Stations ──
    if len(sections) >= 2:
        for line in sections[1].strip().split("\n")[1:]:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 6:
                continue
            mac = parts[0]
            if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", mac):
                continue

            bssid_assoc = parts[5].strip() if len(parts) > 5 else None
            if bssid_assoc and not re.match(r"([0-9A-Fa-f]{2}:){5}", bssid_assoc):
                bssid_assoc = None

            probes_raw = parts[6].strip() if len(parts) > 6 else ""
            probes = [p.strip() for p in probes_raw.split(",") if p.strip()] if probes_raw else []

            client = WirelessClient(
                mac=mac,
                bssid=bssid_assoc if bssid_assoc and "(not associated)" not in bssid_assoc else None,
                power=int(parts[3]) if parts[3].strip().lstrip("-").isdigit() else 0,
                lost=int(parts[4]) if len(parts) > 4 and parts[4].strip().isdigit() else 0,
                frames=int(parts[4]) if len(parts) > 4 and parts[4].strip().isdigit() else 0,
                probes=probes,
                manufacturer=enrich_manufacturer(mac),
                first_seen=_parse_dt(parts[1]) if len(parts) > 1 else None,
                last_seen=_parse_dt(parts[2]) if len(parts) > 2 else None,
            )
            clients.append(client)

    # Associate clients with APs
    for client in clients:
        if client.bssid:
            for ap in access_points:
                if client.bssid == ap.bssid:
                    ap.clients.append(client.mac)

    return access_points, clients


def analyze_pnl(scan_id: str, clients: list[WirelessClient], aps: list[AccessPoint]) -> PnlReport:
    """
    Analyze Preferred Network Lists from client probes.
    Identifies evil twin candidates and vulnerable clients.
    """
    ap_essids = {ap.essid for ap in aps if ap.essid}
    all_probes: dict[str, int] = {}  # SSID -> count of clients probing for it
    pnl_clients = []

    for client in clients:
        notes = []
        associated_essid = None

        # Find associated ESSID
        if client.bssid:
            for ap in aps:
                if ap.bssid == client.bssid:
                    associated_essid = ap.essid
                    break

        # Analyze probes
        for probe in client.probes:
            all_probes[probe] = all_probes.get(probe, 0) + 1
            if probe not in ap_essids:
                notes.append(f"Probes for absent network '{probe}' — Evil Twin candidate")

        if not client.bssid and client.probes:
            notes.append("Unassociated client broadcasting probe requests — susceptible to rogue AP")

        if client.manufacturer and "randomized" in client.manufacturer.lower():
            notes.append("Client uses randomized MAC — modern device privacy feature")

        pnl_clients.append(PnlAnalysis(
            client_mac=client.mac,
            manufacturer=client.manufacturer,
            probed_networks=client.probes,
            is_associated=client.bssid is not None,
            associated_bssid=client.bssid,
            associated_essid=associated_essid,
            vulnerability_notes=notes,
        ))

    # Evil twin candidates: SSIDs probed by 2+ unassociated clients
    evil_twin_candidates = [
        ssid for ssid, count in all_probes.items()
        if count >= 2 and ssid not in ap_essids
    ]

    unique_probes = sorted(set(p for c in clients for p in c.probes))

    return PnlReport(
        scan_id=scan_id,
        total_clients=len(clients),
        associated_clients=sum(1 for c in clients if c.bssid),
        unassociated_clients=sum(1 for c in clients if not c.bssid),
        unique_probed_networks=unique_probes,
        clients=pnl_clients,
        evil_twin_candidates=evil_twin_candidates,
    )


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

        ip, mac = "", None
        for addr in host_el.findall("address"):
            if addr.get("addrtype") == "ipv4":
                ip = addr.get("addr", "")
            elif addr.get("addrtype") == "mac":
                mac = addr.get("addr")

        hostname = None
        hn_el = host_el.find("hostnames")
        if hn_el is not None:
            hn = hn_el.find("hostname")
            if hn is not None:
                hostname = hn.get("name")

        os_guess = None
        os_el = host_el.find("os")
        if os_el is not None:
            osmatch = os_el.find("osmatch")
            if osmatch is not None:
                os_guess = f"{osmatch.get('name', '')} ({osmatch.get('accuracy', '')}%)"

        ports_list, services_list = [], []
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
                scripts = {}
                for script_el in port_el.findall("script"):
                    scripts[script_el.get("id", "")] = script_el.get("output", "")
                if scripts:
                    port_info["scripts"] = scripts
                ports_list.append(port_info)

        hosts.append(DiscoveredHost(
            ip=ip, mac=mac, hostname=hostname, os_guess=os_guess,
            state="up", ports=ports_list, services=services_list,
        ))

    return hosts
