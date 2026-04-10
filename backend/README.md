# WiFi Audit Backend

Backend API para auditorías WiFi profesionales. Construido con **FastAPI** y diseñado para ser consumido por un frontend futuro.

> ⚠️ **AVISO LEGAL**: Esta herramienta está diseñada exclusivamente para auditorías de seguridad bajo contrato legal. El uso no autorizado contra redes ajenas es ilegal.

---

## Requisitos del sistema

| Requisito | Detalle |
|---|---|
| **OS** | Linux (Kali Linux recomendado, Ubuntu/Debian compatible) |
| **Python** | 3.11+ |
| **Permisos** | Root (sudo) — obligatorio para aircrack-ng, nmap OS detection, iptables |
| **Tarjeta WiFi** | Con soporte para modo monitor (chipsets Atheros, Ralink, Realtek RTL88xx) |

### Herramientas del sistema necesarias

```bash
# En Kali Linux ya vienen preinstaladas. En Ubuntu/Debian:
sudo apt update
sudo apt install -y aircrack-ng nmap wireless-tools iw \
    hostapd dnsmasq macchanger iptables dsniff

# mitmproxy (vía pip)
pip install mitmproxy
```

---

## Instalación

```bash
git clone <repo-url> && cd wifi-audit-backend
cp .env.example .env          # Editar si se necesita
pip install -r requirements.txt
```

## Ejecución

```bash
# IMPORTANTE: ejecutar como root
sudo python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# O directamente:
sudo python -m app.main
```

Documentación interactiva (Swagger): **http://localhost:8000/docs**

---

## Arquitectura

```
wifi-audit-backend/
├── app/
│   ├── main.py                 # Entry point FastAPI
│   ├── config.py               # Settings (env vars, paths, defaults)
│   ├── models/
│   │   └── schemas.py          # Pydantic models (request/response)
│   ├── routers/                # Endpoints agrupados por dominio
│   │   ├── system.py           # Health, preflight, procesos
│   │   ├── interfaces.py       # Gestión de tarjetas de red
│   │   ├── wifi.py             # Escaneo WiFi, handshake, cracking
│   │   ├── recon.py            # Nmap, descubrimiento de red
│   │   ├── attacks.py          # Evil Twin, MITM
│   │   └── sessions.py        # Sesiones de auditoría y hallazgos
│   ├── services/               # Lógica de negocio
│   │   ├── interface_service.py
│   │   ├── aircrack_service.py
│   │   ├── nmap_service.py
│   │   ├── evil_twin_service.py
│   │   ├── mitm_service.py
│   │   └── session_service.py
│   └── utils/
│       ├── process_manager.py  # Gestión async de subprocesos
│       ├── tool_checker.py     # Verificación de herramientas
│       └── parsers.py          # Parsers de CSV (airodump) y XML (nmap)
├── data/                       # Auto-creado al ejecutar
│   ├── captures/
│   ├── handshakes/
│   ├── reports/
│   ├── wordlists/
│   └── logs/
├── requirements.txt
└── .env.example
```

---

## Endpoints API

### 🔧 Sistema — `/system`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/system/health` | Health check |
| `GET` | `/system/info` | Info del sistema (OS, root, Python) |
| `GET` | `/system/tools` | Verifica qué herramientas están instaladas |
| `GET` | `/system/preflight` | **Ejecutar primero** — comprueba todo: root, tools, sistema |
| `GET` | `/system/processes` | Lista subprocesos gestionados (airodump, nmap, etc.) |
| `POST` | `/system/processes/{id}/cancel` | Cancela un subproceso |

### 📡 Interfaces — `/interfaces`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/interfaces/` | Lista todas las interfaces WiFi (nombre, MAC, driver, chipset, modo) |
| `GET` | `/interfaces/{name}` | Detalle de una interfaz |
| `POST` | `/interfaces/{name}/monitor` | Activa modo monitor (airmon-ng start) |
| `POST` | `/interfaces/{name}/managed` | Restaura modo managed |
| `POST` | `/interfaces/{name}/mac` | Cambia MAC (aleatorio o específico) |

### 📶 WiFi Audit — `/wifi`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/wifi/scan` | Escanea redes WiFi (airodump-ng). Devuelve APs con ESSID, BSSID, canal, seguridad, clientes |
| `POST` | `/wifi/scan/targeted` | Escaneo focalizado en un AP concreto |
| `GET` | `/wifi/scans` | Lista todos los escaneos realizados |
| `GET` | `/wifi/scans/{id}` | Resultado de un escaneo específico |
| `POST` | `/wifi/scans/{id}/stop` | Detiene un escaneo en curso |
| `POST` | `/wifi/handshake` | Captura handshake WPA/WPA2 (con deauth opcional) |
| `POST` | `/wifi/crack` | Crackea handshake capturado con wordlist |
| `POST` | `/wifi/deauth` | Envía paquetes deauth a un AP/cliente |

**Ejemplo — Escaneo WiFi:**
```json
POST /wifi/scan
{
    "interface": "wlan0mon",
    "duration": 30,
    "channel": null
}
```

**Ejemplo — Captura de handshake:**
```json
POST /wifi/handshake
{
    "interface": "wlan0mon",
    "target_bssid": "AA:BB:CC:DD:EE:FF",
    "channel": 6,
    "timeout": 120,
    "deauth_first": true,
    "deauth_packets": 10
}
```

