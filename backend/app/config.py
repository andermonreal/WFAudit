from pydantic_settings import BaseSettings
from pathlib import Path
import os


class Settings(BaseSettings):
    APP_NAME: str = "WiFi Audit Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    CAPTURES_DIR: Path = DATA_DIR / "captures"
    REPORTS_DIR: Path = DATA_DIR / "reports"
    HANDSHAKES_DIR: Path = DATA_DIR / "handshakes"
    WORDLISTS_DIR: Path = DATA_DIR / "wordlists"
    LOGS_DIR: Path = DATA_DIR / "logs"

    # Tool paths (auto-detect or override)
    AIRMON_NG: str = "airmon-ng"
    AIRODUMP_NG: str = "airodump-ng"
    AIREPLAY_NG: str = "aireplay-ng"
    AIRCRACK_NG: str = "aircrack-ng"
    NMAP: str = "nmap"
    MITMPROXY: str = "mitmproxy"
    HOSTAPD: str = "hostapd"
    DNSMASQ: str = "dnsmasq"

    # Scan defaults
    DEFAULT_SCAN_TIMEOUT: int = 60
    NMAP_DEFAULT_ARGS: str = "-sV -sC -O"
    AIRODUMP_CHANNEL_HOP_INTERVAL: int = 1

    # Security
    API_KEY: str = "change-me-in-production"
    REQUIRE_AUTH: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Create directories on import
for d in [
    settings.DATA_DIR,
    settings.CAPTURES_DIR,
    settings.REPORTS_DIR,
    settings.HANDSHAKES_DIR,
    settings.WORDLISTS_DIR,
    settings.LOGS_DIR,
]:
    d.mkdir(parents=True, exist_ok=True)
