"""Service for detecting and managing network interfaces.

CRITICAL FIX: Monitor mode is now applied SURGICALLY per-interface using `iw`
directly, instead of `airmon-ng check kill` which terminates NetworkManager
and wpa_supplicant globally — taking down ethernet, other WiFi adapters, and
all internet connectivity.

Strategy:
  1. Tell NetworkManager to "unmanage" only the target interface (nmcli)
  2. Take only that interface down with `ip link`
  3. Switch only that interface to monitor mode with `iw`
  4. Bring it back up
  → All other interfaces (ethernet, other wlans) continue working normally
  → User keeps internet via cable; can run a separate adapter as fake AP
"""

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

    # ──────────────────────────────────────────────────────────────
    # MONITOR MODE — Surgical per-interface, preserves global network
    # ──────────────────────────────────────────────────────────────

    async def set_monitor_mode(self, name: str, kill_conflicting: bool = False) -> dict:
        """Switch a specific interface to monitor mode WITHOUT touching others.

        Default behavior (preserves all other interfaces and their connectivity):
          - NetworkManager keeps managing other interfaces (ethernet, other wlans)
          - wpa_supplicant keeps running for other interfaces
          - Only the target interface is taken down → switched → brought up

        Set kill_conflicting=True ONLY if the surgical approach fails (rare).
        """
        steps = []

        # Step 1: Tell NetworkManager to stop managing JUST this interface.
        # This prevents NM from fighting our mode change while leaving other
        # interfaces (ethernet, other wlans) under NM control.
        nm_unmanage = await process_manager.run_sync(
            ["nmcli", "device", "set", name, "managed", "no"], timeout=5
        )
        steps.append({
            "step": "nmcli_unmanage",
            "output": nm_unmanage[0] + nm_unmanage[1],
            "rc": nm_unmanage[2],
            "note": "Removes interface from NetworkManager control (other interfaces unaffected)",
        })

        # Step 2: Stop wpa_supplicant ONLY on this interface (if running).
        # Match processes that have "-i <name>" in their args. Other supplicant
        # instances (for other interfaces) survive untouched.
        ps_out, _, _ = await process_manager.run_sync(["pgrep", "-af", "wpa_supplicant"], timeout=3)
        for line in (ps_out or "").splitlines():
            if re.search(rf"-i\s+{re.escape(name)}\b", line):
                pid = line.split()[0]
                kill_out = await process_manager.run_sync(["kill", pid], timeout=3)
                steps.append({
                    "step": "kill_wpa_supplicant_for_iface",
                    "output": f"Killed wpa_supplicant PID {pid} (was bound to {name})",
                    "rc": kill_out[2],
                })

        # Step 3: Surgical mode switch using `iw` directly.
        # Does NOT touch NetworkManager globally, ethernet, or other wlans.
        iface_down = await process_manager.run_sync(["ip", "link", "set", name, "down"], timeout=5)
        steps.append({"step": "iface_down", "rc": iface_down[2]})

        # Try simple syntax first (most modern drivers)
        iw_set = await process_manager.run_sync(["iw", name, "set", "monitor", "control"], timeout=5)
        if iw_set[2] != 0:
            # Fallback to "type monitor" syntax
            iw_set = await process_manager.run_sync(["iw", "dev", name, "set", "type", "monitor"], timeout=5)
        steps.append({
            "step": "iw_set_monitor",
            "output": iw_set[0] + iw_set[1],
            "rc": iw_set[2],
        })

        iface_up = await process_manager.run_sync(["ip", "link", "set", name, "up"], timeout=5)
        steps.append({"step": "iface_up", "rc": iface_up[2]})

        # Verify mode actually changed
        verify_out, _, _ = await process_manager.run_sync(["iwconfig", name], timeout=3)
        is_monitor = "Mode:Monitor" in verify_out

        # FALLBACK: airmon-ng (kills NetworkManager globally — opt-in only)
        if not is_monitor and kill_conflicting:
            logger.warning(f"Surgical monitor mode failed on {name}, falling back to airmon-ng (will affect other interfaces)")
            airmon_out = await process_manager.run_sync(["airmon-ng", "start", name], timeout=15)
            steps.append({
                "step": "airmon_fallback",
                "output": airmon_out[0] + airmon_out[1],
                "rc": airmon_out[2],
                "warning": "FALLBACK: this method may disrupt other interfaces",
            })
            new_name = name + "mon"
            verify2, _, _ = await process_manager.run_sync(["iwconfig", new_name], timeout=3)
            if "Mode:Monitor" in verify2:
                return {
                    "original_interface": name,
                    "monitor_interface": new_name,
                    "steps": steps,
                    "success": True,
                    "method": "airmon-ng (fallback)",
                    "warning": "Used global airmon-ng fallback. Other interfaces may be affected.",
                }

        return {
            "original_interface": name,
            "monitor_interface": name,  # Surgical method keeps the original name
            "steps": steps,
            "success": is_monitor,
            "method": "surgical (per-interface, preserves ethernet/other wlans)",
            "preserves_internet": True,
        }

    async def set_managed_mode(self, name: str) -> dict:
        """Return interface to managed mode WITHOUT disrupting other interfaces."""
        steps = []

        # Bring down → switch type → bring up
        d = await process_manager.run_sync(["ip", "link", "set", name, "down"], timeout=5)
        steps.append({"step": "iface_down", "rc": d[2]})

        m = await process_manager.run_sync(["iw", "dev", name, "set", "type", "managed"], timeout=5)
        steps.append({"step": "set_managed", "output": m[0] + m[1], "rc": m[2]})

        u = await process_manager.run_sync(["ip", "link", "set", name, "up"], timeout=5)
        steps.append({"step": "iface_up", "rc": u[2]})

        # Re-enable NetworkManager management for THIS interface only
        nm = await process_manager.run_sync(
            ["nmcli", "device", "set", name, "managed", "yes"], timeout=5
        )
        steps.append({
            "step": "nmcli_remanage",
            "output": nm[0] + nm[1],
            "rc": nm[2],
            "note": "Re-enables NetworkManager control for this interface only",
        })

        # If interface was renamed by airmon-ng fallback (e.g. wlan0mon),
        # also bring back the base interface
        if name.endswith("mon"):
            base = name[:-3]
            await process_manager.run_sync(["ip", "link", "set", base, "up"], timeout=3)
            await process_manager.run_sync(
                ["nmcli", "device", "set", base, "managed", "yes"], timeout=3
            )
            steps.append({"step": "restore_base_iface", "interface": base})

        verify_out, _, _ = await process_manager.run_sync(["iwconfig", name], timeout=3)
        is_managed = "Mode:Managed" in verify_out or "Mode:Auto" in verify_out

        return {
            "interface": name,
            "steps": steps,
            "success": is_managed,
            "method": "surgical (per-interface)",
            "preserves_internet": True,
        }

    # ──────────────────────────────────────────────────────────────
    # NETWORK STATUS — Reports on what each interface is doing
    # ──────────────────────────────────────────────────────────────

    async def network_status(self) -> dict:
        """Report on all network interfaces and their roles.

        Tells the user:
          - Which interfaces have internet (ethernet or managed wifi)
          - Which adapters are available for monitor mode
          - Which adapters can be used for the fake AP

        Useful for Evil Twin scenarios where 3+ interfaces are needed.
        """
        result = {
            "ethernet": [],
            "wifi_managed": [],
            "wifi_monitor": [],
            "internet_available": False,
            "suggestions": [],
        }

        # List ALL network interfaces (not just WiFi)
        stdout, _, _ = await process_manager.run_sync(["ip", "-o", "link", "show"], timeout=5)
        for line in stdout.split("\n"):
            m = re.match(r"\d+:\s+(\S+):", line)
            if not m:
                continue
            iface = m.group(1)
            if iface == "lo":
                continue

            # WiFi or wired?
            wifi_check, _, _ = await process_manager.run_sync(["iwconfig", iface], timeout=2)
            is_wifi = "IEEE 802.11" in wifi_check

            state_out, _, _ = await process_manager.run_sync(
                ["cat", f"/sys/class/net/{iface}/operstate"], timeout=2
            )
            state = state_out.strip()
            ip_out, _, _ = await process_manager.run_sync(["ip", "-4", "addr", "show", iface], timeout=2)
            ip_match = re.search(r"inet\s+(\S+)/", ip_out)
            ipv4 = ip_match.group(1) if ip_match else None

            info = {"interface": iface, "state": state, "ipv4": ipv4}

            if not is_wifi:
                result["ethernet"].append(info)
                if ipv4 and state == "up":
                    result["internet_available"] = True
            else:
                if "Mode:Monitor" in wifi_check:
                    result["wifi_monitor"].append(info)
                else:
                    result["wifi_managed"].append(info)
                    if ipv4 and state == "up":
                        result["internet_available"] = True

        # Generate role-based suggestions
        if not result["internet_available"]:
            result["suggestions"].append({
                "level": "warning",
                "message": "No internet-providing interface detected. Connect ethernet or a managed WiFi adapter before starting attacks that require upstream connectivity.",
            })
        total_wifi = len(result["wifi_managed"]) + len(result["wifi_monitor"])
        if total_wifi < 2:
            result["suggestions"].append({
                "level": "info",
                "message": "Only 1 WiFi adapter detected. Evil Twin attacks need 2+ adapters (one for monitor mode, one for the fake AP). Consider adding a USB WiFi adapter.",
            })
        else:
            result["suggestions"].append({
                "level": "ok",
                "message": f"{total_wifi} WiFi adapters detected. Sufficient for Evil Twin (1 monitor + 1 AP).",
            })

        return result

    async def change_mac(self, name: str, new_mac: Optional[str] = None,
                         vendor_prefix: Optional[str] = None) -> dict:
        """Change MAC — random, specific, or vendor-spoofed."""
        await process_manager.run_sync(["ip", "link", "set", name, "down"])

        if vendor_prefix:
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
        """Set transmission power."""
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
