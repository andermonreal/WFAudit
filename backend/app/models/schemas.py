from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


# ── Enums ──

class InterfaceMode(str, Enum):
    MANAGED = "managed"
    MONITOR = "monitor"


class ScanStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AttackType(str, Enum):
    DEAUTH = "deauth"
    EVIL_TWIN = "evil_twin"
    WPA_CRACK = "wpa_crack"
    MITM = "mitm"


class SecurityType(str, Enum):
    OPEN = "open"
    WEP = "wep"
    WPA = "wpa"
    WPA2 = "wpa2"
    WPA3 = "wpa3"
    UNKNOWN = "unknown"


# ── Network Interfaces ──

class NetworkInterface(BaseModel):
    name: str
    mac: str
    driver: Optional[str] = None
    chipset: Optional[str] = None
    mode: InterfaceMode = InterfaceMode.MANAGED
    is_up: bool = False
    supports_monitor: bool = False


class SetModeRequest(BaseModel):
    interface: str
    mode: InterfaceMode
    kill_conflicting: bool = True


# ── WiFi Scanning (airodump) ──

class AccessPoint(BaseModel):
    bssid: str
    essid: str
    channel: int
    power: int = 0
    security: SecurityType = SecurityType.UNKNOWN
    cipher: Optional[str] = None
    auth: Optional[str] = None
    beacons: int = 0
    data_packets: int = 0
    clients: list[str] = []
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    wps: bool = False


class WifiScanRequest(BaseModel):
    interface: str
    channel: Optional[int] = None
    duration: int = 30
    target_bssid: Optional[str] = None


class WifiScanResult(BaseModel):
    id: str
    status: ScanStatus
    interface: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    access_points: list[AccessPoint] = []
    client_count: int = 0


# ── Nmap Recon ──

class NmapScanType(str, Enum):
    QUICK = "quick"
    FULL = "full"
    VULN = "vuln"
    OS_DETECT = "os_detect"
    SERVICE = "service"
    STEALTH = "stealth"
    UDP = "udp"
    CUSTOM = "custom"


class NmapTarget(BaseModel):
    target: str = Field(..., description="IP, CIDR, or range (e.g. 192.168.0.0/24)")
    scan_type: NmapScanType = NmapScanType.QUICK
    ports: Optional[str] = None
    custom_args: Optional[str] = None
    timeout: int = 300


class DiscoveredHost(BaseModel):
    ip: str
    mac: Optional[str] = None
    hostname: Optional[str] = None
    os_guess: Optional[str] = None
    state: str = "up"
    ports: list[dict] = []
    services: list[dict] = []
    scripts_output: Optional[dict] = None


class NmapScanResult(BaseModel):
    id: str
    status: ScanStatus
    target: str
    scan_type: NmapScanType
    started_at: datetime
    finished_at: Optional[datetime] = None
    hosts: list[DiscoveredHost] = []
    raw_xml: Optional[str] = None
    command: Optional[str] = None


# ── Attacks ──

class DeauthRequest(BaseModel):
    interface: str
    target_bssid: str
    client_mac: Optional[str] = None  # None = broadcast
    packets: int = 50
    reason: str = "Force handshake capture for WPA audit"


class HandshakeCaptureRequest(BaseModel):
    interface: str
    target_bssid: str
    channel: int
    timeout: int = 120
    deauth_first: bool = True
    deauth_packets: int = 10


class WpaCrackRequest(BaseModel):
    capture_file: str
    target_bssid: str
    wordlist: str = "rockyou.txt"
    custom_wordlist_path: Optional[str] = None


class EvilTwinRequest(BaseModel):
    interface: str
    target_essid: str
    target_bssid: Optional[str] = None
    channel: int = 6
    internet_interface: Optional[str] = None
    captive_portal: bool = False


class MitmRequest(BaseModel):
    interface: str
    target_ips: list[str] = []
    gateway: str
    proxy_port: int = 8080
    ssl_strip: bool = False
    capture_credentials: bool = True
    filter_hosts: list[str] = []


# ── CTF / Router Access ──

class RouterProbeRequest(BaseModel):
    target_ip: str = "192.168.0.1"
    check_default_creds: bool = True
    check_known_vulns: bool = True
    brute_force: bool = False
    credential_list: Optional[str] = None


class RouterProbeResult(BaseModel):
    target_ip: str
    is_accessible: bool = False
    http_open: bool = False
    https_open: bool = False
    ssh_open: bool = False
    telnet_open: bool = False
    server_header: Optional[str] = None
    router_model: Optional[str] = None
    firmware_version: Optional[str] = None
    default_creds_worked: bool = False
    successful_credentials: Optional[dict] = None
    vulnerabilities: list[str] = []


# ── Sessions & Reports ──

class AuditSession(BaseModel):
    id: str
    name: str
    company: str
    auditor: str
    created_at: datetime
    status: str = "active"
    notes: Optional[str] = None
    interface_used: Optional[str] = None
    findings: list[dict] = []


class CreateSessionRequest(BaseModel):
    name: str
    company: str
    auditor: str
    notes: Optional[str] = None


class Finding(BaseModel):
    session_id: str
    category: str
    severity: str  # critical, high, medium, low, info
    title: str
    description: str
    evidence: Optional[str] = None
    recommendation: Optional[str] = None
