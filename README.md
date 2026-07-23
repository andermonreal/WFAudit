# WFAudit — WiFi Security Auditing Platform

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/python-3.11+-blue.svg" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/backend-FastAPI-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/frontend-React%2019-61dafb.svg" alt="React 19">
  <img src="https://img.shields.io/badge/platform-Linux-000000.svg" alt="Platform: Linux">
</p>

**WFAudit turns the whole zoo of command-line wireless-security tools — `airodump-ng`, `aireplay-ng`, `hcxdumptool`, `hashcat`, `nmap`, `hostapd`, `arpspoof`, `mitmdump` and friends — into a single REST API with two web interfaces.**

Instead of juggling a dozen terminals and parsing incompatible outputs by hand, you drive an entire WiFi engagement — reconnaissance, handshake capture, offline cracking, wordlist generation, MITM, Evil Twin, WPA3/Enterprise attacks and internal network recon — from one clean UI or from automation scripts.

> ### ⚠️ Legal & Ethical Notice — read this first
>
> WFAudit is built for **authorized security auditing, research and education**. Use it **only** on networks and devices that you own or for which you hold **explicit written authorization** from the owner. Unauthorized access to or interference with wireless networks is a **crime** in most jurisdictions (e.g. the Computer Fraud and Abuse Act in the US, articles 197/264 of the Penal Code in Spain, Directive 2013/40/EU in the EU). **You are solely responsible for how you use this software.** The authors accept no liability for misuse. See the [full notice](#-legal--responsible-use).

---

## Table of contents

- [Highlights](#highlights)
- [What it can do](#what-it-can-do)
- [Interfaces](#interfaces)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [The `wfaudit` control script](#the-wfaudit-control-script)
- [Recommendations](#recommendations)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Legal & responsible use](#-legal--responsible-use)
- [License](#license)

---

## Highlights

- 🧭 **One API, many tools** — 70+ REST endpoints wrapping the industry-standard wireless toolkit, with auto-generated Swagger docs at `/docs`.
- 🖥️ **Two web UIs** — a modern React app *and* a zero-dependency single-file HTML console. Pick whichever you like.
- 🚀 **One-command deploy** — `sudo ./wfaudit install` sets up everything; `sudo ./wfaudit start` / `stop` runs and tears it down cleanly, restoring your network state.
- 🧱 **Clean architecture** — three layers (HTTP routers → business services → tool utilities), fully async, easy to extend.
- 🔒 **Safe teardown** — `stop` kills residual attack processes and restores `iptables` / IP-forwarding so your machine goes back to normal.

## What it can do

WFAudit is organized into modules. Each is exposed both in the web UIs and as REST endpoints.

| Module | What it does |
|---|---|
| **System** | Preflight checks — verifies ~30 system tools are installed, reports root status and running audit processes. |
| **Interfaces** | Manage WiFi adapters: monitor/managed mode, channel locking, MAC randomization, chipset & capability detection. |
| **WiFi Scan** | Discover networks (2.4/5 GHz/dual-band) with security, cipher, WPS, PMKID availability, vendor (OUI) and associated clients. Includes **PNL analysis** to find Evil-Twin candidates from probe requests. |
| **Handshake & Crack** | Capture the WPA/WPA2 4-way handshake (targeted or broadcast deauth) and crack it offline with `aircrack-ng` (CPU) or `hashcat` (GPU). |
| **PMKID** | Clientless WPA/WPA2 attack via `hcxdumptool` — fastest and stealthiest capture, cracked with `hashcat` mode 22000. |
| **AP-Less** | KARMA-style honeypot that captures crackable material from a target's saved networks even when the real AP isn't nearby. |
| **Evil Twin** | Clone a network with `hostapd` + `dnsmasq`, optional captive portal, internet forwarding and integrated deauth. |
| **Enterprise (802.1X)** | Rogue RADIUS + Evil Twin to capture EAP credentials (PEAP/EAP-TTLS) and MSCHAP hashes. |
| **WPA3** | Detect transition mode, exploit WPA3→WPA2 downgrade, and SAE (Dragonfly) DoS. |
| **Recon (nmap)** | Internal network reconnaissance: host discovery, deep service/OS scans, vuln (NSE/CVE) scans and a router probe — 8 scan profiles. |
| **MITM** | Bidirectional ARP spoofing + `mitmproxy`. **Stealth mode** (DNS + TLS SNI + HTTP, no device warnings) or **Full mode** (HTTPS interception). Real-time flow viewer. |
| **Wordlists** | Build custom password dictionaries from seed words with leetspeak, case mutations, number/symbol appendages, year/date formats, word combination and language-targeted presets (with live preview & size estimation). |
| **Captures** | Central management of capture files (`.cap`, `.pcap`, `.pcapng`, `.22000`, `.csv`, `.jsonl`). |
| **Sessions** | Document engagements: findings categorized by severity, exported as structured JSON reports. |

## Interfaces

Once running (`sudo ./wfaudit start`) you get three entry points:

| URL | What |
|---|---|
| `http://localhost:5173` | **React app** — the primary, full-featured web UI. |
| `http://localhost:8080/wfaudit.html` | **Standalone HTML console** — a single self-contained file, useful on minimal setups. |
| `http://localhost:8000/docs` | **Swagger API docs** — interactive REST reference; drive WFAudit from any HTTP client or script. |

## Requirements

**Operating system** — Linux only (uses monitor mode, `iptables`, raw sockets). **Kali Linux** or **Parrot OS** are recommended because the tooling ships preinstalled. Debian/Ubuntu/Arch/Fedora work too (`wfaudit install` pulls the packages).

**Privileges** — the backend **must run as root** (monitor mode, packet injection, `iptables`). The `install`, `start` and `stop` commands require `sudo`. `status`, `logs`, `preflight` and `help` do not.

**WiFi adapter** — you need at least **one** adapter that supports **monitor mode + packet injection**; **two** for Evil Twin / Enterprise. Recommended chipsets:

| Chipset | Example adapters | 5 GHz |
|---|---|---|
| Atheros AR9271 | Alfa AWUS036NHA, TP-Link TL-WN722N **v1** | ✗ |
| Ralink RT5572 | Alfa AWUS051NH | ✓ |
| Realtek RTL8812AU | Alfa AWUS036ACH | ✓ |
| MediaTek MT7612U | Alfa AWUS036ACM | ✓ |

> Avoid TL-WN722N **v2/v3**, integrated Intel (iwlwifi blocks injection) and Broadcom.

**GPU (optional)** — any CUDA/OpenCL GPU accelerates `hashcat` cracking by 100–1000×.

## Quick start

```bash
# 1. Clone
git clone https://github.com/andermonreal/WFAudit.git
cd WFAudit

# 2. Install everything (system packages + Python venv + Node modules + mitmproxy CA)
sudo ./wfaudit install

# 3. Start backend + both web interfaces
sudo ./wfaudit start

# 4. Open one of:
#    http://localhost:5173             → React UI
#    http://localhost:8080/wfaudit.html → standalone UI
#    http://localhost:8000/docs        → API docs

# 5. When you're done — stops everything and restores your network
sudo ./wfaudit stop
```

`install` auto-detects your distro (`apt` / `pacman` / `dnf`), is idempotent (safe to re-run), creates a project-local `.venv`, installs the frontend as your normal user (not root), and generates the mitmproxy CA used by MITM Full mode.

## The `wfaudit` control script

A single script manages the whole platform:

| Command | Root? | Description |
|---|:---:|---|
| `./wfaudit install` | ✔ | Install all system packages, the Python venv and Node modules. |
| `./wfaudit start` | ✔ | Start the backend (FastAPI) and both web interfaces. |
| `./wfaudit stop` | ✔ | Stop everything, kill residual attack processes, restore `iptables` / IP-forwarding. |
| `./wfaudit restart` | ✔ | `stop` + `start`. |
| `./wfaudit status` | — | Show service status and any active MITM / Evil Twin. |
| `./wfaudit logs` | — | Tail backend + frontend logs in real time. |
| `./wfaudit preflight` | — | Check that the required system tools are installed. |
| `./wfaudit clean` | — | Remove `.venv`, `node_modules`, `logs/` and `.pids/` (full reset). |
| `./wfaudit help` | — | Show usage. |

**Environment variables** (override before running):

| Variable | Default | Description |
|---|---|---|
| `WFAUDIT_HOST` | `0.0.0.0` | Backend bind host |
| `WFAUDIT_PORT` | `8000` | Backend (FastAPI) port |
| `WFAUDIT_FRONTEND_PORT` | `5173` | React (Vite) port |
| `WFAUDIT_STATIC_PORT` | `8080` | Standalone HTML port |
| `WFAUDIT_STATIC` | `1` | Set to `0` to skip serving the standalone HTML |

```bash
# Example: custom ports
WFAUDIT_PORT=9000 WFAUDIT_FRONTEND_PORT=3000 sudo ./wfaudit start
```

## Recommendations

- **Run on Kali or Parrot OS** — everything is preinstalled and driver support is best.
- **Always run `preflight` first** — a missing tool silently disables the module that needs it.
- **Use a GPU for cracking** — CPU cracking (`aircrack-ng`) does thousands of guesses/sec; a modern GPU (`hashcat`) does hundreds of thousands to millions.
- **Two adapters for AP-based attacks** — one in monitor mode (capture/deauth), one in AP mode (Evil Twin / rogue RADIUS).
- **Prefer PMKID over classic handshake capture** when possible — faster, quieter, no clients required.
- **Always `stop` when finished** — it restores your network stack; a lingering ARP spoof or Evil Twin will otherwise leave your machine misconfigured.

## Project structure

```
WFAudit/
├── wfaudit                  ← control script (install / start / stop / …)
├── backend/                 ← FastAPI backend (runs as root)
│   ├── app/
│   │   ├── main.py          ← app + middleware + lifespan
│   │   ├── config.py        ← settings (pydantic-settings)
│   │   ├── routers/         ← HTTP layer (system, interfaces, wifi, recon,
│   │   │                       attacks, advanced, captures, sessions, wordlists)
│   │   ├── services/        ← business layer (aircrack, pmkid, mitm, evil_twin, …)
│   │   └── utils/           ← process manager, parsers, OUI lookup, mitm addons
│   ├── requirements.txt
│   ├── README.md            ← in-depth backend documentation (ES)
│   └── API_REFERENCE.md     ← full endpoint reference
└── frontend/
    ├── wfaudit.html         ← standalone single-file UI
    └── React/               ← React + Vite app (primary UI)
```

Architecture at a glance:

```
Web UIs / scripts ──HTTP/JSON──▶ FastAPI backend ──▶ services ──▶ system tools
                                 (routers)          (orchestration)  (airodump-ng,
                                                                      hashcat, nmap,
                                                                      hostapd, …)
```

## Documentation

- **[backend/README.md](backend/README.md)** — exhaustive documentation (Spanish): WiFi security fundamentals, every module explained in depth, workflows and a glossary.
- **[backend/API_REFERENCE.md](backend/API_REFERENCE.md)** — complete REST endpoint reference.
- **Swagger UI** — live interactive docs at `http://localhost:8000/docs` while the backend is running.

## Troubleshooting

| Symptom | Fix |
|---|---|
| *"Backend failed to start"* | Check `logs/backend.log`. Usually a missing Python dep or port 8000 in use. |
| *Frontend not ready* | Vite's first build can take >20 s. Check `logs/frontend.log` and retry the URL. |
| *"Virtual environment not found"* | Run `sudo ./wfaudit install` first. |
| *Attack modules don't work* | Run `./wfaudit preflight` (or `curl localhost:8000/system/preflight`) to find missing tools; re-run `install`. |
| *No internet after stopping* | `stop` flushes `iptables` and the ARP spoof. If a WiFi adapter is stuck, `airmon-ng` may have killed NetworkManager — `sudo systemctl restart NetworkManager`. |

## Contributing

Contributions are welcome. Please:

1. Open an issue describing the change before large PRs.
2. Keep the three-layer architecture (routers → services → utils).
3. Only add capabilities intended for **authorized** auditing — no functionality whose sole purpose is unauthorized attack or evasion.

## ⚠️ Legal & responsible use

This software is provided for **lawful, authorized security testing, research and education only**.

- Use it **exclusively** on infrastructure you own or are **explicitly authorized in writing** to test.
- Intercepting, deauthenticating, spoofing or accessing networks/devices without authorization is illegal in most countries and can carry criminal and civil penalties.
- The maintainers and contributors provide this tool **as-is, with no warranty**, and are **not responsible** for any misuse or damage.

By using WFAudit you agree that you are solely responsible for complying with all applicable laws and for obtaining proper authorization.

## License

Released under the [MIT License](LICENSE). © 2026 Ander Monreal.
