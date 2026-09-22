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

class SecurityType(str, Enum):
    OPEN = "open"
    WEP = "wep"
    WPA = "wpa"
    WPA2 = "wpa2"
    WPA3 = "wpa3"
    WPA2_ENTERPRISE = "wpa2_enterprise"
    WPA3_ENTERPRISE = "wpa3_enterprise"
    UNKNOWN = "unknown"

class WifiBand(str, Enum):
    BAND_2GHZ = "bg"
    BAND_5GHZ = "a"
    BAND_DUAL = "abg"

class AuthType(str, Enum):
    PSK = "psk"
    EAP = "eap"
    SAE = "sae"
    OWE = "owe"
    OPEN = "open"
    UNKNOWN = "unknown"

class NmapScanType(str, Enum):
    QUICK = "quick"
    FULL = "full"
    VULN = "vuln"
    OS_DETECT = "os_detect"
    SERVICE = "service"
    STEALTH = "stealth"
    UDP = "udp"
    CUSTOM = "custom"


# ── Network Interfaces ──

class NetworkInterface(BaseModel):
    name: str
    mac: str
    driver: Optional[str] = None
    chipset: Optional[str] = None
    mode: InterfaceMode = InterfaceMode.MANAGED
    is_up: bool = False
    supports_monitor: bool = False
    supports_5ghz: bool = False
    phy: Optional[str] = None
    tx_power: Optional[int] = None


class MacChangeRequest(BaseModel):
    interface: str
    new_mac: Optional[str] = None
    vendor_prefix: Optional[str] = None


# ── Wireless Client ──

class WirelessClient(BaseModel):
    mac: str
    bssid: Optional[str] = None
    power: int = 0
    rate: Optional[str] = None
    lost: int = 0
    frames: int = 0
    probes: list[str] = []
    manufacturer: Optional[str] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None


# ── Access Point ──

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
    max_speed: Optional[int] = None
    clients: list[str] = []
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    wps: bool = False
    pmkid_available: bool = False
    manufacturer: Optional[str] = None
    band: Optional[str] = None
    is_hidden: bool = False


# ── WiFi Scanning ──

class WifiScanRequest(BaseModel):
    interface: str
    channel: Optional[int] = None
    duration: int = 30
    target_bssid: Optional[str] = None
    target_essid: Optional[str] = None
    band: WifiBand = WifiBand.BAND_2GHZ


class WifiScanResult(BaseModel):
    id: str
    status: ScanStatus
    interface: str
    band: str = "bg"
    started_at: datetime
    finished_at: Optional[datetime] = None
    access_points: list[AccessPoint] = []
    clients: list[WirelessClient] = []
    client_count: int = 0
    capture_files: list[str] = []


# ── PNL Analysis ──

class PnlAnalysis(BaseModel):
    client_mac: str
    manufacturer: Optional[str] = None
    probed_networks: list[str] = []
    is_associated: bool = False
    associated_bssid: Optional[str] = None
    associated_essid: Optional[str] = None
    vulnerability_notes: list[str] = []

class PnlReport(BaseModel):
    scan_id: str
    total_clients: int = 0
    associated_clients: int = 0
    unassociated_clients: int = 0
    unique_probed_networks: list[str] = []
    clients: list[PnlAnalysis] = []
    evil_twin_candidates: list[str] = []


# ── Nmap ──

class NmapTarget(BaseModel):
    target: str
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


# ── Deauth ──

class DeauthRequest(BaseModel):
    interface: str
    target_bssid: str
    client_mac: Optional[str] = None
    packets: int = 50
    use_essid: Optional[str] = None  # Can target by ESSID instead of BSSID
    reason: str = "Force handshake capture for WPA audit"


# ── Handshake Capture ──

class HandshakeCaptureRequest(BaseModel):
    interface: str
    target_bssid: str
    target_essid: Optional[str] = None
    channel: int
    timeout: int = 120
    deauth_first: bool = True
    deauth_packets: int = 10
    deauth_client: Optional[str] = None
    band: WifiBand = WifiBand.BAND_2GHZ


# ── WPA Crack ──

class WpaCrackRequest(BaseModel):
    capture_file: str
    target_bssid: str
    wordlist: str = "rockyou.txt"
    custom_wordlist_path: Optional[str] = None


# ── PMKID Attack (Clientless) ──

class PmkidCaptureRequest(BaseModel):
    interface: str
    target_bssid: str
    target_essid: Optional[str] = None
    channel: int
    timeout: int = 60

class PmkidCrackRequest(BaseModel):
    pmkid_file: str
    target_bssid: str
    target_essid: str
    wordlist: str = "rockyou.txt"


# ── AP-Less Attack ──

class ApLessAttackRequest(BaseModel):
    monitor_interface: str
    ap_interface: str
    target_essid: str
    channel: int = 6
    wpa_version: int = 2
    fake_passphrase: str = "fakepassword123"
    capture_timeout: int = 300