### 🔍 Reconocimiento — `/recon`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/recon/scan` | Escaneo nmap configurable (quick, full, vuln, stealth, udp, custom) |
| `POST` | `/recon/discover` | Ping sweep — descubre hosts vivos en la subred |
| `POST` | `/recon/deep/{ip}` | Escaneo profundo: todos los puertos + servicios + OS |
| `POST` | `/recon/vuln/{ip}` | Scripts de vulnerabilidades nmap |
| `POST` | `/recon/router` | **CTF** — Sondea el router (puertos web, SSH, telnet, modelo, firmware) |
| `GET` | `/recon/scans` | Lista escaneos nmap |
| `GET` | `/recon/scans/{id}` | Resultado de un escaneo nmap |

**Ejemplo — Descubrimiento de red:**
```json
POST /recon/discover?cidr=192.168.0.0/24
```

**Ejemplo — Sondeo de router (CTF):**
```json
POST /recon/router
{
    "target_ip": "192.168.0.1",
    "check_default_creds": true,
    "check_known_vulns": true
}
```

### ⚔️ Vectores de ataque — `/attacks`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/attacks/evil-twin/start` | Lanza Evil Twin (AP falso con mismo ESSID) |
| `POST` | `/attacks/evil-twin/stop` | Detiene Evil Twin y limpia iptables |
| `GET` | `/attacks/evil-twin/status` | Estado del Evil Twin activo |
| `POST` | `/attacks/mitm/start` | Inicia MITM (ARP spoof + mitmproxy) |
| `POST` | `/attacks/mitm/stop` | Detiene MITM y limpia |
| `GET` | `/attacks/mitm/status` | Estado del MITM activo |

**Ejemplo — Evil Twin:**
```json
POST /attacks/evil-twin/start
{
    "interface": "wlan1",
    "target_essid": "Empresa_WiFi",
    "channel": 6,
    "internet_interface": "eth0",
    "captive_portal": false
}
```

**Ejemplo — MITM:**
```json
POST /attacks/mitm/start
{
    "interface": "wlan0",
    "target_ips": ["192.168.0.50", "192.168.0.51"],
    "gateway": "192.168.0.1",
    "proxy_port": 8080,
    "filter_hosts": ["example.com"]
}
```

### 📋 Sesiones — `/sessions`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/sessions/` | Crea sesión de auditoría (nombre, empresa, auditor) |
| `GET` | `/sessions/` | Lista todas las sesiones |
| `GET` | `/sessions/{id}` | Detalle de sesión |
| `POST` | `/sessions/{id}/findings` | Añade hallazgo (categoría, severidad, evidencia, recomendación) |
| `POST` | `/sessions/{id}/close` | Cierra sesión |
| `GET` | `/sessions/{id}/report` | Exporta informe estructurado con hallazgos por severidad |

---

## Flujo de trabajo recomendado para la auditoría

```
1. GET  /system/preflight          → Verificar que todo está listo
2. POST /sessions/                  → Crear sesión de auditoría
3. GET  /interfaces/                → Ver tarjetas WiFi disponibles
4. POST /interfaces/wlan0/monitor   → Activar modo monitor
5. POST /wifi/scan                  → Escanear redes (descubrir APs)
6. POST /wifi/handshake             → Capturar handshake WPA2 del target
7. POST /wifi/crack                 → Intentar crackear con wordlist
   └─ Si no funciona:
      POST /attacks/evil-twin/start → Alternativa: Evil Twin
8. POST /recon/discover             → Mapear la red interna
9. POST /recon/deep/{ip}            → Escaneo profundo por host
10. POST /recon/router              → CTF: intentar acceder al router
11. POST /attacks/mitm/start        → (Opcional) MITM si hay tiempo
12. POST /sessions/{id}/findings    → Documentar cada hallazgo
13. GET  /sessions/{id}/report      → Exportar informe final
14. POST /interfaces/wlan0mon/managed → Restaurar interfaz
```

---

## Configuración (.env)

| Variable | Default | Descripción |
|---|---|---|
| `DEBUG` | `true` | Modo debug (auto-reload, logs verbosos) |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8000` | Puerto del servidor |
| `REQUIRE_AUTH` | `false` | Activar autenticación por API key |
| `API_KEY` | `change-me-in-production` | API key (header `X-API-Key`) |

---

## Notas para tu primera auditoría WiFi

1. **Necesitas dos tarjetas WiFi** si quieres hacer Evil Twin: una en modo monitor para escanear/atacar y otra para el AP falso.

2. **El modo monitor desconecta tu WiFi**. Si estás conectado por WiFi al portátil, perderás conexión. Usa cable Ethernet o una segunda tarjeta.

3. **rockyou.txt** es el wordlist estándar para cracking. En Kali está en `/usr/share/wordlists/rockyou.txt.gz` (descomprimir con `gunzip`). Para entornos empresariales suele ser insuficiente; considera generar wordlists personalizados con `crunch` o `cewl`.

4. **El handshake no siempre se captura a la primera**. Necesitas que un cliente se re-autentique (por eso el deauth). Si no hay clientes conectados, no habrá handshake.

5. **WPA3 no se puede crackear** con aircrack-ng. Si el target usa WPA3, documéntalo como hallazgo positivo (buena seguridad).

6. **Documenta TODO** en las sesiones. Cada red descubierta, cada puerto abierto, cada credencial por defecto = un hallazgo con su recomendación.
