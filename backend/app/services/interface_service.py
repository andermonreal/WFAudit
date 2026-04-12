"""Service for detecting and managing network interfaces — enhanced."""

import re
import logging
from typing import Optional
from app.models.schemas import NetworkInterface, InterfaceMode
from app.utils.process_manager import process_manager
from app.utils.oui_lookup import enrich_manufacturer

logger = logging.getLogger(__name__)


class InterfaceService:
    async def list_interfaces(self) -> list[NetworkInterface]:
        interfaces = []
        stdout, stderr, _ = await process_manager.run_sync(["iwconfig"], timeout=5)

        for line in (stdout + stderr).split("\n"):
            match = re.match(r"^(\S+)\s+IEEE 802\.11", line)
            if match:
                name = match.group(1)
                mode = "monitor" if "Mode:Monitor" in line else "managed"
                interfaces.append(NetworkInterface(
                    name=name, mac="", mode=InterfaceMode(mode),
                    is_up=True, supports_monitor=True,
                ))

        for iface in interfaces:
            iface.mac = await self._get_mac(iface.name)
            iface.driver = await self._get_driver(iface.name)
            iface.chipset = await self._get_chipset(iface.name)
            iface.is_up = await self._is_up(iface.name)
            iface.supports_5ghz = await self._check_5ghz(iface.name)
            iface.tx_power = await self._get_tx_power(iface.name)

        return interfaces

    async def get_interface(self, name: str) -> Optional[NetworkInterface]:
        interfaces = await self.list_interfaces()
        return next((i for i in interfaces if i.name == name), None)

    async def set_monitor_mode(self, name: str, kill_conflicting: bool = True) -> dict:
        steps = []
        if kill_conflicting:
            stdout, _, rc = await process_manager.run_sync(["airmon-ng", "check", "kill"], timeout=10)
            steps.append({"step": "kill_conflicting", "output": stdout, "rc": rc})

        stdout, stderr, rc = await process_manager.run_sync(["airmon-ng", "start", name], timeout=15)
        steps.append({"step": "start_monitor", "output": stdout + stderr, "rc": rc})

        new_name = name
        match = re.search(r"monitor mode.*enabled.*on\s+(\S+)", stdout + stderr, re.IGNORECASE)
        if match:
            new_name = match.group(1)
        elif name + "mon" in stdout + stderr:
            new_name = name + "mon"

        return {
            "original_interface": name, "monitor_interface": new_name,
            "steps": steps, "success": rc == 0,
        }

    async def set_managed_mode(self, name: str) -> dict:
        stdout, stderr, rc = await process_manager.run_sync(["airmon-ng", "stop", name], timeout=15)
        await process_manager.run_sync(["systemctl", "start", "NetworkManager"], timeout=10)
        return {"interface": name, "output": stdout + stderr, "success": rc == 0}

    async def change_mac(self, name: str, new_mac: Optional[str] = None,
                         vendor_prefix: Optional[str] = None) -> dict:
        """Change MAC — random, specific, or vendor-spoofed."""
        await process_manager.run_sync(["ip", "link", "set", name, "down"])

        if vendor_prefix:
            # Set MAC with specific vendor OUI prefix (e.g., mimic a printer)
            import random
            suffix = ":".join(f"{random.randint(0, 255):02x}" for _ in range(3))
            new_mac = f"{vendor_prefix}:{suffix}"

        if new_mac:
            cmd = ["macchanger", "-m", new_mac, name]
        else:
            cmd = ["macchanger", "-r", name]

        stdout, stderr, rc = await process_manager.run_sync(cmd, timeout=5)
        await process_manager.run_sync(["ip", "link", "set", name, "up"])
        return {"interface": name, "output": stdout + stderr, "success": rc == 0, "new_mac": new_mac}

    async def set_tx_power(self, name: str, power_dbm: int) -> dict:
        """Set transmission power (useful for range testing)."""
        stdout, stderr, rc = await process_manager.run_sync(
            ["iw", "dev", name, "set", "txpower", "fixed", str(power_dbm * 100)], timeout=5
        )
        return {"interface": name, "tx_power": power_dbm, "success": rc == 0}

    async def get_supported_channels(self, name: str) -> dict:
        """List all supported channels for an interface."""
        stdout, _, _ = await process_manager.run_sync(
            ["iw", "phy", f"phy{name.replace('wlan', '').replace('mon', '')}", "channels"],
            timeout=5,
        )
        # Fallback to iw list
        if not stdout.strip():
            stdout, _, _ = await process_manager.run_sync(["iw", "list"], timeout=10)

        channels_2g = []
        channels_5g = []
        for line in stdout.split("\n"):
            freq_match = re.search(r"\*\s+(\d+)\s+MHz\s+\[(\d+)\]", line)
            if freq_match:
                freq = int(freq_match.group(1))
                ch = int(freq_match.group(2))
                if "disabled" not in line.lower() and "no IR" not in line:
                    if freq < 3000:
                        channels_2g.append(ch)
                    else:
                        channels_5g.append(ch)

        return {"interface": name, "channels_2ghz": channels_2g, "channels_5ghz": channels_5g}

    # ── Private helpers ──

    async def _get_mac(self, name: str) -> str:
        stdout, _, _ = await process_manager.run_sync(["cat", f"/sys/class/net/{name}/address"], timeout=2)
        return stdout.strip()

    async def _get_driver(self, name: str) -> Optional[str]:
        stdout, _, _ = await process_manager.run_sync(["readlink", f"/sys/class/net/{name}/device/driver"], timeout=2)
        return stdout.strip().split("/")[-1] if stdout.strip() else None

    async def _get_chipset(self, name: str) -> Optional[str]:
        stdout, _, _ = await process_manager.run_sync(["airmon-ng"], timeout=5)
        for line in stdout.split("\n"):
            if name in line:
                parts = line.split("\t")
                if len(parts) >= 4:
                    return parts[-1].strip()
        return None

    async def _is_up(self, name: str) -> bool:
        stdout, _, _ = await process_manager.run_sync(["cat", f"/sys/class/net/{name}/operstate"], timeout=2)
        return stdout.strip() in ("up", "unknown")

    async def _check_5ghz(self, name: str) -> bool:
        stdout, _, _ = await process_manager.run_sync(["iw", "list"], timeout=10)
        return "5180 MHz" in stdout or "Band 2" in stdout

    async def _get_tx_power(self, name: str) -> Optional[int]:
        stdout, _, _ = await process_manager.run_sync(["iwconfig", name], timeout=5)
        match = re.search(r"Tx-Power[=:](\d+)", stdout)
        return int(match.group(1)) if match else None


interface_service = InterfaceService()
