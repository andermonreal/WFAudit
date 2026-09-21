from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "WiFi Audit Backend"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    CAPTURES_DIR: Path = DATA_DIR / "captures"
    REPORTS_DIR: Path = DATA_DIR / "reports"
    HANDSHAKES_DIR: Path = DATA_DIR / "handshakes"
    PMKID_DIR: Path = DATA_DIR / "pmkid"
    WORDLISTS_DIR: Path = DATA_DIR / "wordlists"
    LOGS_DIR: Path = DATA_DIR / "logs"
    HOSTAPD_DIR: Path = DATA_DIR / "hostapd"
    ENTERPRISE_DIR: Path = DATA_DIR / "enterprise"
    EVIDENCE_DIR: Path = DATA_DIR / "evidence"
    OUI_DB_PATH: Path = DATA_DIR / "oui.txt"

    # Tool paths
    AIRMON_NG: str = "airmon-ng"
    AIRODUMP_NG: str = "airodump-ng"
    AIREPLAY_NG: str = "aireplay-ng"
    AIRCRACK_NG: str = "aircrack-ng"
    NMAP: str = "nmap"
    MITMPROXY: str = "mitmproxy"
    HOSTAPD: str = "hostapd"
    DNSMASQ: str = "dnsmasq"
    HCXDUMPTOOL: str = "hcxdumptool"
    HCXPCAPNGTOOL: str = "hcxpcapngtool"
    HASHCAT: str = "hashcat"
    FREERADIUS: str = "freeradius"
    AIRGEDDON: str = "airgeddon"

    # Scan defaults
    DEFAULT_SCAN_TIMEOUT: int = 60
    NMAP_DEFAULT_ARGS: str = "-sV -sC -O"
    AIRODUMP_CHANNEL_HOP_INTERVAL: int = 1
    DEFAULT_BAND: str = "bg"  # 2.4 GHz

    # Security
    API_KEY: str = "change-me-in-production"
    REQUIRE_AUTH: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

for d in [
    settings.DATA_DIR, settings.CAPTURES_DIR, settings.REPORTS_DIR,
    settings.HANDSHAKES_DIR, settings.PMKID_DIR, settings.WORDLISTS_DIR,
    settings.LOGS_DIR, settings.HOSTAPD_DIR, settings.ENTERPRISE_DIR,
    settings.EVIDENCE_DIR,
]:
    d.mkdir(parents=True, exist_ok=True)