# ── Evil Twin (enhanced) ──

class EvilTwinRequest(BaseModel):
    interface: str
    target_essid: str
    target_bssid: Optional[str] = None
    channel: int = 6
    internet_interface: Optional[str] = None
    captive_portal: bool = False
    deauth_legitimate: bool = False
    deauth_interface: Optional[str] = None
    deauth_bssid: Optional[str] = None
    deauth_packets: int = 50


# ── Enterprise Attack ──

class EnterpriseAttackRequest(BaseModel):
    monitor_interface: str
    ap_interface: str
    target_essid: str
    channel: int = 6
    eap_type: str = "PEAP"
    capture_creds: bool = True


# ── WPA3 Attack ──

class Wpa3AttackRequest(BaseModel):
    interface: str
    target_bssid: str
    target_essid: Optional[str] = None
    channel: int
    attack_type: str = "downgrade"  # downgrade, transition_mode, dos
    timeout: int = 120


# ── MITM ──

class MitmRequest(BaseModel):
    interface: str
    target_ips: list[str] = []
    gateway: str
    proxy_port: int = 8080
    stealth: bool = True  # True=no HTTPS interception (invisible), False=full interception (needs CA cert)
    ssl_strip: bool = False
    capture_credentials: bool = True
    filter_hosts: list[str] = []


# ── Router Probe ──

class RouterProbeRequest(BaseModel):
    target_ip: str = "192.168.0.1"
    check_default_creds: bool = True
    check_known_vulns: bool = True
    brute_force: bool = False
    credential_list: Optional[str] = None


# ── Recon: mapa de red persistente ──

class DiscoverRequest(BaseModel):
    cidr: str

class ReconScanRequest(BaseModel):
    ip: str
    scan_type: str  # stealth | full | udp

class AddHostRequest(BaseModel):
    ip: str

class HostUpdateRequest(BaseModel):
    label: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None

class LegendRequest(BaseModel):
    legend: dict = {}   # color (hex) -> significado


# ── Capture Management ──

class CaptureFile(BaseModel):
    filename: str
    filepath: str
    file_type: str
    size_bytes: int
    created_at: Optional[datetime] = None
    target_essid: Optional[str] = None
    has_handshake: bool = False
    has_pmkid: bool = False


# ── OUI Lookup ──

class OuiLookupResult(BaseModel):
    mac: str
    oui: str
    manufacturer: Optional[str] = None
    is_randomized: bool = False


# ── Sessions ──

class AuditSession(BaseModel):
    id: str
    name: str
    company: str
    auditor: str
    created_at: datetime
    status: str = "active"          # active (abierta) | closed (cerrada)
    notes: Optional[str] = None
    interface_used: Optional[str] = None
    findings: list[dict] = []
    events: list[dict] = []         # timeline: creación, hallazgos, cierre/reapertura, comentarios
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    scope: Optional[str] = None     # alcance de la auditoría

class CreateSessionRequest(BaseModel):
    name: str
    company: str
    auditor: str
    notes: Optional[str] = None
    scope: Optional[str] = None

class Finding(BaseModel):
    session_id: str
    category: str
    severity: str
    title: str
    description: str
    evidence: Optional[str] = None
    recommendation: Optional[str] = None
    cvss: Optional[str] = None

class ReasonRequest(BaseModel):
    reason: Optional[str] = None

class EventRequest(BaseModel):
    type: str = "comment"           # comment | note | correction
    message: str


# ── Wordlist Generator ──

class WordlistGenerateRequest(BaseModel):
    seed_words: list[str]
    output_filename: str = "custom_wordlist.txt"

    # Case mutations
    use_lowercase: bool = True
    use_uppercase: bool = True
    use_capitalize: bool = True
    use_alternating_case: bool = False

    # Letter mutations
    use_leet: bool = True
    leet_intensity: str = "medium"  # low, medium, high
    use_doubling: bool = True
    use_stretching: bool = False
    use_reverse: bool = True
    use_palindrome: bool = False

    # NEW: Number infix
    use_number_infix: bool = True

    # Numeric appendages
    use_numbers: bool = True
    number_max_length: int = 4
    use_years: bool = True
    use_birth_years: bool = True

    # Symbols
    use_symbols: bool = True
    use_double_symbols: bool = True
    use_symbol_pairs: bool = True

    # Word combinations
    combine_words: bool = True
    combine_3_words: bool = False
    use_separators: bool = True
    use_reverse_combine: bool = True

    # Common base words
    add_common_base: bool = True
    add_spanish_base: bool = True
    add_spanish_names: bool = True

    # Length filter
    min_length: int = 6
    max_length: int = 32

    # Limits
    max_total: int = 10_000_000
