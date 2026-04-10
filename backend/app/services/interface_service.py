"""Service for detecting and managing network interfaces."""

import re
import logging
from typing import Optional
from app.models.schemas import NetworkInterface, InterfaceMode
from app.utils.process_manager import process_manager

logger = logging.getLogger(__name__)


class InterfaceService:
    async def list_interfaces(self) -> list[NetworkInterface]:
        """List all wireless interfaces with their capabilities."""
        interfaces = []

        # Get wireless interfaces via iw/iwconfig
        stdout, stderr, rc = await process_manager.run_sync(["iwconfig"], timeout=5)

        current_iface = None
        for line in (stdout + stderr).split("\n"):
            # iwconfig prints interface name at start of line (no leading space)
            match = re.match(r"^(\S+)\s+IEEE 802\.11", line)
            if match:
                current_iface = match.group(1)
                mode = "monitor" if "Mode:Monitor" in line else "managed"
                interfaces.append(NetworkInterface(
                    name=current_iface,
                    mac="",
                    mode=InterfaceMode(mode),
                    is_up=True,
                    supports_monitor=True,
                ))

        # Enrich with MAC, driver info
        for iface in interfaces:
            iface.mac = await self._get_mac(iface.name)
            iface.driver = await self._get_driver(iface.name)
            iface.chipset = await self._get_chipset(iface.name)
            iface.is_up = await self._is_up(iface.name)

        return interfaces

    async def get_interface(self, name: str) -> Optional[NetworkInterface]:
        interfaces = await self.list_interfaces()
        return next((i for i in interfaces if i.name == name), None)

    async def set_monitor_mode(self, name: str, kill_conflicting: bool = True) -> dict:
        """Put interface in monitor mode using airmon-ng."""
        steps = []

        if kill_conflicting:
            stdout, _, rc = await process_manager.run_sync(
                ["airmon-ng", "check", "kill"], timeout=10
            )
            steps.append({"step": "kill_conflicting", "output": stdout, "rc": rc})

        stdout, stderr, rc = await process_manager.run_sync(
            ["airmon-ng", "start", name], timeout=15
        )
        steps.append({"step": "start_monitor", "output": stdout + stderr, "rc": rc})

        # Detect new interface name (airmon-ng may rename to wlan0mon)
        new_name = name
        match = re.search(r"monitor mode.*enabled.*on\s+(\S+)", stdout + stderr, re.IGNORECASE)
        if match:
            new_name = match.group(1)
        elif name + "mon" in stdout + stderr:
            new_name = name + "mon"

        return {
            "original_interface": name,
            "monitor_interface": new_name,
            "steps": steps,
            "success": rc == 0,
        }

    async def set_managed_mode(self, name: str) -> dict:
        """Restore interface to managed mode."""
        stdout, stderr, rc = await process_manager.run_sync(
            ["airmon-ng", "stop", name], timeout=15
        )
        # Restart network manager
        await process_manager.run_sync(
            ["systemctl", "start", "NetworkManager"], timeout=10
        )
        return {
            "interface": name,
            "output": stdout + stderr,
            "success": rc == 0,
        }

    async def change_mac(self, name: str, new_mac: Optional[str] = None) -> dict:
        """Change MAC address. If new_mac is None, randomize."""
        # Bring interface down
        await process_manager.run_sync(["ip", "link", "set", name, "down"])

        if new_mac:
            cmd = ["macchanger", "-m", new_mac, name]
        else:
            cmd = ["macchanger", "-r", name]

        stdout, stderr, rc = await process_manager.run_sync(cmd, timeout=5)

        # Bring back up
        await process_manager.run_sync(["ip", "link", "set", name, "up"])

        return {"interface": name, "output": stdout + stderr, "success": rc == 0}

    # ── Private helpers ──

    async def _get_mac(self, name: str) -> str:
        stdout, _, _ = await process_manager.run_sync(
            ["cat", f"/sys/class/net/{name}/address"], timeout=2
        )
        return stdout.strip()

    async def _get_driver(self, name: str) -> Optional[str]:
        stdout, _, _ = await process_manager.run_sync(
            ["readlink", f"/sys/class/net/{name}/device/driver"], timeout=2
        )
        if stdout.strip():
            return stdout.strip().split("/")[-1]
        return None

    async def _get_chipset(self, name: str) -> Optional[str]:
        stdout, _, _ = await process_manager.run_sync(["airmon-ng"], timeout=5)
        for line in stdout.split("\n"):
            if name in line:
                parts = line.split("\t")
                if len(parts) >= 4:
                    return parts[-1].strip()
        return None

    async def _is_up(self, name: str) -> bool:
        stdout, _, _ = await process_manager.run_sync(
            ["cat", f"/sys/class/net/{name}/operstate"], timeout=2
        )
        return stdout.strip() in ("up", "unknown")


interface_service = InterfaceService()
