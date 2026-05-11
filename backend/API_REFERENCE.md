# WFAudit Backend API Reference

Comprehensive reference for the FastAPI backend. Every endpoint, every parameter, every response shape — what a frontend developer needs to integrate without reading server code.

> **Base URL:** `http://localhost:8000` (default FastAPI port)  
> **Auth:** None — runs as root locally, no token required  
> **Content-Type:** `application/json` for POST/PATCH/DELETE bodies  
> **Interactive docs:** `/docs` (Swagger UI), `/redoc` (ReDoc)

---

## Table of contents

1. [Conventions & common patterns](#conventions)
2. [System](#system) — health, tools, processes, OUI
3. [Interfaces](#interfaces) — adapter mode, MAC spoof, network status
4. [WiFi](#wifi) — scan APs/clients, capture handshake, crack, deauth
5. [Recon](#recon) — nmap host discovery, deep/vuln scans, router probe
6. [Advanced](#advanced) — PMKID, AP-Less, Enterprise, WPA3
7. [Attacks](#attacks) — Evil Twin, MITM, deauth, CA cert
8. [Captures](#captures) — list/check/delete capture files
9. [Sessions](#sessions) — audit sessions and findings
10. [Wordlists](#wordlists) — generate, manage, preview wordlists

---

<a id="conventions"></a>
## 1. Conventions & common patterns

### Error responses

Errors follow standard FastAPI shape:
```json
{ "detail": "Error message here" }
```
Many service-level methods return a body with an `error` field instead of throwing 4xx/5xx. Always check both.

### Process IDs

Long-running operations (scans, attacks) return a process record with:
```json
{ "id": "p_abc123", "command": "...", "status": "running", "started_at": "...", "finished_at": null, "return_code": null }
```
Status values: `running` · `completed` · `failed` · `cancelled`.

### Datetimes

ISO 8601 UTC strings: `"2026-05-07T15:23:45.123456"`.

### Booleans in query strings

Use lowercase: `?stealth=true`, `?credentials_only=false`.

### Path traversal protection

Filename-based endpoints (`/wordlists/{filename}/info`, etc.) strip path components — only the basename is used. Do **not** include directory paths in `filename`.

### Schemas referenced

This doc uses simplified JSON shapes; see `app/models/schemas.py` for pydantic source of truth.

---

<a id="system"></a>
## 2. `/system` — Health, tools, processes

### `GET /system/health`
Liveness check. Use for load-balancer probes.
**Response:** `{ "status": "ok" }`

### `GET /system/info`
Hostname, OS, kernel, root status.
**Response:**
```json
{
  "hostname": "kali",
  "os": "Linux 6.x",
  "is_root": true,
  "user": "root",
  "python_version": "3.11.x",
  "cpu_count": 8,
  "memory_total_gb": 16
}
```

### `GET /system/tools`
Check which security tools are installed (aircrack-ng, nmap, hostapd, mitmproxy, hashcat, etc.).
**Response:** `{ "<tool_name>": { "installed": bool, "version": str?, "critical": bool, "category": str } }`

### `GET /system/tools/categories`
Same data, grouped by category (`wifi_audit`, `network`, `cracking`, `mitm`).

### `GET /system/preflight`
Combined check: system info + tools + readiness.
**Response:**
```json
{
  "system": { ...same as /info },
  "tools": { ...same as /tools },
  "ready": true,
  "missing_critical": [],
  "warnings": []
}
```

### `GET /system/processes`
List all managed background processes.
**Response:** array of:
```json
{
  "id": "p_abc123",
  "command": "airodump-ng wlan0mon -w /data/captures/...",
  "status": "running",
  "started_at": "2026-05-07T...",
  "finished_at": null,
  "return_code": null
}
```

### `POST /system/processes/{proc_id}/cancel`
Kill a running process by id.
**Response:** `{ "cancelled": bool }`

### `GET /system/oui/{mac}`
Look up manufacturer for a MAC address.
**Response:** `{ "mac": "AA:BB:CC:11:22:33", "oui": "AABBCC", "manufacturer": "Apple, Inc.", "is_randomized": false }`

### `POST /system/oui/download`
Download/refresh the IEEE OUI database. Run once after install.
**Response:** `{ "success": bool, "entries_loaded": int }`

---

<a id="interfaces"></a>
## 3. `/interfaces` — Network adapters

### `GET /interfaces/`
List all WiFi interfaces.
**Response:** array of:
```json
{
  "name": "wlan0",
  "mac": "aa:bb:cc:dd:ee:ff",
  "driver": "iwlwifi",
  "chipset": "Intel AX200",
  "mode": "managed",      // "managed" | "monitor"
  "is_up": true,
  "supports_monitor": true,
  "supports_5ghz": true,
  "phy": null,
  "tx_power": 20
}
```

### `GET /interfaces/network-status`
**Use this on the Interfaces page header.** Reports ALL interfaces (ethernet + wifi) with their roles.
**Response:**
```json
{
  "ethernet": [{ "interface": "eth0", "state": "up", "ipv4": "192.168.1.50" }],
  "wifi_managed": [{ "interface": "wlan1", "state": "up", "ipv4": "192.168.1.55" }],
  "wifi_monitor": [{ "interface": "wlan0", "state": "up", "ipv4": null }],
  "internet_available": true,
  "suggestions": [
    { "level": "ok"|"info"|"warning", "message": "..." }
  ]
}
```

### `GET /interfaces/{name}`
Detail for a single interface. Same shape as the array entries from `/interfaces/`.
**Returns 404** if interface doesn't exist.

### `POST /interfaces/{name}/monitor`
Switch interface to monitor mode. **Surgical by default** — does NOT kill NetworkManager globally.
**Query params:**
- `kill_conflicting: bool = false` — fallback only. Set `true` ONLY if surgical fails (rare). Disconnects ethernet.

**Response:**
```json
{
  "original_interface": "wlan0",
  "monitor_interface": "wlan0",
  "steps": [{ "step": "nmcli_unmanage", "rc": 0, "...": "..." }],
  "success": true,
  "method": "surgical (per-interface, preserves ethernet/other wlans)",
  "preserves_internet": true
}
```

### `POST /interfaces/{name}/managed`
Return interface to managed mode. Re-enables NetworkManager management for this interface only.
**Response:** Similar shape with `"interface"` and `"steps"`.

### `POST /interfaces/{name}/mac`
Change MAC address.
**Query params (one of):**
- `new_mac: str` — specific MAC: `?new_mac=AA:BB:CC:DD:EE:FF`
- `vendor_prefix: str` — first 3 octets to mimic vendor: `?vendor_prefix=00:1A:2B`

If neither is provided → random MAC.

**Response:** `{ "interface": str, "output": str, "success": bool, "new_mac": str }`

### `POST /interfaces/{name}/txpower`
**Query param:** `power_dbm: int = 20`
**Response:** `{ "interface": str, "tx_power": int, "success": bool }`

### `GET /interfaces/{name}/channels`
List supported channels.
**Response:** `{ "interface": str, "channels_2ghz": [int], "channels_5ghz": [int] }`

---

<a id="wifi"></a>
## 4. `/wifi` — WiFi scanning & cracking

### `POST /wifi/scan`
Start a WiFi scan with airodump-ng.
**Body:**
```json
{
  "interface": "wlan0mon",
  "channel": null,           // optional, locks scan to one channel
  "duration": 30,            // seconds
  "target_bssid": null,      // optional
  "target_essid": null,      // optional
  "band": "bg"               // "bg"=2.4GHz, "a"=5GHz, "abg"=dual
}
```
**Response:** `WifiScanResult`:
```json
{
  "id": "scan_abc",
  "status": "running",
  "interface": "wlan0mon",
  "band": "bg",
  "started_at": "...",
  "finished_at": null,
  "access_points": [/* see AP shape below */],
  "clients": [/* see Client shape below */],
  "client_count": 0,
  "capture_files": []
}
```
Poll `GET /wifi/scans/{id}` for progress.

#### `AccessPoint` shape:
```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "essid": "MyWiFi",
  "channel": 6,
  "power": -55,
  "security": "WPA2",        // "OPEN"|"WEP"|"WPA"|"WPA2"|"WPA3"|"WPS"|"UNKNOWN"
  "cipher": "CCMP",
  "auth": "PSK",
  "beacons": 1234,
  "data_packets": 567,
  "max_speed": 130,
  "clients": ["mac1", "mac2"],
  "first_seen": "...",
  "last_seen": "...",
  "wps": false,
  "pmkid_available": false,
  "manufacturer": "Cisco",
  "band": "bg",
  "is_hidden": false
}
```

#### `WirelessClient` shape:
```json
{
  "mac": "...", "bssid": null, "power": -67,
  "rate": "11", "lost": 5, "frames": 234,
  "probes": ["HomeWiFi", "OfficeWiFi"],
  "manufacturer": "Apple",
  "first_seen": "...", "last_seen": "..."
}
```

### `GET /wifi/scans`
List all WiFi scans (with metadata only, no full client lists).
**Response:** array of `WifiScanResult`.

### `GET /wifi/scans/{scan_id}`
Full result of a specific scan.
**Returns 404** if not found.

### `POST /wifi/scans/{scan_id}/stop`
Stop a running scan early.
**Response:** `{ "stopped": bool }`

### `GET /wifi/scans/{scan_id}/pnl`
Analyze Preferred Network Lists from client probes. **Use for evil twin candidate identification.**
**Response:** `PnlReport`:
```json
{
  "scan_id": "...",
  "total_clients": 12,
  "associated_clients": 8,
  "unassociated_clients": 4,
  "unique_probed_networks": ["HomeWiFi", "Starbucks", "..."],
  "clients": [/* PnlAnalysis per client */],
  "evil_twin_candidates": ["Starbucks"]   // Networks probed by ≥2 clients
}
```

#### `PnlAnalysis` shape:
```json
{
  "client_mac": "...",
  "manufacturer": "...",
  "probed_networks": ["..."],
  "is_associated": false,
  "associated_bssid": null,
  "associated_essid": null,
  "vulnerability_notes": ["Probes for open network — vulnerable to evil twin"]
}
```

### `POST /wifi/handshake`
Capture WPA/WPA2 4-way handshake.
**Body:** `HandshakeCaptureRequest`:
```json
{
  "interface": "wlan0mon",
  "target_bssid": "AA:BB:CC:DD:EE:FF",
  "target_essid": null,         // optional, used in filename
  "channel": 6,
  "timeout": 120,
  "deauth_first": true,
  "deauth_packets": 10,
  "deauth_client": null,        // null = broadcast deauth
  "band": "bg"
}
```
**Response:**
```json
{
  "handshake_captured": true,
  "target_bssid": "...",
  "target_essid": "...",
  "capture_file": "/data/captures/HomeWiFi-1234567890.cap",
  "duration_seconds": 87,
  "deauth_sent": true,
  "error": null
}
```

### `POST /wifi/crack`
Run dictionary attack on a captured handshake.
**Body:** `WpaCrackRequest`:
```json
{
  "capture_file": "/data/captures/HomeWiFi-12345.cap",
  "target_bssid": "AA:BB:CC:DD:EE:FF",
  "wordlist": "rockyou.txt",          // alias or path
  "custom_wordlist_path": null         // overrides `wordlist` if set
}
```
**Response:**
```json
{
  "success": true,
  "key": "myWifiPass123!",
  "target_bssid": "...",
  "target_essid": "...",
  "duration_seconds": 423,
  "keys_tried": 1543210,
  "error": null
}
```

### `POST /wifi/deauth`
Send deauthentication packets.
**Body:** `DeauthRequest`:
```json
{
  "interface": "wlan0mon",
  "target_bssid": "AA:BB:CC:DD:EE:FF",
  "client_mac": null,                  // null = broadcast
  "packets": 50,
  "use_essid": null,                   // alternative: target by ESSID
  "reason": "Force handshake capture for WPA audit"
}
```
**Response:** `{ "success": bool, "packets_sent": int, "target": str, "client": str }`

---

<a id="recon"></a>
## 5. `/recon` — Network reconnaissance (nmap)

### `POST /recon/scan`
Run nmap with configurable scan type.
**Body:** `NmapTarget`:
```json
{
  "target": "192.168.0.0/24",          // IP, hostname, CIDR, or range
  "scan_type": "quick",                // see scan_type values below
  "ports": null,                       // e.g. "22,80,443" or "1-1024"
  "custom_args": null,                 // raw nmap args (only when scan_type="custom")
  "timeout": 300
}
```

**`scan_type` values:**
- `quick` — fast ping sweep (`-sn`)
- `full` — all ports + OS + services (`-sS -sV -O -p-`)
- `service` — service/version detection (`-sV`)
- `vuln` — NSE vuln scripts (`--script=vuln`)
- `os_detect` — OS fingerprinting (`-O`)
- `stealth` — SYN scan (`-sS`)
- `udp` — UDP top 100 (`-sU --top-ports 100`)
- `custom` — uses `custom_args` raw

**Response:** `NmapScanResult`:
```json
{
  "id": "nmap_xyz",
  "status": "completed",
  "target": "192.168.0.0/24",
  "scan_type": "quick",
  "started_at": "...",
  "finished_at": "...",
  "hosts": [/* see DiscoveredHost */],
  "command": "nmap -sn 192.168.0.0/24",
  "raw_xml": null
}
```

#### `DiscoveredHost` shape:
```json
{
  "ip": "192.168.0.5",
  "mac": "AA:BB:...",
  "hostname": "router.local",
  "os_guess": "Linux 5.x",
  "state": "up",
  "ports": [
    { "port": 80, "protocol": "tcp", "state": "open", "service": "http", "version": "nginx 1.18" }
  ],
  "services": [
    { "port": 80, "name": "http", "product": "nginx", "version": "1.18", "extra": null }
  ],
  "scripts_output": null
}
```

### `POST /recon/discover`
Quick host discovery (ping sweep).
**Query param:** `cidr: str = "192.168.0.0/24"`
**Response:** Same `NmapScanResult` shape.

### `POST /recon/deep/{ip}`
Deep scan on a single host (full ports + services).
**Response:** Same shape, single host in `hosts[]`.

### `POST /recon/vuln/{ip}`
Vuln-script scan on a single host.
**Response:** Same shape with vuln data in `services[]` / `scripts_output`.

### `POST /recon/router`
Probe a router/gateway for admin services.
**Body:** `RouterProbeRequest`:
```json
{
  "target_ip": "192.168.0.1",
  "check_default_creds": true,
  "check_known_vulns": true,
  "brute_force": false,
  "credential_list": null
}
```
**Response:**
```json
{
  "reachable": true,
  "http_open": true,
  "https_open": true,
  "ssh_open": false,
  "telnet_open": false,
  "services": [{ "port": 80, "product": "...", "version": "..." }]
}
```
> Note: this endpoint exists but is no longer surfaced in the frontend's Recon panel.

### `GET /recon/scans`
List all nmap scans (most recent first).
**Response:** array of `NmapScanResult` (with metadata; full hosts may be summarized).

### `GET /recon/scans/{scan_id}`
Get full scan result by id.
**Returns 404** if not found.

---

<a id="advanced"></a>
## 6. `/advanced` — PMKID / AP-Less / Enterprise / WPA3

### PMKID

#### `POST /advanced/pmkid/capture`
**Body:** `PmkidCaptureRequest`:
```json
{
  "interface": "wlan0mon",
  "target_bssid": "AA:BB:CC:DD:EE:FF",
  "target_essid": null,
  "channel": 6,
  "timeout": 60
}
```
**Response:** `{ "pmkid_captured": bool, "pmkid_file": str, "target_bssid": str, "duration_seconds": int, "error": str|null }`

#### `POST /advanced/pmkid/crack`
**Body:** `PmkidCrackRequest`:
```json
{
  "pmkid_file": "/data/pmkid/MyWiFi-1234.22000",
  "target_bssid": "AA:BB:...",
  "target_essid": "MyWiFi",
  "wordlist": "rockyou.txt"
}
```
**Response:** `{ "success": bool, "key": str|null, "duration_seconds": int }`

#### `GET /advanced/pmkid/captures`
List PMKID capture files.
**Response:** array of file metadata.

### AP-Less (Honeypot)

#### `POST /advanced/apless/start`
Creates a fake AP that captures handshakes from probing clients.
**Requires 2 WiFi adapters** (one monitor, one AP).
**Body:** `ApLessAttackRequest`:
```json
{
  "monitor_interface": "wlan0mon",
  "ap_interface": "wlan1",
  "target_essid": "FreeWiFi",
  "channel": 6,
  "wpa_version": 2,
  "fake_passphrase": "fakepassword123",
  "capture_timeout": 300
}
```
**Response:** `{ "started": bool, "process_ids": [str], "handshakes_dir": str }`

#### `POST /advanced/apless/stop`
**Response:** `{ "stopped": bool }`

#### `GET /advanced/apless/status`
**Response:** `{ "active": bool, "started_at": str, "target_essid": str, "captured_handshakes": int }`

#### `GET /advanced/apless/results`
**Response:** array of captured handshakes with metadata.

### Enterprise (WPA2-Enterprise / 802.1X)

#### `POST /advanced/enterprise/start`
Rogue RADIUS + Evil Twin to capture EAP credentials. **Requires 2 WiFi adapters.**
**Body:** `EnterpriseAttackRequest`:
```json
{
  "monitor_interface": "wlan0mon",
  "ap_interface": "wlan1",
  "target_essid": "Corp-WiFi",
  "channel": 6,
  "eap_type": "PEAP",            // "PEAP" | "TTLS" | "FAST"
  "capture_creds": true
}
```
**Response:** `{ "started": bool, "process_ids": [str] }`

#### `POST /advanced/enterprise/stop`
**Response:** `{ "stopped": bool }`

#### `GET /advanced/enterprise/status`
**Response:** `{ "active": bool, "captured_count": int, ... }`

#### `GET /advanced/enterprise/credentials`
**Response:** array of captured credentials (username + challenge/response).

### WPA3

#### `POST /advanced/wpa3/attack`
**Body:** `Wpa3AttackRequest`:
```json
{
  "interface": "wlan0mon",
  "target_bssid": "AA:BB:...",
  "target_essid": "WPA3-Net",
  "channel": 6,
  "attack_type": "downgrade",    // "downgrade" | "transition_mode" | "dos"
  "timeout": 120
}
```
**Response:** `{ "success": bool, "attack_type": str, "findings": [...] }`

#### `GET /advanced/wpa3/results`
**Response:** array of past results.

---

<a id="attacks"></a>
## 7. `/attacks` — Evil Twin & MITM

### Evil Twin

#### `POST /attacks/evil-twin/start`
**Body:** `EvilTwinRequest`:
```json
{
  "interface": "wlan1",                  // adapter for the fake AP
  "target_essid": "MyWiFi",
  "target_bssid": null,
  "channel": 6,
  "internet_interface": "eth0",          // null for offline mode
  "captive_portal": false,
  "deauth_legitimate": false,
  "deauth_interface": null,              // required if deauth_legitimate=true
  "deauth_bssid": null,
  "deauth_packets": 50
}
```
**Response:** `{ "started": bool, "ap_interface": str, "process_ids": [str], "captive_url": str|null }`

#### `POST /attacks/evil-twin/stop`
**Response:** `{ "stopped": bool }`

#### `GET /attacks/evil-twin/status`
**Response:**
```json
{
  "active": true,
  "started_at": "...",
  "target_essid": "...",
  "ap_interface": "wlan1",
  "captive_portal": false,
  "internet_sharing": true,
  "connected_clients": 3,
  "process_ids": ["..."]
}
```

#### `GET /attacks/evil-twin/flows`
Real-time capture of DNS queries, TLS SNI, and HTTP requests from connected clients.
**Query params:**
- `limit: int = 100`
- `host: str?` — partial hostname filter
- `method: str?` — `GET`, `POST`, etc.

**Response:**
```json
{
  "total": 1234,
  "filtered": 87,
  "flows": [
    {
      "type": "dns" | "sni" | "http",
      "timestamp": "...",
      "client_ip": "10.0.0.5",
      "client_mac": "...",
      "host": "example.com",
      "method": "GET",
      "path": "/login",
      "...": "type-specific fields"
    }
  ]
}
```

#### `POST /attacks/evil-twin/deauth`
Standalone deauth (works even when Evil Twin isn't active).
**Body:**
```json
{
  "interface": "wlan0mon",
  "target_bssid": "AA:BB:...",
  "client_mac": null,
  "packets": 50,
  "channel": null
}
```
**Response:** `{ "success": bool, "packets_sent": int, "target": str }`

### MITM

#### `POST /attacks/mitm/start`
**Body:** `MitmRequest`:
```json
{
  "interface": "wlan0",                  // interface attacker uses to reach LAN
  "target_ips": ["192.168.0.5", "192.168.0.10"],   // empty = all hosts
  "gateway": "192.168.0.1",
  "proxy_port": 8080,
  "stealth": true,                       // true=tshark passive, false=mitmproxy active
  "ssl_strip": false,
  "capture_credentials": true,
  "filter_hosts": []
}
```
**Stealth mode:** tshark captures DNS+SNI+HTTP cleartext only. Invisible. No CA cert needed.
**Full mode:** mitmproxy intercepts HTTPS. Requires CA cert installed on target.

**Response:** `{ "started": bool, "mode": "stealth"|"full", "process_ids": [str], "proxy_port": int }`

#### `POST /attacks/mitm/stop`
**Response:** `{ "stopped": bool }`

#### `GET /attacks/mitm/status`
**Response:**
```json
{
  "active": true,
  "mode": "stealth",
  "started_at": "...",
  "target_ips": ["..."],
  "gateway": "...",
  "proxy_port": 8080,
  "captured_flows": 234,
  "captured_credentials": 2,
  "process_ids": [...]
}
```

#### `GET /attacks/mitm/flows`
**Query params:**
- `limit: int = 50`
- `offset: int = 0`
- `host: str?`
- `method: str?`
- `credentials_only: bool = false`

**Response:**
```json
{
  "total": 1234,
  "filtered": 87,
  "flows": [
    {
      "id": "flow_abc",
      "timestamp": "...",
      "client_ip": "...",
      "method": "POST",
      "host": "login.example.com",
      "path": "/auth",
      "status_code": 200,
      "request_size": 1024,
      "response_size": 256,
      "has_credentials": true,
      "credentials": [{ "type": "form", "username": "...", "password": "..." }],
      "headers": { ... }
    }
  ]
}
```

#### `GET /attacks/mitm/ca-cert`
Info about the mitmproxy CA cert (paths, install instructions).
**Response:**
```json
{
  "cert_dir": "/root/.mitmproxy",
  "certs": {
    "mitmproxy-ca-cert.pem": { "exists": true, "path": "...", "description": "PEM (Android/Linux/macOS)" },
    "mitmproxy-ca-cert.cer": { "exists": true, "path": "...", "description": "CER (iOS/Windows)" },
    "mitmproxy-ca-cert.p12": { "exists": true, "path": "...", "description": "PKCS12 (Windows)" }
  },
  "instructions": {
    "android": "...", "ios": "...", "windows": "...", "linux": "..."
  }
}
```

#### `GET /attacks/mitm/ca-cert/download/{format}`
Download the CA cert. `format` ∈ `pem` | `cer` | `p12`.
**Returns:** the binary file (Content-Type per format).
**Errors:** 400 invalid format, 404 if cert not generated yet (run mitmdump once).

---

<a id="captures"></a>
## 8. `/captures` — Capture file management

### `GET /captures/`
List all capture files (recursive across `captures/`, `handshakes/`, `pmkid/` directories).
**Query params:**
- `directory: str?` — restrict to a specific directory
- `session_id: str?` — filter by session (file in `<dir>/<session_id>/...` or with sidecar `.meta.json`)

**Response:** array of `CaptureFile`:
```json
{
  "filename": "MyWiFi-1234567890.cap",
  "filepath": "/data/captures/MyWiFi-1234567890.cap",
  "file_type": "cap",
  "size_bytes": 234567,
  "created_at": "2026-05-07T15:23:45",
  "target_essid": "MyWiFi",
  "has_handshake": false,
  "has_pmkid": false
}
```

### `POST /captures/check-handshake`
Verify if a capture file contains a usable handshake or PMKID.
**Query param:** `filepath: str`
**Response:**
```json
{
  "filepath": "...",
  "has_handshake": true,
  "has_pmkid": false,
  "networks_found": 3,
  "raw_output": "..."
}
```

### `DELETE /captures/`
Delete a capture file (only within allowed data dirs).
**Query param:** `filepath: str`
**Response:** `{ "deleted": bool, "filepath": str, "error": str? }`

---

<a id="sessions"></a>
## 9. `/sessions` — Audit sessions & findings

### `POST /sessions/`
Create a new audit session.
**Body:** `CreateSessionRequest`:
```json
{
  "name": "ACME Q4 audit",
  "company": "ACME Corp",
  "auditor": "Monre",
  "notes": "Scope: 1st floor wifi, parking lot perimeter. Contract #2026-A."
}
```
**Response:** `AuditSession`:
```json
{
  "id": "abc12345",                    // 8-char hex
  "name": "...",
  "company": "...",
  "auditor": "...",
  "created_at": "2026-05-07T...",
  "status": "active",                   // "active" | "closed"
  "notes": "...",
  "interface_used": null,
  "findings": []
}
```

### `GET /sessions/`
List all sessions (newest first). Survives PC restart.
**Response:** array of `AuditSession`.

### `GET /sessions/{session_id}`
Full session including all findings.
**Returns 404** if not found.

### `POST /sessions/{session_id}/findings`
Add a finding.
**Body:** `Finding`:
```json
{
  "session_id": "abc12345",            // overwritten by URL param
  "category": "wifi",                  // "wifi"|"network"|"router"|"credentials"|"encryption"|"access_control"|"other"
  "severity": "high",                  // "critical"|"high"|"medium"|"low"|"info"
  "title": "WPA2 with weak passphrase",
  "description": "Multi-line description supported.\nLine breaks preserved in display.",
  "evidence": "Captured handshake at /data/captures/...\nKey cracked in 4m32s with rockyou.txt",
  "recommendation": "Rotate WiFi password.\nUse 16+ chars random.\nEnable WPA3-SAE if hardware supports."
}
```
**Response:** the created finding with assigned `id`:
```json
{
  "id": "f1234567",
  "category": "...",
  "severity": "...",
  "title": "...",
  "description": "...",
  "evidence": "...",
  "recommendation": "...",
  "timestamp": "..."
}
```

### `PATCH /sessions/{session_id}/findings/{finding_id}`
Edit an existing finding. Send only the fields to update.
**Body:** Same fields as `Finding` (all optional).
**Response:** updated finding object.

### `DELETE /sessions/{session_id}/findings/{finding_id}`
Remove a finding.
**Response:** `{ "deleted": true, "remaining": int }`

### `POST /sessions/{session_id}/close`
Mark a session as closed.
**Response:** updated `AuditSession` with `status: "closed"`.

### `POST /sessions/{session_id}/reopen`
Reopen a closed session.
**Response:** updated `AuditSession` with `status: "active"`.

### `GET /sessions/{session_id}/report`
Generate an audit report (findings grouped by severity).
**Response:**
```json
{
  "audit_report": {
    "session": { /* full AuditSession */ },
    "findings_by_severity": {
      "critical": [...],
      "high": [...],
      "medium": [...],
      "low": [...],
      "info": [...]
    },
    "summary": {
      "total": 12,
      "critical": 1, "high": 3, "medium": 5, "low": 2, "info": 1
    },
    "generated_at": "..."
  }
}
```

---

<a id="wordlists"></a>
## 10. `/wordlists` — Custom dictionary generator

### `GET /wordlists`
List wordlists in the configured wordlists directory.
**Response:**
```json
{
  "wordlists": [
    {
      "filename": "custom.txt",
      "path": "/data/wordlists/custom.txt",
      "size_bytes": 18372456,
      "size_human": "17.5 MB",
      "modified_at": "2026-05-07T...",
      "created_at": "...",
      "lines": 1543210,
      "sample_first": ["password1", "Password!", "..."]
    }
  ],
  "total": 5,
  "directory": "/data/wordlists",
  "total_size_bytes": 92837465,
  "total_size_human": "88.5 MB"
}
```

### `POST /wordlists/generate`
Generate a wordlist with mutations from seed words. Output saved to wordlists dir.
**Body:** `WordlistGenerateRequest` — full shape:
```json
{
  "seed_words": ["Ander", "Ibai", "2008"],
  "output_filename": "custom.txt",

  "use_lowercase": true,
  "use_uppercase": true,
  "use_capitalize": true,
  "use_alternating_case": false,

  "use_leet": true,
  "leet_intensity": "medium",          // "low" | "medium" | "high"
  "use_doubling": true,
  "use_stretching": false,
  "use_reverse": true,
  "use_palindrome": false,
  "use_number_infix": true,            // "an1der", "and3r"

  "use_numbers": true,
  "number_max_length": 4,              // 1..4
  "use_years": true,
  "use_birth_years": true,             // 1950-2030

  "use_symbols": true,
  "use_double_symbols": true,
  "use_symbol_pairs": true,            // "ander!@", "ander#$"

  "combine_words": true,
  "combine_3_words": false,            // expensive (n*(n-1)*(n-2))
  "use_separators": true,
  "use_reverse_combine": true,

  "add_common_base": true,             // password, admin, wifi, etc
  "add_spanish_base": true,            // 250+ Spanish base words
  "add_spanish_names": true,           // 100 top Spanish first names

  "min_length": 6,
  "max_length": 32,
  "max_total": 10000000
}
```
**Response:**
```json
{
  "success": true,
  "filename": "custom.txt",
  "path": "/data/wordlists/custom.txt",
  "total_passwords": 1543210,
  "file_size_bytes": 18372456,
  "file_size_human": "17.5 MB",
  "elapsed_seconds": 2.47,
  "rate_per_second": 624586,
  "seed_words": ["Ander", "Ibai", "2008"],
  "job_id": "abc12345"
}
```

### `POST /wordlists/estimate`
Predict count + size + time WITHOUT generating. Same body as `/generate`.
**Response:**
```json
{
  "estimated_count": 1543210,
  "estimated_count_human": "1,543,210",
  "estimated_size_bytes": 20061730,
  "estimated_size_human": "19.1 MB",
  "estimated_time_seconds": 7
}
```

### `POST /wordlists/preview`
Sample mutations grouped by category for live UI preview. Same body as `/generate`.
**Response:**
```json
{
  "samples": [
    { "category": "case", "value": "ander" },
    { "category": "leet", "value": "4nd3r" }
  ],
  "categories": {
    "case": ["ander", "ANDER", "Ander"],
    "leet": ["4nd3r", "@nd3r", "and3r"],
    "doubling": ["aander", "anderr"],
    "infix": ["an1der", "and3r"],
    "appendage_numbers": ["ander00", "ander01"],
    "appendage_years": ["ander2024"],
    "appendage_symbols": ["ander!", "ander@"],
    "combinations": ["anderibai", "ander_ibai"],
    "spanish": ["casaander", "andercasa"],
    "names": ["mariaander", "anderjuan2024"]
  }
}
```

### `GET /wordlists/{filename}/info`
Detailed info about one wordlist (line count, samples).
**Response:**
```json
{
  "filename": "custom.txt",
  "path": "/data/wordlists/custom.txt",
  "size_bytes": 18372456,
  "modified_at": 1715094543.123,
  "lines": 1543210,
  "sample_first": ["pass1", "..."],
  "sample_random": ["...", "..."]
}
```
**Returns 404** if not found.

### `GET /wordlists/{filename}/download`
Download the wordlist file. Returns `text/plain` body.

### `DELETE /wordlists/{filename}`
**Response:** `{ "success": bool, "filename": str, "error": str? }`

### `GET /wordlists/presets/info`
Pre-configured generation profiles for the UI.
**Response:**
```json
{
  "presets": [
    {
      "id": "fast", "label": "Fast (~50K)",
      "description": "...", "estimated_count": 50000,
      "config": { /* all WordlistGenerateRequest toggles */ }
    },
    { "id": "balanced", "...": "..." },
    { "id": "exhaustive", "...": "..." },
    { "id": "spanish", "...": "..." }
  ]
}
```

---

## Quick patterns for the frontend

### Long-running operation pattern

Many endpoints (scan, capture, crack, attack start) are async. They return immediately with a status; you poll for completion.

```js
// Start
const res = await fetch("/wifi/handshake", { method: "POST", body: JSON.stringify(req) });
const { capture_file, handshake_captured } = await res.json();

// Or — for ops that return a process id, poll:
const polling = setInterval(async () => {
  const ps = await (await fetch("/system/processes")).json();
  const p = ps.find(x => x.id === procId);
  if (p?.status !== "running") clearInterval(polling);
}, 2000);
```

### Active-session pattern

The frontend tracks the active session in a context. Capture-creating endpoints accept an optional `session_id` to tag files per session:

```js
fetch("/wifi/handshake", {
  method: "POST",
  body: JSON.stringify({ ...payload, session_id: activeSession.id })
});
```

Then `GET /captures/?session_id=<id>` returns only that session's files.

### Persisting UI state across panel switches

Long-running ops (crack, capture, attack) survive PC reboots on the backend (`session_*.json` and `os.walk(captures/)`) — but **frontend** loading state is local. Use the `usePersistentOp` hook in App.jsx to keep spinners/results across navigation.

### Network status before multi-adapter ops

Always call `GET /interfaces/network-status` before launching Evil Twin / AP-Less / Enterprise (which need ≥2 WiFi adapters + internet on a separate iface). The `suggestions` array tells the user what's missing.

---

## Endpoint count summary

| Router       | Endpoints |
|--------------|-----------|
| /system      | 9         |
| /interfaces  | 8         |
| /wifi        | 9         |
| /recon       | 7         |
| /advanced    | 11        |
| /attacks     | 11        |
| /captures    | 3         |
| /sessions    | 9         |
| /wordlists   | 8         |
| **Total**    | **75**    |

For live, interactive testing of every endpoint, run the backend and open `/docs` (Swagger UI).
