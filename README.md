# WFAudit — WiFi Security Auditing Platform

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/python-3.11%E2%80%933.14-blue.svg" alt="Python 3.11–3.14">
  <img src="https://img.shields.io/badge/backend-FastAPI-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/web%20UI-static%20%C2%B7%20no%20build-61dafb.svg" alt="Static web UI, no build">
  <img src="https://img.shields.io/badge/platform-Linux-000000.svg" alt="Platform: Linux">
  <img src="https://img.shields.io/badge/deploy-one%20command-ff8c42.svg" alt="One-command deploy">
</p>

**WFAudit turns the entire zoo of command-line wireless-security tools — `airodump-ng`, `aireplay-ng`, `hcxdumptool`, `hashcat`, `nmap`, `hostapd`, `arpspoof`, `mitmdump` and friends — into a single REST API with a clean, zero-dependency web interface.**

Instead of juggling a dozen terminals and hand-parsing incompatible outputs, you drive an entire WiFi engagement — reconnaissance, handshake capture, offline cracking, wordlist generation, MITM, Evil Twin, WPA3/Enterprise attacks and internal network recon — from one clean UI or from automation scripts. One command installs it, one command runs it, one command tears it down and restores your network.

> ### ⚠️ Legal & Ethical Notice — read this first
>
> WFAudit is built for **authorized security auditing, research and education**. Use it **only** on networks and devices that you own or for which you hold **explicit written authorization** from the owner. Unauthorized access to or interference with wireless networks is a **crime** in most jurisdictions (e.g. the Computer Fraud and Abuse Act in the US, articles 197/264 of the Penal Code in Spain, Directive 2013/40/EU in the EU). **You are solely responsible for how you use this software.** The authors accept no liability for misuse. See the [full notice](#-legal--responsible-use).

---

## Table of contents

- [Highlights](#highlights)
- [What it can do](#what-it-can-do)
- [Architecture](#architecture)
- [Deployment](#deployment) ⭐
  - [1. Requirements](#1-requirements)
  - [2. Quick start (TL;DR)](#2-quick-start-tldr)
  - [3. Installation — what `install` does](#3-installation--what-install-does)
  - [4. Running it — what `start` launches](#4-running-it--what-start-launches)
  - [5. The `wfaudit` control script](#5-the-wfaudit-control-script)
  - [6. Configuration (environment variables)](#6-configuration-environment-variables)
  - [7. Files & artifacts created at runtime](#7-files--artifacts-created-at-runtime)
  - [8. Network teardown & safety](#8-network-teardown--safety)
  - [9. Verifying the deployment](#9-verifying-the-deployment)
  - [10. Remote / LAN access & hardening](#10-remote--lan-access--hardening)
- [Web interfaces](#web-interfaces)
- [Your first audit](#your-first-audit)
- [Sessions & reporting](#sessions--reporting)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Legal & responsible use](#-legal--responsible-use)
- [License](#license)

---

## Highlights

- 🧭 **One API, many tools** — 75+ REST endpoints across 9 modules wrapping the industry-standard wireless toolkit, with auto-generated Swagger docs at `/docs`.
- 🖥️ **Zero-dependency web UI** — static **HTML/CSS/JS** split into small modules (no build, no `node_modules`) with a built-in 17-section help manual, contextual tooltips, background-job notifications and universal input persistence across tabs.
- 🚀 **One-command deploy** — `sudo ./wfaudit install` sets up everything; `sudo ./wfaudit start` / `stop` runs and tears it down cleanly.
- 🧱 **Clean architecture** — three layers (HTTP routers → business services → tool utilities), fully async, easy to extend.
- 🔐 **Safe by default** — binds to `127.0.0.1` only; opt into LAN access protected by a required access token (`WFAUDIT_TOKEN`). See [Remote / LAN access & hardening](#10-remote--lan-access--hardening).
- 🔒 **Safe teardown** — `stop` kills residual attack processes and restores `iptables` / IP-forwarding so your machine goes back to normal.
- 📋 **Engagement tracking** — sessions with severity-rated findings, CVSS, photo evidence, an activity timeline and one-click **PDF / JSON** report export. See [Sessions & reporting](#sessions--reporting).

## What it can do

WFAudit is organized into modules. Each is exposed both in the web UIs and as REST endpoints.

| Module | What it does |
|---|---|
| **System** | Preflight checks — verifies ~30 system tools are installed, reports root status, hardware info and running audit processes. OUI/vendor lookup. |
| **Interfaces** | Manage WiFi adapters: monitor/managed mode, channel locking, TX-power, MAC randomization, chipset & capability detection. |
| **WiFi Scan** | Discover networks (2.4 / 5 GHz / dual-band) with security, cipher, WPS, PMKID availability, vendor (OUI) and associated clients. Includes **PNL analysis** to find Evil-Twin candidates from probe requests. |
| **Handshake & Crack** | Capture the WPA/WPA2 4-way handshake (targeted or broadcast deauth) and crack it offline with `aircrack-ng` (CPU) or `hashcat` (GPU). |
| **PMKID** | Clientless WPA/WPA2 attack via `hcxdumptool` — fastest, stealthiest capture, cracked with `hashcat` mode 22000. |
| **AP-Less** | KARMA-style honeypot that captures crackable material from a target's saved networks even when the real AP isn't nearby. |
| **Evil Twin** | Clone a network with `hostapd` + `dnsmasq`, optional captive portal, internet forwarding and integrated deauth. |
| **Enterprise (802.1X)** | Rogue RADIUS + Evil Twin to capture EAP credentials (PEAP/EAP-TTLS) and MSCHAP hashes (crackable with `hashcat -m 5500`). |
| **WPA3** | Detect transition mode, exploit WPA3→WPA2 downgrade, and SAE (Dragonfly) DoS. |
| **WPS** | Attack WPS-enabled APs with `reaver`/`bully`: **Pixie-Dust** (offline, seconds/minutes on vulnerable chipsets) or **PIN brute-force** (online), recovering the WPS PIN and the WPA PSK. Live progress, lockout detection, and a one-click launch from any WPS-flagged AP in the scanner. |
| **Recon (nmap)** | Internal network reconnaissance: host discovery (ARP/ping sweep), gateway-centered **interactive network graph** with an editable colour legend, and 3 per-host `nmap` scan profiles — **Silencioso** (`-sS -p-`), **Completo** (ports + versions + OS + NSE vuln scripts) and **UDP**. |
| **MITM** | Bidirectional ARP spoofing + `mitmproxy`. **Stealth mode** (DNS + TLS SNI + HTTP, no device warnings) or **Full mode** (HTTPS interception with a downloadable CA). Real-time flow viewer. |
| **Wordlists** | Build custom dictionaries from seed words — leetspeak, case mutations, number/symbol/year appendages (incl. 1900–2050 and `seed+year+symbol` like `cuchara2023!`), accent stripping, 450+ Spanish names, top-N common passwords and word combination — with varied live preview, **exact** size estimation and one-click **SecLists import** (rockyou, xato-net). |
| **Captures** | Central management of capture files (`.cap`, `.pcap`, `.pcapng`, `.22000`, `.csv`, `.jsonl`) with handshake/PMKID verification. |
| **Sessions** | Document engagements: severity-rated findings with CVSS, photo evidence and a full activity timeline; active/closed lifecycle (reopen requires a logged reason); exported as a professional **PDF** or structured **JSON** report. See [Sessions & reporting](#sessions--reporting). |

## Architecture

```
┌────────────────────────┐        ┌──────────────────────────────────────┐
│  Web UI / scripts       │  HTTP  │           FastAPI backend (root)      │
│  • Web UI     :8080     │ ─JSON─▶│  routers ─▶ services ─▶ system tools  │
│  • Swagger    :8000/docs│        │  (HTTP)     (orchestration)  (airodump │
│                         │        │                               hashcat, │
└────────────────────────┘        │                               nmap …)  │
                                   └──────────────────────────────────────┘
```

Three layers, fully async: **routers** (HTTP/validation) → **services** (business logic, attack orchestration) → **utils** (subprocess manager, parsers, OUI lookup, mitm addons). Long-running operations run as managed async subprocesses with cancellation, timeouts and cleanup.

---

## Deployment

Everything below is what you need to install, run, configure and tear down WFAudit — with the exact commands, ports, users and files involved.

### 1. Requirements

| | Requirement |
|---|---|
| **OS** | **Linux only** (needs monitor mode, `iptables`, raw sockets). **Kali** or **Parrot OS** recommended — the tooling ships preinstalled. Debian/Ubuntu/Arch/Fedora work too. |
| **Privileges** | The backend **must run as root**. `install`, `start`, `stop`, `restart` require `sudo`. `status`, `logs`, `preflight`, `help` do **not**. |
| **Python** | 3.11+ (tested up to **3.14**). Created as a project-local `.venv` by the installer. |
| **Node.js** | Not required. The web UI is static HTML/CSS/JS served by Python's built-in HTTP server — no build step, no `node_modules`. |
| **WiFi adapter** | At least **one** adapter with **monitor mode + packet injection**; **two** for Evil Twin / Enterprise / AP-Less (one AP, one monitor). |
| **GPU** *(optional)* | Any CUDA/OpenCL GPU accelerates `hashcat` cracking by 100–1000×. |
| **Disk** | ~1–2 GB for system packages + the Python venv. Captures/wordlists grow with use. |

**Supported distributions** (auto-detected by the installer):

| Package manager | Distributions |
|---|---|
| `apt` | Kali, Debian, Ubuntu, Parrot, Raspbian, Linux Mint, Pop!_OS |
| `pacman` | Arch, Manjaro, EndeavourOS, BlackArch |
| `dnf` | Fedora, RHEL, CentOS, Rocky, AlmaLinux |

**Recommended adapter chipsets:**

| Chipset | Example adapters | 5 GHz |
|---|---|:---:|
| Atheros AR9271 | Alfa AWUS036NHA, TP-Link TL-WN722N **v1** | ✗ |
| Ralink RT5572 | Alfa AWUS051NH | ✓ |
| Realtek RTL8812AU | Alfa AWUS036ACH | ✓ |
| MediaTek MT7612U | Alfa AWUS036ACM | ✓ |

> ❌ **Avoid:** TP-Link TL-WN722N **v2/v3** (Realtek RTL8188EUS, poor injection), integrated Intel (`iwlwifi` blocks injection) and most Broadcom adapters.

### 2. Quick start (TL;DR)

```bash
# 1. Clone
git clone https://github.com/andermonreal/WFAudit.git
cd WFAudit

# 2. Install everything (system packages + Python venv + mitmproxy CA)
sudo ./wfaudit install

# 3. Start backend + web interface
sudo ./wfaudit start

# 4. Open:
#    http://localhost:8080/       → web UI
#    http://localhost:8000/docs   → Swagger API docs

# 5. When you're done — stops everything and restores your network
sudo ./wfaudit stop
```

### 3. Installation — what `install` does

```bash
sudo ./wfaudit install
```

The installer is **idempotent** (safe to re-run) and **distro-aware**. In order, it:

1. **Detects your distribution** (`/etc/os-release`) and picks `apt` / `pacman` / `dnf`.
2. **Installs system packages** (skipping any already present):

   | Group | Packages |
   |---|---|
   | Python | `python3` `python3-pip` `python3-venv` `python3-dev` |
   | WiFi core | `aircrack-ng` `hcxdumptool` `hcxtools` `hashcat` |
   | Network | `nmap` `arp-scan` `tcpdump` `tshark` |
   | Attacks | `hostapd` `dnsmasq` `macchanger` `dsniff` (arpspoof) `arping` `mitmproxy` |
   | System | `iptables` `iproute2` `net-tools` `wireless-tools` `iw` `openssl` `curl` |
   | Build | `build-essential` `libssl-dev` `libffi-dev` |
   | Optional | `freeradius` (Enterprise) · `reaver` `bully` (WPS Pixie-Dust / PIN) · `crunch` |
   | Dictionaries | `seclists` `wordlists` — huge real-world password lists, importable and crackable from the **Wordlists** panel |

   > On Ubuntu 26.04+ (where `wireless-tools` was dropped from the repos) the installer automatically fetches `iwconfig` from the Debian pool, so the WiFi module keeps working.

3. **Creates the Python venv** at `./.venv`, upgrades `pip`/`wheel`/`setuptools`, and installs `backend/requirements.txt`:
   `fastapi` · `uvicorn` · `pydantic` · `pydantic-settings` · `python-multipart` · `websockets` · `aiofiles` · `psutil` · `python-nmap` · `scapy` · `netifaces2` · `mitmproxy`.
   The venv is then `chown`ed back to the invoking user so it stays readable without `sudo`.
4. **Checks the web UI** — `web/` is static HTML/CSS/JS with no build step or dependencies, so there's nothing to install.
5. **Generates the mitmproxy CA** used by MITM *Full* mode, at `~/.mitmproxy/` (the invoking user's home).
6. **Downloads the IEEE OUI database** to `backend/data/oui.txt` for accurate MAC-vendor lookups. If there's no internet it's skipped and can be fetched later from the **System** panel.

When it finishes you'll see `✓ Instalación completa`. If anything is missing later, run [`./wfaudit preflight`](#9-verifying-the-deployment).

### 4. Running it — what `start` launches

```bash
sudo ./wfaudit start
```

`start` launches **two** services and waits until the backend answers its health check. Exact processes:

| Service | Command | Runs as | Port | Working dir | Log | PID file |
|---|---|:---:|:---:|---|---|---|
| **Backend** (FastAPI) | `.venv/bin/uvicorn app.main:app --host $WFAUDIT_HOST --port $WFAUDIT_PORT` | **root** | `8000` | `backend/` | `logs/backend.log` | `.pids/backend.pid` |
| **Web UI** (static) | `python3 -m http.server $WFAUDIT_FRONTEND_PORT --bind $WFAUDIT_FRONTEND_HOST` | `$SUDO_USER` | `8080` | `web/` | `logs/frontend.log` | `.pids/frontend.pid` |

- The backend is the only service that needs root; the web UI is dropped to your normal user.
- **Both services bind to `127.0.0.1` by default** (localhost only, no auth). Set `WFAUDIT_TOKEN` to expose them on the LAN protected by a token — see [§10](#10-remote--lan-access--hardening).
- `start` refuses to run if a backend PID is already active — use `stop` (or `restart`) first.
- The web UI serves `web/index.html` at the root path, so `http://localhost:8080/` loads it directly.

### 5. The `wfaudit` control script

A single script manages the whole platform:

| Command | Root? | Description |
|---|:---:|---|
| `./wfaudit install` | ✔ | Install system packages, the Python venv and the mitmproxy CA. |
| `./wfaudit start` | ✔ | Start the backend (FastAPI) and the web interface. |
| `./wfaudit stop` | ✔ | Stop everything, kill residual attack processes, restore `iptables` / IP-forwarding. |
| `./wfaudit restart` | ✔ | `stop` + `start`. |
| `./wfaudit status` | — | Show per-service status (PID + URL) and any active MITM / Evil Twin. |
| `./wfaudit logs` | — | Tail backend + web-UI logs in real time (`multitail` if available, else `tail -f`). |
| `./wfaudit preflight` | — | Check that the required system tools are installed and print their paths. |
| `./wfaudit clean` | — | Remove `.venv`, `logs/` and `.pids/` (full reset; prompts for confirmation). |
| `./wfaudit help` | — | Show usage. |

### 6. Configuration (environment variables)

Override any of these on the command line before the script:

| Variable | Default | Description |
|---|---|---|
| `WFAUDIT_TOKEN` | *(unset)* | Access token. **If set**, WFAudit binds to `0.0.0.0` (LAN-reachable) **and requires this token** on every request. **If unset**, it stays on `127.0.0.1` with no auth. See [§10](#10-remote--lan-access--hardening). |
| `WFAUDIT_HOST` | `127.0.0.1` (or `0.0.0.0` when a token is set) | Force the backend bind host explicitly |
| `WFAUDIT_FRONTEND_HOST` | *(same as `WFAUDIT_HOST`)* | Force the web-UI bind host explicitly |
| `WFAUDIT_PORT` | `8000` | Backend (FastAPI) port |
| `WFAUDIT_FRONTEND_PORT` | `8080` | Web-UI port (static HTML server) |

```bash
# Example: custom ports
WFAUDIT_PORT=9000 WFAUDIT_FRONTEND_PORT=3000 sudo ./wfaudit start

# Example: expose on the LAN, protected by a token
sudo WFAUDIT_TOKEN=$(openssl rand -hex 24) ./wfaudit start
```

> ℹ️ The web UI reaches the backend on port **8000 of the same host it was loaded from**, so LAN access works with no changes. If you change `WFAUDIT_PORT`, update the `API` constant in `web/js/core.js` (or reverse-proxy `:8000`) accordingly.

The **backend** itself reads settings from `backend/app/config.py` (via `pydantic-settings`), which also accepts an optional `backend/.env` file. Notable settings include the data directories (below) — override e.g. `REPORTS_DIR=/path` as an environment variable if you want captures/reports stored elsewhere.

### 7. Files & artifacts created at runtime

```
WFAudit/
├── .venv/                    ← Python virtual environment (created by install)
├── logs/                     ← backend.log · frontend.log
├── .pids/                    ← backend.pid · frontend.pid
└── backend/data/             ← runtime data (created on first use)
    ├── captures/   handshakes/   pmkid/
    ├── wordlists/  reports/      logs/
    ├── hostapd/    enterprise/
    └── oui.txt                ← MAC-vendor database
~/.mitmproxy/                  ← mitmproxy CA (pem/cer/p12) for MITM Full mode
```

`./wfaudit clean` removes `.venv`, `logs/` and `.pids/`. It does **not** delete `backend/data/` (your captures, reports and wordlists) or the CA — remove those by hand if you really want a clean slate.

### 8. Network teardown & safety

`sudo ./wfaudit stop` does more than kill services — it **restores your machine's network state**, which is critical after MITM or Evil Twin:

1. Gracefully stops the web-UI and backend services (the backend runs its own cleanup on shutdown).
2. Sweeps residual attack processes: `arpspoof`, `mitmdump`, `mitm_stealth_monitor`, `hostapd`, `dnsmasq`, `airodump-ng`, `aireplay-ng`, `hcxdumptool`.
3. Flushes firewall rules: `iptables -t nat -F`, `iptables -F FORWARD`.
4. Disables IP forwarding: `net.ipv4.ip_forward=0`.

> Always `stop` when you finish. A lingering ARP spoof or an enabled `ip_forward` will otherwise leave your machine misconfigured. If you had put an adapter in monitor mode and lost WiFi afterward, `airmon-ng` likely stopped NetworkManager — bring it back with `sudo systemctl restart NetworkManager`.

### 9. Verifying the deployment

```bash
./wfaudit status        # per-service PID + URL, plus active MITM/Evil Twin
./wfaudit preflight     # ✓/✗ for each required CLI tool + its path
curl localhost:8000/system/health      # {"status":"ok"} when the API is up
curl localhost:8000/system/preflight   # detailed JSON: tools, root, system info
```

`preflight` checks: `aircrack-ng` `airodump-ng` `aireplay-ng` `airmon-ng` `hcxdumptool` `hcxpcapngtool` `hashcat` `nmap` `hostapd` `dnsmasq` `macchanger` `arpspoof` `mitmdump` `tshark` `tcpdump` `reaver` `bully` `iptables` `iw`. A missing tool silently disables the module that needs it, so run this first.

### 10. Remote / LAN access & hardening

**Safe by default.** With no configuration, both services bind to **`127.0.0.1`** — WFAudit is reachable only from the machine it runs on and needs no password. This is the recommended setup when you work on your own box.

**Exposing it to the LAN — protected by a token.** To reach the UI from another device (a phone, a second laptop on the same network), start it with a token:

```bash
sudo WFAUDIT_TOKEN=$(openssl rand -hex 24) ./wfaudit start
```

Setting `WFAUDIT_TOKEN` does two things at once: it **binds to `0.0.0.0`** (LAN-reachable) *and* **turns on authentication** — the backend answers `401` to every request without the correct token. There is no exposure without a token, and no exposure without protection.

- **How the token travels** — the web UI sends it automatically as `Authorization: Bearer <token>`; scripts can use that or an `X-API-Key` header; resources loaded straight into the DOM (evidence images, the PDF, wordlist/CA downloads) use a `?token=` query param.
- **In the UI** — opening the console against a protected backend prompts for the token once, stores it in the browser and reuses it. The **System → Seguridad / Acceso** card shows the auth state and lets you change the token or log out.
- **Unauthenticated routes** — only `/system/health`, `/system/auth-status` and `/docs` are exempt, so the health check and the login prompt work before you hold a token.
- **Pick a strong token** — anyone on the network who has it gets full control of the root backend. Use a long random value (`openssl rand -hex 24`) and only expose it on a trusted network.
- **Alternative** — keep the default localhost bind and reach the UI over an SSH tunnel: `ssh -L 8080:localhost:8080 -L 8000:localhost:8000 user@host`.
- **Never expose WFAudit directly to the internet** — even with a token, it drives offensive tooling as root.

---

## Web interfaces

Once running you get two entry points:

| URL | What |
|---|---|
| `http://localhost:8080/` | **Web UI** — the static web console: all modules, a built-in 17-section help manual, contextual tooltips, universal input persistence and a full wordlist generator. |
| `http://localhost:8000/docs` | **Swagger API docs** — interactive REST reference; drive WFAudit from any HTTP client or script. |

## Your first audit

A typical engagement, all doable from the UI (the **Help** tab walks through each step in depth):

1. **Dashboard** → confirm the backend is root and all tools are green.
2. **Sessions** → create a session to track findings for the report.
3. **Interfaces** → put your adapter into monitor mode.
4. **WiFi Scan** → dual-band (`abg`) scan; review APs, clients and PNL.
5. **PMKID** (fast, clientless) or **Handshake** capture → then crack under **Handshake & Crack** with a wordlist (build one under **Wordlists**).
6. **Attacks / Advanced** → Evil Twin, MITM, Enterprise or WPA3 as scoped.
7. **Recon** → map the internal network once you have access (host discovery, service/vuln scans, router probe).
8. **Sessions** → log findings (with photo evidence) as you go, then export the PDF or JSON report — see [Sessions & reporting](#sessions--reporting).
9. `sudo ./wfaudit stop` → restore the network.

## Sessions & reporting

**Sessions** are WFAudit's engagement layer — where everything you find during an audit is documented, tracked and turned into the client deliverable. Open it from the sidebar (`Principal → Sesiones`). The sidebar always shows which session is **active**, so new findings have somewhere to land.

### Session lifecycle

| Status | Meaning |
|---|---|
| **Active** (`active`) | Open engagement. Accepts new findings, edits and evidence. |
| **Closed** (`closed`) | Finalized and **read-only for findings** — reopen it to change anything. |

- **One active session at a time.** *Activar* makes a session the current target; *Desactivar* leaves none active. Any button that navigates to Sessions jumps straight to the active session when there is one.
- **Closing** a session asks for confirmation first.
- **Reopening** a closed session **requires a reason**, recorded in the timeline — you always know why and when an engagement was reopened.
- **Deleting** a session (findings + photo evidence + PDF) is guarded by a **double confirmation**.

### Findings

Each finding is a structured, report-ready entry:

| Field | Notes |
|---|---|
| **Severity** | `critical` · `high` · `medium` · `low` · `info` — colour-coded throughout the UI and the PDF. |
| **Category** | WiFi, network, MITM, credentials… |
| **CVSS** | Optional CVSS v3.1 score (0.0–10.0). |
| **Title / Description / Evidence / Recommendation** | Free text; *Evidence* is monospaced for command output. |
| **Photo evidence** | Several images per finding, attached from the add/edit modal (even before the finding is saved) and embedded into the PDF. |

- **Click a finding** to open a large read-only view (title, badges, description, evidence, photo gallery, recommendation) — nothing cramped into a tiny box.
- **Add / edit** run in a dedicated modal with the photo manager built in.
- **Sort** by severity, newest or oldest report date; **filter** by severity and category.
- Each card shows its **report date**, plus the **last-edited date** when it has been modified.

### Timeline (activity log)

Every session keeps a full chronological log for traceability. Events are recorded automatically — creation, findings added / edited / deleted, evidence uploaded, close and reopen (with its reason) — and you can add your own **comments, notes and corrections** as the engagement evolves.

### The three sub-tabs

| Sub-tab | What it shows |
|---|---|
| **Resumen** | Visual overview: severity breakdown, computed risk level and priority findings. |
| **Hallazgos** | The full findings list — sortable and filterable. |
| **Timeline** | The complete activity log. |

### Exporting the report

- **PDF** — a professional report (cover, executive summary with a severity table and overall risk level, then every finding by severity with its embedded photos), downloaded with one click.
- **JSON** — the same data structured for tooling or archival (`GET /sessions/{id}/report`).

### Where it's stored

Sessions persist to disk on every change, so nothing is lost on restart:

```
<DATA_DIR>/reports/session_<id>.json    ← the session (findings, events, metadata)
<DATA_DIR>/reports/informe_<id>.pdf     ← generated PDF report
<DATA_DIR>/evidence/<id>/<finding>/     ← uploaded photo evidence
```

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
└── web/                     ← static web UI (no build, no node_modules)
    ├── index.html          ← markup + <link>/<script src> only
    ├── css/styles.css      ← all styles
    └── js/                 ← core · recon · sessions · capture · attacks · app
```

## Documentation

- **[backend/README.md](backend/README.md)** — exhaustive documentation (Spanish): WiFi security fundamentals, every module explained in depth, workflows and a glossary.
- **[backend/API_REFERENCE.md](backend/API_REFERENCE.md)** — complete REST endpoint reference.
- **Swagger UI** — live interactive docs at `http://localhost:8000/docs` while the backend is running.
- **In-app Help** — the web UI ships a 17-section manual (overview, install, security, workflow, every panel, wordlists, tips, glossary) accessible from its sidebar.

## Troubleshooting

| Symptom | Fix |
|---|---|
| *"Backend failed to start"* | Check `logs/backend.log`. Usually a missing Python dep or port `8000` already in use. |
| *`pydantic-core` fails to build on install* | You're on a very new Python (e.g. 3.14) with an old pin. This repo already ships compatible pins (`pydantic 2.13+`); re-run `sudo ./wfaudit install`. |
| *`iwconfig` missing (Ubuntu 26.04+)* | `wireless-tools` was dropped upstream; the installer pulls it from the Debian pool automatically. Re-run `install` if you skipped it. |
| *Web UI won't load* | Check `logs/frontend.log`. Make sure `web/index.html` exists and port `8080` is free. The UI is served at `http://localhost:8080/`. |
| *"Virtual environment not found"* | Run `sudo ./wfaudit install` first. |
| *Attack modules don't work* | Run `./wfaudit preflight` (or `curl localhost:8000/system/preflight`) to find missing tools; re-run `install`. |
| *MITM Full shows cert warnings* | Install the mitmproxy CA on the target device first — download it from the MITM panel (or `~/.mitmproxy/`). |
| *No internet after stopping* | `stop` flushes `iptables` and the ARP spoof. If a WiFi adapter is stuck: `sudo systemctl restart NetworkManager`. |
| *Port already in use* | Another WFAudit instance or service holds `8000`/`8080`. Change ports via the env vars in §6, or free the port. |

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
