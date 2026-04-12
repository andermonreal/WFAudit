# WFAudit Backend v2.0 — Documentación Completa

**Plataforma profesional de auditoría de seguridad WiFi**

Backend API construido con FastAPI (Python 3.11+) que orquesta herramientas estándar de la industria de ciberseguridad para realizar auditorías WiFi completas. Cubre desde el reconocimiento pasivo hasta ataques avanzados contra WPA2-Enterprise y WPA3.

> ⚠️ **AVISO LEGAL**: Esta herramienta está diseñada exclusivamente para auditorías de seguridad realizadas bajo un contrato legal firmado entre el auditor y la organización. El uso no autorizado contra redes ajenas constituye un delito en la mayoría de jurisdicciones (en España, artículos 197 y 264 del Código Penal). Asegúrate siempre de tener autorización por escrito antes de ejecutar cualquier operación.

---

## Tabla de Contenidos

1. [¿Qué es WFAudit y qué puede hacer?](#1-qué-es-wfaudit-y-qué-puede-hacer)
2. [Fundamentos de seguridad WiFi](#2-fundamentos-de-seguridad-wifi)
3. [Requisitos del sistema](#3-requisitos-del-sistema)
4. [Instalación y ejecución](#4-instalación-y-ejecución)
5. [Arquitectura del proyecto](#5-arquitectura-del-proyecto)
6. [Módulo: System — Preparación del entorno](#6-módulo-system--preparación-del-entorno)
7. [Módulo: Interfaces — Gestión de tarjetas WiFi](#7-módulo-interfaces--gestión-de-tarjetas-wifi)
8. [Módulo: WiFi Scan — Descubrimiento de redes](#8-módulo-wifi-scan--descubrimiento-de-redes)
9. [Módulo: Handshake & Crack — Auditoría WPA/WPA2](#9-módulo-handshake--crack--auditoría-wpawpa2)
10. [Módulo: PMKID — Ataque sin clientes](#10-módulo-pmkid--ataque-sin-clientes)
11. [Módulo: AP-Less — Honeypot sin AP legítimo](#11-módulo-ap-less--honeypot-sin-ap-legítimo)
12. [Módulo: Evil Twin — Punto de acceso falso](#12-módulo-evil-twin--punto-de-acceso-falso)
13. [Módulo: Enterprise — Ataque a WPA2-Enterprise](#13-módulo-enterprise--ataque-a-wpa2-enterprise)
14. [Módulo: WPA3 — Ataques al estándar más reciente](#14-módulo-wpa3--ataques-al-estándar-más-reciente)
15. [Módulo: Recon — Reconocimiento de red con Nmap](#15-módulo-recon--reconocimiento-de-red-con-nmap)
16. [Módulo: MITM — Man-in-the-Middle](#16-módulo-mitm--man-in-the-middle)
17. [Módulo: Captures — Gestión de archivos de captura](#17-módulo-captures--gestión-de-archivos-de-captura)
18. [Módulo: Sessions — Documentación de la auditoría](#18-módulo-sessions--documentación-de-la-auditoría)
19. [Flujo de trabajo completo paso a paso](#19-flujo-de-trabajo-completo-paso-a-paso)
20. [Referencia rápida de todos los endpoints](#20-referencia-rápida-de-todos-los-endpoints)
21. [Configuración avanzada](#21-configuración-avanzada)
22. [Guía de troubleshooting](#22-guía-de-troubleshooting)
23. [Glosario técnico](#23-glosario-técnico)

---

## 1. ¿Qué es WFAudit y qué puede hacer?

WFAudit es un backend API REST que actúa como **capa de orquestación** sobre las herramientas de seguridad WiFi más utilizadas en la industria. En lugar de ejecutar comandos manualmente en la terminal, WFAudit expone cada operación como un endpoint HTTP que puede ser consumido por un frontend web, una app móvil o cualquier cliente HTTP.

### Capacidades completas

El backend tiene **8 routers** (grupos de endpoints), **11 servicios** (lógica de negocio), **4 utilidades** compartidas y **50+ modelos Pydantic** que definen las estructuras de datos. En total son **2.742 líneas de código Python** distribuidas en **34 archivos**.

**Reconocimiento pasivo:**
- Escaneo de redes WiFi en bandas 2.4 GHz, 5 GHz o ambas simultáneamente
- Identificación de puntos de acceso (APs) con ESSID, BSSID, canal, potencia de señal, tipo de seguridad, cifrado, autenticación, WPS, y fabricante
- Detección de clientes wireless asociados y no asociados
- Análisis de Preferred Network Lists (PNL) — las redes que los dispositivos buscan automáticamente
- Identificación de fabricantes de dispositivos vía OUI (Organizationally Unique Identifier)
- Detección de MACs randomizadas (privacidad de dispositivos modernos)

**Ataques a WPA/WPA2-Personal:**
- Captura de handshake WPA/WPA2 de 4 vías con deauth opcional
- Cracking offline del handshake con diccionario (aircrack-ng)
- Ataque PMKID sin necesidad de clientes conectados (hcxdumptool + hashcat)
- Ataque AP-less con honeypot para capturar handshakes de clientes que hacen probing

**Ataques a WPA2-Enterprise:**
- Rogue RADIUS server con Evil Twin para capturar credenciales EAP
- Generación automática de certificados SSL falsos
- Soporte para PEAP, EAP-TTLS

**Ataques a WPA3:**
- Detección de WPA3 Transition Mode (WPA2+WPA3)
- Explotación de downgrade de WPA3 a WPA2
- DoS contra SAE (Dragonfly handshake)

**Ataques de red:**
- Evil Twin AP con portal cautivo y forwarding de internet
- Man-in-the-Middle con ARP spoofing + mitmproxy
- Deauth dirigido o broadcast

**Reconocimiento interno (post-acceso):**
- Descubrimiento de hosts con nmap (8 perfiles de escaneo)
- Detección de OS, servicios, versiones y vulnerabilidades
- Sondeo específico de routers (CTF — Capture The Flag)

**Gestión y reporting:**
- Sesiones de auditoría con hallazgos por severidad
- Gestión de archivos de captura (.cap, .pcapng, .csv, .22000)
- Exportación de informes estructurados
- Gestión de subprocesos (ver, matar, monitorizar)

---

## 2. Fundamentos de seguridad WiFi

Para entender qué hace cada módulo del backend, es necesario comprender cómo funciona la seguridad WiFi. Esta sección explica los conceptos que el backend explota.

### 2.1. Estándares IEEE 802.11

Las redes WiFi se basan en la familia de estándares IEEE 802.11. El backend trabaja con todos ellos:

| Estándar | Frecuencia | Velocidad máx. | Año | Notas |
|---|---|---|---|---|
| 802.11b | 2.4 GHz | 11 Mbps | 1999 | Legacy, casi extinto |
| 802.11g | 2.4 GHz | 54 Mbps | 2003 | Común en dispositivos antiguos |
| 802.11n | 2.4 + 5 GHz | 300 Mbps | 2009 | WiFi 4, MIMO |
| 802.11ac | 5 GHz | 1 Gbps | 2013 | WiFi 5, beamforming, MU-MIMO |
| 802.11ax | 2.4 + 5 GHz | 9.6 Gbps | 2019 | WiFi 6/6E, OFDMA |

Cuando el backend escanea con `band: "bg"` captura redes en 2.4 GHz (canales 1-14). Con `band: "a"` captura 5 GHz (canales 36+). Con `band: "abg"` captura ambas bandas simultáneamente. Es importante escanear ambas bandas porque muchas organizaciones tienen redes en 5 GHz que no se ven con un escaneo por defecto.

### 2.2. Canales y frecuencias

La banda de 2.4 GHz tiene 14 canales, pero solo 3 no se solapan entre sí: **1, 6 y 11**. La mayoría de redes empresariales usan estos tres canales. La banda de 5 GHz tiene muchos más canales disponibles y menos interferencia, pero menor alcance.

El backend detecta automáticamente en qué banda y canal opera cada AP y puede listar los canales que soporta cada adaptador WiFi (`GET /interfaces/{name}/channels`).

### 2.3. Tipos de seguridad WiFi

**OPEN (sin seguridad):** No hay cifrado ni autenticación. Cualquier dispositivo puede conectarse. El backend lo identifica como `security: "open"`. Es un hallazgo crítico en una auditoría: todo el tráfico se transmite en texto plano.

**WEP (Wired Equivalent Privacy):** Primer estándar de seguridad WiFi, completamente roto. Usa RC4 con un IV (Initialization Vector) de solo 24 bits que se repite rápidamente. Se puede crackear en minutos capturando suficientes IVs. Ya casi no se encuentra en producción, pero el backend lo detecta y lo marca como `security: "wep"`.

**WPA (Wi-Fi Protected Access):** Sucesor de WEP. Usa TKIP (Temporal Key Integrity Protocol) que mejora la aleatorización de claves, pero sigue usando RC4 por debajo. Vulnerable a ataques de diccionario tras capturar el handshake. El backend lo identifica como `security: "wpa"`.

**WPA2-Personal (PSK):** El estándar más usado actualmente. Usa **AES-CCMP** para cifrado, que es seguro. El problema no está en el cifrado sino en la **autenticación**: el handshake de 4 vías se puede capturar y crackear offline si la contraseña es débil. El backend tiene múltiples formas de atacarlo:
- Captura de handshake tradicional (deauth + captura)
- Ataque PMKID (sin clientes)
- Ataque AP-less (honeypot)

**WPA2-Enterprise (802.1X/EAP):** En lugar de una contraseña compartida, cada usuario tiene credenciales individuales gestionadas por un servidor RADIUS. Usa protocolos EAP (PEAP, EAP-TTLS, EAP-TLS) para la autenticación. El backend puede atacarlo con un Rogue RADIUS + Evil Twin.

**WPA3-Personal (SAE):** El estándar más reciente. Reemplaza el handshake de 4 vías por SAE (Simultaneous Authentication of Equals), también llamado "Dragonfly handshake". SAE es resistente a ataques de diccionario offline porque cada intento de autenticación requiere interacción con el AP. Sin embargo, el backend puede explotar el **Transition Mode** (cuando un AP soporta WPA2+WPA3 simultáneamente), forzando un downgrade a WPA2.

### 2.4. El handshake de 4 vías (WPA/WPA2)

Este es el proceso central que el backend explota en los módulos de Handshake y PMKID. Cuando un cliente se conecta a un AP con WPA2-PSK, ocurren 4 mensajes:

1. **AP → Cliente**: El AP envía un nonce aleatorio (ANonce). En este primer mensaje, algunos APs incluyen el **PMKID** — esto es lo que explota el ataque PMKID.
2. **Cliente → AP**: El cliente genera su propio nonce (SNonce), calcula la PTK (Pairwise Transient Key) usando la contraseña + los dos nonces + las MACs, y envía el SNonce + MIC (Message Integrity Code).
3. **AP → Cliente**: El AP verifica el MIC, confirma que el cliente conoce la contraseña, e instala la clave.
4. **Cliente → AP**: El cliente confirma la instalación de la clave.

El **handshake** que captura el backend (mensajes 1-2 o 2-3) contiene suficiente información para verificar contraseñas offline: si alimentas aircrack-ng con una contraseña candidata, este puede recalcular la PTK y verificar si el MIC coincide. Si coincide, la contraseña es correcta.

### 2.5. PMKID — La alternativa sin clientes

El PMKID es un hash que el AP incluye en el **primer mensaje** del handshake. Se calcula como:

```
PMKID = HMAC-SHA1-128(PMK, "PMK Name" || MAC_AP || MAC_STA)
```

Donde PMK = PBKDF2(contraseña, SSID, 4096 iteraciones). No todos los APs envían el PMKID, pero muchos sí. La ventaja del ataque PMKID es que **no necesitas que haya clientes conectados**: simplemente envías un request de asociación al AP y este te responde con el PMKID en el primer EAPOL.

El backend implementa dos estrategias:
- **hcxdumptool** (preferida): Herramienta diseñada específicamente para captura de PMKID. Genera un archivo `.pcapng` que se convierte a formato hashcat `.22000` con `hcxpcapngtool`.
- **airodump-ng** (fallback): También puede capturar PMKIDs. Cuando lo hace, muestra "PMKID" en la columna Notes.

### 2.6. Preferred Network List (PNL)

Cada dispositivo WiFi almacena una lista de redes a las que se ha conectado anteriormente. Cuando el dispositivo no está conectado a ninguna red, envía **probe requests** (solicitudes de sondeo) buscando esas redes guardadas. Estos probes son visibles para cualquier adaptador en modo monitor.

El backend analiza estos probes para:
- Identificar qué redes buscan los dispositivos de los empleados
- Detectar redes que ya no existen pero que los dispositivos siguen buscando — estos son **candidatos perfectos para Evil Twin**
- Identificar dispositivos con MACs randomizadas (iOS, Android moderno)

La función `analyze_pnl()` en `parsers.py` procesa todos los clientes capturados en un escaneo, extrae sus probes, cruza los datos con los APs detectados, y genera un informe con candidatos Evil Twin y notas de vulnerabilidad por cliente.

---

## 3. Requisitos del sistema

### 3.1. Hardware obligatorio

**Tarjeta WiFi con soporte para modo monitor y packet injection.** Las tarjetas WiFi integradas de los portátiles generalmente NO soportan modo monitor. Necesitas un adaptador USB externo con un chipset compatible.

| Adaptador | Chipset | Bandas | Precio aprox. | Notas |
|---|---|---|---|---|
| **Alfa AWUS036NHA** | Atheros AR9271 | 2.4 GHz | ~25€ | El más recomendado para empezar. Compatible con todo. |
| **Alfa AWUS036ACH** | Realtek RTL8812AU | 2.4 + 5 GHz | ~60€ | Necesario si quieres auditar redes 5 GHz. Requiere drivers. |
| **TP-Link TL-WN722N v1** | Atheros AR9271 | 2.4 GHz | ~15€ | Solo la versión 1. Las v2/v3 usan chipsets diferentes. |
| **Alfa AWUS036ACM** | MediaTek MT7612U | 2.4 + 5 GHz | ~45€ | Buena alternativa dual-band. |

**Para ataques que requieren 2 adaptadores** (AP-less, Evil Twin, Enterprise): necesitas dos adaptadores WiFi USB. Uno funcionará en modo monitor (captura) y otro en modo managed (hostapd para el AP falso).

### 3.2. Software

| Requisito | Detalle |
|---|---|
| **OS** | Linux obligatorio. Kali Linux recomendado (todo preinstalado). Ubuntu/Debian compatible. |
| **Python** | 3.11 o superior |
| **Permisos** | Root (sudo). Sin root, el 90% de las operaciones fallarán. |

### 3.3. Herramientas del sistema (30+ verificadas)

El endpoint `GET /system/tools` verifica todas las herramientas y reporta cuáles están instaladas. Se organizan por categoría:

**Categoría: wifi (críticas)**
- `airmon-ng` — Activa/desactiva modo monitor en adaptadores WiFi
- `airodump-ng` — Escanea y captura tráfico WiFi
- `aireplay-ng` — Inyecta paquetes (deauth, fake auth, etc.)
- `aircrack-ng` — Crackea handshakes WPA/WPA2 con diccionario
- `iwconfig` — Configura interfaces wireless (legacy pero necesario)
- `iw` — Herramienta moderna de configuración wireless

**Categoría: pmkid**
- `hcxdumptool` — Captura PMKID del AP sin clientes
- `hcxpcapngtool` — Convierte pcapng a formato hashcat (.22000)

**Categoría: crack**
- `hashcat` — GPU-accelerated password cracker (PMKID, WPA)

**Categoría: attack**
- `hostapd` — Crea puntos de acceso WiFi (Evil Twin, AP-less, Enterprise)
- `dnsmasq` — Servidor DHCP/DNS para Evil Twin
- `arpspoof` — ARP spoofing para MITM
- `mitmproxy/mitmdump` — Proxy de interceptación HTTP(S)
- `ettercap` — Suite de MITM alternativa

**Categoría: enterprise**
- `freeradius` — Servidor RADIUS para ataques Enterprise

**Categoría: recon**
- `nmap` — Escáner de red y puertos

**Categoría: wps**
- `reaver` — Ataque a WPS por fuerza bruta
- `bully` — Alternativa a reaver para WPS

**Categoría: wordlist**
- `crunch` — Generador de wordlists por patrón
- `cewl` — Generador de wordlists por scraping web

**Categoría: capture**
- `tcpdump` — Captura de paquetes de red
- `tshark` — Versión CLI de Wireshark

**Categoría: system**
- `ip` — Configuración de interfaces de red
- `iptables` — Firewall y NAT (necesario para Evil Twin con internet)
- `macchanger` — Cambio de dirección MAC

### 3.4. Instalación completa en Kali Linux

```bash
# En Kali Linux la mayoría ya viene instalado. Solo añadir:
sudo apt update
sudo apt install -y hcxdumptool hcxtools hashcat freeradius reaver bully crunch cewl ettercap-text-only tshark
pip install mitmproxy

# Airgeddon (opcional — suite todo-en-uno)
git clone https://github.com/v1s1t0r1sh3r3/airgeddon.git /opt/airgeddon
```

### 3.5. Instalación en Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y aircrack-ng nmap wireless-tools iw \
    hostapd dnsmasq macchanger iptables dsniff \
    hcxdumptool hcxtools hashcat \
    freeradius reaver bully \
    crunch cewl tcpdump tshark ettercap-text-only

pip install mitmproxy
```

---

## 4. Instalación y ejecución

```bash
# Clonar el proyecto
git clone <repo-url>
cd wifi-audit-backend

# Configurar entorno
cp .env.example .env
# Editar .env si necesitas cambiar puerto, auth, etc.

# Instalar dependencias Python
pip install -r requirements.txt

# Ejecutar (SIEMPRE como root)
sudo python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

La documentación interactiva de Swagger estará disponible en: **http://localhost:8000/docs**

También hay documentación alternativa en formato ReDoc: **http://localhost:8000/redoc**

---

## 5. Arquitectura del proyecto

```
wifi-audit-backend/                     # Raíz del proyecto
├── app/                                # Código fuente principal
│   ├── main.py                         # Entry point de FastAPI — registra routers, CORS, auth
│   ├── config.py                       # Configuración centralizada (Settings + paths + defaults)
│   │
│   ├── models/                         # Modelos de datos (Pydantic)
│   │   └── schemas.py                  # 50+ schemas: enums, requests, responses
│   │
│   ├── routers/                        # Capa HTTP — define endpoints y validación
│   │   ├── system.py                   # /system/* — health, preflight, tools, OUI, procesos
│   │   ├── interfaces.py              # /interfaces/* — tarjetas WiFi, monitor, MAC, channels
│   │   ├── wifi.py                     # /wifi/* — escaneo, handshake, crack, deauth, PNL
│   │   ├── recon.py                    # /recon/* — nmap, discover, vuln, router probe
│   │   ├── attacks.py                  # /attacks/* — evil twin, MITM
│   │   ├── advanced.py                 # /advanced/* — PMKID, AP-less, enterprise, WPA3
│   │   ├── captures.py                 # /captures/* — gestión de archivos
│   │   └── sessions.py                # /sessions/* — auditoría y hallazgos
│   │
│   ├── services/                       # Capa de negocio — lógica real de cada operación
│   │   ├── aircrack_service.py         # Wraps aircrack-ng suite (scan, handshake, crack, deauth)
│   │   ├── pmkid_service.py            # PMKID capture (hcxdumptool) + crack (hashcat)
│   │   ├── apless_service.py           # AP-less honeypot (hostapd + airodump)
│   │   ├── enterprise_service.py       # Rogue RADIUS + enterprise evil twin
│   │   ├── wpa3_service.py             # WPA3 transition detection, downgrade, DoS
│   │   ├── nmap_service.py             # Nmap reconnaissance (8 profiles)
│   │   ├── interface_service.py        # Interface management (monitor, MAC, channels, TX power)
│   │   ├── evil_twin_service.py        # Evil Twin AP (hostapd + dnsmasq + iptables)
│   │   ├── mitm_service.py             # MITM (arpspoof + mitmproxy)
│   │   ├── capture_service.py          # Capture file management
│   │   └── session_service.py          # Audit session + findings + reports
│   │
│   └── utils/                          # Utilidades compartidas
│       ├── process_manager.py          # Gestión async de subprocesos con timeout y cancellation
│       ├── parsers.py                  # Parsers de airodump CSV + nmap XML + análisis PNL
│       ├── tool_checker.py             # Verificación de 30+ herramientas por categoría
│       └── oui_lookup.py               # Manufacturer lookup (200+ OUI built-in + IEEE DB)
│
├── data/                               # Directorio de datos (auto-creado)
│   ├── captures/                       # Archivos de escaneo (.cap, .csv)
│   ├── handshakes/                     # Handshakes WPA capturados
│   ├── pmkid/                          # Capturas PMKID (.pcapng, .22000)
│   ├── reports/                        # Informes de sesión (JSON)
│   ├── wordlists/                      # Diccionarios personalizados
│   ├── logs/                           # Logs de ataques
│   ├── hostapd/                        # Configuraciones hostapd generadas
│   └── enterprise/                     # Certificados y configs para 802.1X
│
├── requirements.txt
└── .env.example
```

### 5.1. Patrón de diseño: Router → Service → Process Manager

Cada operación sigue un flujo consistente:

1. **Router** (capa HTTP): Recibe la petición, valida los datos con Pydantic, llama al servicio correspondiente, y devuelve la respuesta JSON.

2. **Service** (capa de negocio): Contiene la lógica real. Construye los comandos de las herramientas del sistema, los ejecuta a través del Process Manager, parsea los resultados, y devuelve datos estructurados.

3. **Process Manager** (`utils/process_manager.py`): Ejecuta subprocesos de forma asíncrona con `asyncio.create_subprocess_exec`. Gestiona timeouts, cancellation, captura de stdout/stderr, y mantiene un registro de todos los procesos ejecutados. Cada proceso recibe un ID único para poder monitorizarlo y cancelarlo desde la API.

### 5.2. ¿Por qué FastAPI?

- **Async nativo**: Las operaciones WiFi (escaneos, capturas) son lentas (30s-5min). FastAPI con asyncio permite ejecutar múltiples operaciones simultáneas sin bloquear el servidor.
- **Pydantic validation**: Cada request y response tiene un schema estricto. Si envías un BSSID con formato incorrecto, Pydantic lo rechaza antes de que llegue al servicio.
- **Swagger auto-generado**: Cada endpoint se documenta automáticamente en `/docs` con ejemplos interactivos.
- **CORS configurado**: Permite que cualquier frontend (local o remoto) consuma la API.

---

## 6. Módulo: System — Preparación del entorno

**Router:** `app/routers/system.py`
**Utilidades:** `app/utils/tool_checker.py`, `app/utils/oui_lookup.py`

Este módulo es el primero que debes consultar antes de cualquier auditoría. Verifica que el entorno está correctamente configurado.

### Endpoints

**`GET /system/health`**
Simple health check. Devuelve `{"status": "ok"}`. Útil para verificar que el backend está corriendo.

**`GET /system/info`**
Información del sistema: OS, release, arquitectura, versión de Python, distro Linux, y si el proceso corre como root.

**`GET /system/tools`**
Lista las 30+ herramientas con su estado de instalación. Para cada herramienta devuelve:
- `installed`: boolean
- `path`: ruta del ejecutable (si instalado)
- `package`: nombre del paquete para instalarlo
- `critical`: si es crítica para el funcionamiento básico
- `category`: categoría (wifi, recon, attack, pmkid, etc.)

**`GET /system/tools/categories`**
Lo mismo que `/tools` pero agrupado por categoría. Cada categoría indica si todas sus herramientas están instaladas.

**`GET /system/preflight`**
**Ejecutar siempre antes de empezar una auditoría.** Combina info del sistema + estado de herramientas + verificación de root. Devuelve un campo `ready: true/false` que indica si el entorno está preparado. Si `ready: false`, muestra las herramientas críticas que faltan con el comando de instalación.

**`GET /system/processes`**
Lista todos los subprocesos que el backend ha lanzado (airodump, nmap, hostapd, etc.) con su ID, comando, estado (running/completed/failed/cancelled), timestamp de inicio y código de retorno.

**`POST /system/processes/{proc_id}/cancel`**
Mata un subproceso por su ID. Envía SIGTERM y espera 1 segundo; si no termina, envía SIGKILL. Útil cuando un escaneo se cuelga o necesitas liberar el adaptador WiFi.

**`GET /system/oui/{mac}`**
Busca el fabricante de un dispositivo por su dirección MAC. Usa una base de datos interna de 200+ fabricantes comunes (Cisco, Apple, Samsung, TP-Link, Alfa Networks, etc.) y opcionalmente la base de datos completa de IEEE con 30.000+ entradas. También detecta si la MAC es **randomizada** (segundo bit del primer octeto = 1), lo cual indica dispositivos modernos con privacy features activadas.

**`POST /system/oui/download`**
Descarga la base de datos OUI completa de IEEE (http://standards-oui.ieee.org/oui/oui.txt) para lookups más precisos. Solo necesitas ejecutarlo una vez.

---

## 7. Módulo: Interfaces — Gestión de tarjetas WiFi

**Router:** `app/routers/interfaces.py`
**Servicio:** `app/services/interface_service.py`

### ¿Por qué es importante?

Antes de poder escanear o atacar redes WiFi, necesitas poner tu adaptador WiFi en **modo monitor**. En modo normal (managed), la tarjeta solo procesa paquetes destinados a ella. En modo monitor, captura TODOS los paquetes WiFi del aire, sin importar a quién van dirigidos.

### Endpoints

**`GET /interfaces/`**
Lista todas las interfaces wireless detectadas. Para cada una devuelve:
- `name`: Nombre de la interfaz (wlan0, wlan1, wlan0mon)
- `mac`: Dirección MAC actual
- `driver`: Driver del kernel (ath9k_htc, rtl8812au, etc.)
- `chipset`: Chipset del hardware (Atheros AR9271, Realtek RTL8812AU)
- `mode`: managed o monitor
- `is_up`: Si la interfaz está activa
- `supports_monitor`: Si el chipset soporta modo monitor
- `supports_5ghz`: Si puede escanear la banda de 5 GHz
- `tx_power`: Potencia de transmisión actual en dBm

**`POST /interfaces/{name}/monitor`**
Pone la interfaz en modo monitor. Internamente ejecuta:
1. `airmon-ng check kill` — Mata procesos que interfieren (wpa_supplicant, NetworkManager)
2. `airmon-ng start {name}` — Crea la interfaz monitor (normalmente `wlan0mon`)

Devuelve el nombre de la nueva interfaz monitor. **Importante:** Esto desconecta tu WiFi. Si estás conectado por WiFi, perderás la conexión. Usa cable Ethernet.

**`POST /interfaces/{name}/managed`**
Restaura la interfaz a modo managed. Ejecuta `airmon-ng stop {name}` y reinicia NetworkManager.

**`POST /interfaces/{name}/mac`**
Cambia la dirección MAC. Tres modos:
- **Random** (sin parámetros): `macchanger -r` genera una MAC aleatoria
- **Específica** (`new_mac=AA:BB:CC:DD:EE:FF`): Establece una MAC concreta
- **Vendor spoof** (`vendor_prefix=00:1A:2B`): Genera una MAC con el OUI de un fabricante específico + 3 octetos aleatorios. Útil para hacerse pasar por una impresora, un dispositivo IoT, etc. y no levantar sospechas en monitorización de red.

**`POST /interfaces/{name}/txpower`**
Ajusta la potencia de transmisión en dBm. Útil para testing de alcance o para reducir la señal y no ser detectado a distancia.

**`GET /interfaces/{name}/channels`**
Lista todos los canales que soporta la interfaz, separados en 2.4 GHz y 5 GHz. Usa `iw list` internamente.

---

## 8. Módulo: WiFi Scan — Descubrimiento de redes

**Router:** `app/routers/wifi.py`
**Servicio:** `app/services/aircrack_service.py`
**Parser:** `app/utils/parsers.py` → `parse_airodump_csv()`

### ¿Cómo funciona internamente?

El escaneo ejecuta `airodump-ng` con los parámetros configurados. Airodump-ng pone la tarjeta en "channel hopping" (salta entre canales capturando paquetes en cada uno) y escribe los resultados en un archivo CSV. Cuando el timeout expira, el backend parsea el CSV y devuelve los datos estructurados.

### Endpoints

**`POST /wifi/scan`**
Escaneo completo de redes WiFi. Parámetros:
- `interface`: Interfaz en modo monitor (obligatorio)
- `channel`: Canal específico. Si vacío, escanea todos los canales (channel hopping)
- `duration`: Duración en segundos (default: 30). Más tiempo = más redes descubiertas
- `target_bssid`: Filtrar por MAC del AP. Solo muestra ese AP
- `target_essid`: Filtrar por nombre de red. Solo muestra esa red
- `band`: Banda a escanear:
  - `"bg"` — Solo 2.4 GHz (default, canales 1-14)
  - `"a"` — Solo 5 GHz (canales 36+)
  - `"abg"` — Ambas bandas simultáneamente

Devuelve una lista de **Access Points** con toda la información que airodump-ng captura:

| Campo | Descripción | Ejemplo |
|---|---|---|
| `bssid` | MAC del AP | `68:7F:74:01:28:E1` |
| `essid` | Nombre de la red | `Corp_WiFi` |
| `channel` | Canal operativo | `6` |
| `power` | Potencia de señal (dBm). Más cercano a 0 = más fuerte | `-33` |
| `security` | Tipo de seguridad | `wpa2`, `wpa3`, `open`, etc. |
| `cipher` | Cifrado utilizado | `CCMP` (AES), `TKIP` |
| `auth` | Método de autenticación | `PSK`, `EAP` (enterprise), `SAE` |
| `beacons` | Número de beacons capturados | `96` |
| `data_packets` | Paquetes de datos capturados | `134` |
| `max_speed` | Velocidad máx soportada (Mbps) | `130` |
| `clients` | Lista de MACs de clientes conectados | `["8A:65:00:0C:BD:42"]` |
| `wps` | Si tiene WPS activado (vulnerable a reaver) | `true` |
| `pmkid_available` | Si airodump detectó un PMKID disponible | `true` |
| `manufacturer` | Fabricante del AP (lookup OUI) | `Cisco-Linksys` |
| `band` | Banda detectada | `2.4 GHz` o `5 GHz` |
| `is_hidden` | Si el ESSID está oculto | `true` |

También devuelve una lista de **Wireless Clients** (estaciones) con:
- `mac`: MAC del cliente
- `bssid`: AP al que está asociado (null si no está conectado)
- `power`: Señal del cliente
- `probes`: **Lista de redes que el cliente busca (PNL)**
- `manufacturer`: Fabricante del dispositivo

**`GET /wifi/scans/{id}/pnl`**
**Análisis de Preferred Network Lists.** Toma los clientes capturados en un escaneo y genera un informe de inteligencia:

- `total_clients`: Total de dispositivos detectados
- `associated_clients`: Conectados a algún AP
- `unassociated_clients`: No conectados (buscando redes)
- `unique_probed_networks`: Todas las redes que los clientes buscan
- `evil_twin_candidates`: SSIDs buscados por 2+ clientes que NO están presentes como APs — candidatos perfectos para un Evil Twin
- Para cada cliente: MAC, fabricante, lista de probes, notas de vulnerabilidad

---

## 9. Módulo: Handshake & Crack — Auditoría WPA/WPA2

**Servicio:** `app/services/aircrack_service.py`

### ¿Cómo funciona el ataque?

1. **Captura**: Airodump-ng se pone a escuchar en el canal del AP objetivo. Cuando un cliente se (re)conecta al AP, los 4 mensajes del handshake se transmiten por el aire y airodump los captura en un archivo `.cap`.

2. **Deauth** (opcional pero recomendado): Para forzar la reconexión, aireplay-ng envía paquetes de desautenticación al AP o a un cliente específico. Esto simula una desconexión y el cliente se reconecta automáticamente, generando un nuevo handshake.

3. **Crack**: Aircrack-ng toma el archivo `.cap` y un wordlist (diccionario de contraseñas). Para cada palabra del diccionario, calcula la PTK usando esa palabra como contraseña y verifica si el MIC del handshake coincide. Si coincide, la contraseña se ha encontrado.

### Endpoints

**`POST /wifi/handshake`**
```json
{
    "interface": "wlan0mon",
    "target_bssid": "68:7F:74:01:28:E1",
    "target_essid": "Target_Net",
    "channel": 6,
    "timeout": 120,
    "deauth_first": true,
    "deauth_packets": 10,
    "deauth_client": "8A:65:00:0C:BD:42",
    "band": "bg"
}
```

Si `deauth_first` es true, primero inicia la captura con airodump, espera 3 segundos, y luego envía los paquetes deauth. Si `deauth_client` está especificado, el deauth se dirige solo a ese cliente (más sigiloso y efectivo); si está vacío, envía un broadcast deauth que afecta a todos los clientes.

Devuelve si el handshake fue capturado y la ruta del archivo `.cap`.

**`POST /wifi/crack`**
```json
{
    "capture_file": "/path/to/handshake.cap",
    "target_bssid": "68:7F:74:01:28:E1",
    "wordlist": "rockyou.txt"
}
```

El sistema busca el wordlist en varios lugares: primero en `data/wordlists/`, luego en `/usr/share/wordlists/`, y en `/usr/share/seclists/Passwords/`. Devuelve `success: true` + la clave si se encuentra.

**`POST /wifi/deauth`**
Herramienta de deauth independiente. Puede usar `target_bssid` o `use_essid` para apuntar al objetivo.

---

## 10. Módulo: PMKID — Ataque sin clientes

**Router:** `app/routers/advanced.py`
**Servicio:** `app/services/pmkid_service.py`

### ¿Por qué es importante?

El ataque PMKID es **la primera técnica que deberías probar** en cualquier auditoría WPA2-PSK. Ventajas frente al handshake tradicional:

- **No necesitas clientes conectados**: Solo necesitas que el AP esté encendido
- **No necesitas enviar deauth**: Más sigiloso, no desconectas a nadie
- **Más rápido**: Solo necesitas capturar un paquete del AP
- **Funciona con la mayoría de APs modernos**: Aunque no con todos

### Cómo funciona internamente

El servicio implementa dos estrategias con fallback automático:

**Estrategia 1 — hcxdumptool (preferida):**
1. Crea un archivo de filtro con el BSSID del AP objetivo (sin ":")
2. Ejecuta `hcxdumptool -i {iface} -o {output}.pcapng --filterlist_ap {filter} --filtermode 2`
3. Hcxdumptool envía requests de asociación al AP y captura el PMKID del primer EAPOL
4. Convierte el pcapng a formato hashcat: `hcxpcapngtool -o {output}.22000 {input}.pcapng`
5. Si el archivo .22000 tiene contenido, el PMKID fue capturado

**Estrategia 2 — airodump-ng (fallback):**
1. Ejecuta `airodump-ng --bssid {bssid} --channel {ch} --write {output} {iface}`
2. Verifica con `aircrack-ng {output}.cap` si hay PMKID

### Cracking del PMKID

**`POST /advanced/pmkid/crack`**

Si el archivo es `.22000` (hashcat): `hashcat -m 22000 {hash_file} {wordlist}`
Si es `.cap` (aircrack-ng): `aircrack-ng -b {bssid} -w {wordlist} {cap_file}`

Hashcat es significativamente más rápido que aircrack-ng porque usa la GPU.

---

## 11. Módulo: AP-Less — Honeypot sin AP legítimo

**Servicio:** `app/services/apless_service.py`

### Escenario

Imagina que estás en un aeropuerto y un empleado de la empresa auditada está esperando un vuelo con su portátil. Su portátil tiene la red corporativa `Corp_WiFi` en su PNL y está enviando probe requests buscándola. Tú no tienes acceso al AP legítimo, pero puedes crear un AP falso con el mismo nombre.

### Cómo funciona

1. **Hostapd** crea un AP falso en tu segundo adaptador WiFi con el ESSID `Corp_WiFi`, usando WPA2 con una contraseña falsa cualquiera
2. **Airodump-ng** escucha en tu primer adaptador (en monitor) esperando el handshake
3. El portátil del empleado detecta el `Corp_WiFi` falso y intenta conectarse usando la contraseña real que tiene almacenada
4. Como la contraseña real no coincide con la del AP falso, la conexión falla (hostapd muestra `AP-STA-POSSIBLE-PSK-MISMATCH`)
5. Pero el handshake de 4 vías ya fue capturado por airodump-ng
6. Ahora puedes crackear el handshake offline con aircrack-ng

### Endpoint

**`POST /advanced/apless/start`**
```json
{
    "monitor_interface": "wlan0mon",
    "ap_interface": "wlan1",
    "target_essid": "Corp_WiFi",
    "channel": 6,
    "wpa_version": 2,
    "fake_passphrase": "fakepassword123",
    "capture_timeout": 300
}
```

El backend genera automáticamente la configuración de hostapd, inicia ambos procesos (airodump + hostapd), espera el timeout, y verifica si se capturó el handshake.

---

## 12. Módulo: Evil Twin — Punto de acceso falso

**Servicio:** `app/services/evil_twin_service.py`

### Diferencia con AP-Less

- **AP-less**: El objetivo es capturar el handshake para crackearlo offline. El cliente no llega a conectarse.
- **Evil Twin**: El objetivo es que el cliente SE CONECTE al AP falso y navegue a través de tu máquina. Puedes interceptar tráfico, mostrar un portal cautivo, etc.

### Componentes que se ejecutan

1. **hostapd**: Crea el AP falso (sin seguridad, para que cualquiera se conecte)
2. **dnsmasq**: Asigna IPs por DHCP y resuelve DNS
3. **iptables**: Si `internet_interface` está configurado, hace NAT para dar internet a las víctimas a través de tu máquina
4. **aireplay-ng** (opcional): Si `deauth_legitimate` es true, envía deauth al AP legítimo para forzar a los clientes a reconectarse a tu Evil Twin

### Endpoint mejorado en v2

**`POST /attacks/evil-twin/start`**
```json
{
    "interface": "wlan1",
    "target_essid": "Corp_WiFi",
    "channel": 6,
    "internet_interface": "eth0",
    "captive_portal": true,
    "deauth_legitimate": true,
    "deauth_interface": "wlan0mon",
    "deauth_bssid": "68:7F:74:01:28:E1",
    "deauth_packets": 50
}
```

---

## 13. Módulo: Enterprise — Ataque a WPA2-Enterprise

**Servicio:** `app/services/enterprise_service.py`

### ¿Qué es WPA2-Enterprise?

En redes Enterprise, cada usuario tiene credenciales individuales (usuario/contraseña o certificado) gestionadas por un servidor RADIUS. El flujo de autenticación es:

1. El cliente se conecta al AP
2. El AP reenvía la autenticación al servidor RADIUS
3. Se establece un túnel EAP (PEAP, EAP-TTLS, EAP-TLS)
4. Dentro del túnel, el usuario envía sus credenciales
5. RADIUS verifica y responde al AP

### Cómo lo ataca el backend

1. **Genera certificados SSL falsos** automáticamente con `openssl`
2. **Crea un hostapd configurado en modo 802.1X** con `ieee8021x=1` y `eap_server=1`
3. **El hostapd actúa como servidor EAP** (no necesita FreeRADIUS externo)
4. Cuando el cliente intenta autenticarse, envía sus credenciales EAP al AP falso
5. El backend parsea los logs de hostapd buscando identidades EAP, hashes MSCHAP, contraseñas PAP

---

## 14. Módulo: WPA3 — Ataques al estándar más reciente

**Servicio:** `app/services/wpa3_service.py`

### Tipos de ataque implementados

**`transition_mode`** — Detección de Transition Mode

Muchos APs WPA3 operan en "transition mode" para mantener compatibilidad con dispositivos WPA2. En este modo, el AP acepta TANTO conexiones WPA3 (SAE) como WPA2 (PSK). El backend escanea el AP con airodump-ng y parsea el CSV buscando si aparecen TANTO "WPA2" como "SAE" en la misma línea.

Si se confirma transition mode, el AP es vulnerable a un ataque de downgrade.

**`downgrade`** — Explotación de Transition Mode

Confirma transition mode y proporciona los pasos para explotar: crear un Evil Twin con WPA2-only, enviar deauth al AP legítimo, y capturar el handshake WPA2 del cliente que se reconecta.

**`dos`** — DoS contra SAE

Envía un flood continuo de deauth al AP WPA3. Aunque el handshake SAE es resistente a cracking offline, el AP puede ser vulnerable a denegación de servicio si no implementa anti-clogging tokens correctamente.

---

## 15. Módulo: Recon — Reconocimiento de red con Nmap

**Servicio:** `app/services/nmap_service.py`

### ¿Cuándo se usa?

Después de obtener acceso a la red WiFi (tras crackear la contraseña o conectarte a una red abierta), el siguiente paso es mapear toda la infraestructura interna: qué dispositivos hay, qué puertos tienen abiertos, qué servicios ejecutan, qué sistema operativo usan.

### 8 perfiles de escaneo

| Perfil | Comando nmap | Uso | Velocidad |
|---|---|---|---|
| `quick` | `-sn` | Solo descubre hosts vivos (ping sweep) | Rápido |
| `full` | `-sV -sC -O -p-` | Todos los puertos + servicios + OS | Lento |
| `service` | `-sV -sC` | Detección de versiones de servicios | Medio |
| `os_detect` | `-O -sV` | Fingerprinting de sistema operativo | Medio |
| `vuln` | `--script vuln -sV` | Scripts NSE de vulnerabilidades | Medio-lento |
| `stealth` | `-sS -T2 -f` | SYN scan con fragmentación (sigiloso) | Medio |
| `udp` | `-sU --top-ports 100` | Top 100 puertos UDP | Lento |
| `custom` | (lo que tú indiques) | Argumentos personalizados | Variable |

### CTF — Router Probe

**`POST /recon/router`** escanea específicamente el router/gateway en puertos 22, 23, 53, 80, 443, 8080, 8443. Reporta si HTTP/HTTPS/SSH/Telnet están abiertos. Telnet abierto es un hallazgo crítico (credenciales en texto plano).

---

## 16. Módulo: MITM — Man-in-the-Middle

**Servicio:** `app/services/mitm_service.py`

### Cómo funciona

1. **IP forwarding**: Activa el forwarding del kernel para que los paquetes pasen a través de tu máquina
2. **ARP spoofing**: Envía paquetes ARP falsos que dicen a los targets "la MAC del gateway soy yo" y al gateway "la MAC de los targets soy yo"
3. **iptables PREROUTING**: Redirige el tráfico HTTP (80) y HTTPS (443) a los puertos de mitmproxy
4. **mitmdump**: Captura todo el tráfico HTTP(S) y lo guarda en archivos `.flow`

---

## 17. Módulo: Captures — Gestión de archivos de captura

**Servicio:** `app/services/capture_service.py`

Gestiona todos los archivos generados por las operaciones de captura: `.cap`, `.pcap`, `.pcapng`, `.csv`, `.kismet.csv`, `.kismet.netxml`, `.log.csv`, `.22000`, `.hc22000`.

**`GET /captures/`** — Lista todos los archivos con nombre, ruta, tipo, tamaño, fecha, y ESSID detectado.

**`POST /captures/check-handshake`** — Verifica si un archivo contiene un handshake WPA válido o PMKID ejecutando `aircrack-ng` sobre él.

**`DELETE /captures/`** — Elimina un archivo (solo dentro de los directorios de datos permitidos).

---

## 18. Módulo: Sessions — Documentación de la auditoría

**Servicio:** `app/services/session_service.py`

### Importancia

Todo lo que descubras durante la auditoría debe documentarse. Las sesiones agrupan todos los hallazgos y generan el informe final.

### Hallazgos (Findings)

Cada hallazgo tiene:
- **Categoría**: wifi, network, router, credentials, encryption, access_control, other
- **Severidad**: critical, high, medium, low, info
- **Título**: Breve y descriptivo
- **Descripción**: Detalle técnico
- **Evidencia**: Ruta a archivos de captura, screenshots, logs
- **Recomendación**: Acción correctiva para la organización

**`GET /sessions/{id}/report`** genera un informe JSON con los hallazgos ordenados por severidad y un resumen numérico.

---

## 19. Flujo de trabajo completo paso a paso

```
FASE 1: PREPARACIÓN
├── GET  /system/preflight              → ¿Root? ¿Herramientas? ¿Sistema OK?
├── POST /sessions/                      → Crear sesión: "Auditoría WiFi Acme Corp"
├── GET  /interfaces/                    → ¿Qué adaptadores tengo?
├── GET  /interfaces/wlan0/channels      → ¿Qué canales soporta?
└── POST /interfaces/wlan0/monitor       → Activar modo monitor → wlan0mon

FASE 2: RECONOCIMIENTO
├── POST /wifi/scan (band: "abg")        → Escaneo completo dual-band
├── GET  /wifi/scans/{id}/pnl            → Analizar PNL → candidatos Evil Twin
├── POST /sessions/{id}/findings         → Documentar: redes open, WEP, etc.
│
│   Para cada AP objetivo:
│   ├── ¿Es WPA2-PSK?
│   │   ├── POST /advanced/pmkid/capture     → Intentar PMKID primero (sin clientes)
│   │   │   └── Si capturado → POST /advanced/pmkid/crack
│   │   ├── POST /wifi/handshake             → Si no, capturar handshake con deauth
│   │   │   └── POST /wifi/crack              → Crackear con wordlist
│   │   └── POST /advanced/apless/start      → Si no hay clientes: honeypot AP-less
│   │
│   ├── ¿Es WPA2-Enterprise?
│   │   └── POST /advanced/enterprise/start  → Rogue RADIUS + Evil Twin
│   │
│   ├── ¿Es WPA3?
│   │   ├── POST /advanced/wpa3/attack (transition_mode) → ¿Transition mode?
│   │   ├── Si sí → Evil Twin WPA2-only para downgrade
│   │   └── Si no → Documentar como hallazgo positivo
│   │
│   └── ¿Es OPEN?
│       └── POST /sessions/{id}/findings → Hallazgo CRÍTICO: red sin cifrado

FASE 3: POST-EXPLOTACIÓN (si se obtuvo acceso)
├── POST /recon/discover                 → Mapear red: ¿cuántos hosts?
├── POST /recon/deep/{ip}                → Escaneo profundo por host
├── POST /recon/vuln/{ip}                → Scripts de vulnerabilidades
├── POST /recon/router                   → CTF: ¿acceso al panel del router?
├── POST /attacks/mitm/start             → (Opcional) Interceptar tráfico
└── POST /sessions/{id}/findings         → Documentar cada hallazgo

FASE 4: LIMPIEZA
├── POST /attacks/evil-twin/stop         → Parar ataques activos
├── POST /attacks/mitm/stop
├── POST /interfaces/wlan0mon/managed    → Restaurar interfaz
├── GET  /sessions/{id}/report           → Generar informe final
└── POST /sessions/{id}/close            → Cerrar sesión
```

---

## 20. Referencia rápida de todos los endpoints

| # | Método | Ruta | Descripción |
|---|---|---|---|
| 1 | `GET` | `/system/health` | Health check |
| 2 | `GET` | `/system/info` | Info del sistema |
| 3 | `GET` | `/system/tools` | Estado de 30+ herramientas |
| 4 | `GET` | `/system/tools/categories` | Herramientas por categoría |
| 5 | `GET` | `/system/preflight` | Check completo pre-auditoría |
| 6 | `GET` | `/system/processes` | Subprocesos activos |
| 7 | `POST` | `/system/processes/{id}/cancel` | Matar subproceso |
| 8 | `GET` | `/system/oui/{mac}` | Lookup fabricante |
| 9 | `POST` | `/system/oui/download` | Descargar DB IEEE OUI |
| 10 | `GET` | `/interfaces/` | Listar interfaces WiFi |
| 11 | `GET` | `/interfaces/{name}` | Detalle interfaz |
| 12 | `POST` | `/interfaces/{name}/monitor` | Activar monitor |
| 13 | `POST` | `/interfaces/{name}/managed` | Restaurar managed |
| 14 | `POST` | `/interfaces/{name}/mac` | Cambiar MAC |
| 15 | `POST` | `/interfaces/{name}/txpower` | Ajustar TX power |
| 16 | `GET` | `/interfaces/{name}/channels` | Canales soportados |
| 17 | `POST` | `/wifi/scan` | Escaneo WiFi (2.4/5/dual) |
| 18 | `GET` | `/wifi/scans` | Listar escaneos |
| 19 | `GET` | `/wifi/scans/{id}` | Detalle escaneo |
| 20 | `POST` | `/wifi/scans/{id}/stop` | Parar escaneo |
| 21 | `GET` | `/wifi/scans/{id}/pnl` | Análisis PNL |
| 22 | `POST` | `/wifi/handshake` | Capturar handshake |
| 23 | `POST` | `/wifi/crack` | Crackear handshake |
| 24 | `POST` | `/wifi/deauth` | Enviar deauth |
| 25 | `POST` | `/recon/scan` | Escaneo nmap |
| 26 | `POST` | `/recon/discover` | Ping sweep |
| 27 | `POST` | `/recon/deep/{ip}` | Escaneo profundo |
| 28 | `POST` | `/recon/vuln/{ip}` | Vuln scan |
| 29 | `POST` | `/recon/router` | Router probe (CTF) |
| 30 | `GET` | `/recon/scans` | Listar scans nmap |
| 31 | `GET` | `/recon/scans/{id}` | Detalle scan nmap |
| 32 | `POST` | `/attacks/evil-twin/start` | Lanzar Evil Twin |
| 33 | `POST` | `/attacks/evil-twin/stop` | Parar Evil Twin |
| 34 | `GET` | `/attacks/evil-twin/status` | Estado Evil Twin |
| 35 | `POST` | `/attacks/mitm/start` | Iniciar MITM |
| 36 | `POST` | `/attacks/mitm/stop` | Parar MITM |
| 37 | `GET` | `/attacks/mitm/status` | Estado MITM |
| 38 | `POST` | `/advanced/pmkid/capture` | Capturar PMKID |
| 39 | `POST` | `/advanced/pmkid/crack` | Crackear PMKID |
| 40 | `GET` | `/advanced/pmkid/captures` | Listar capturas PMKID |
| 41 | `POST` | `/advanced/apless/start` | Lanzar AP-less |
| 42 | `POST` | `/advanced/apless/stop` | Parar AP-less |
| 43 | `GET` | `/advanced/apless/status` | Estado AP-less |
| 44 | `GET` | `/advanced/apless/results` | Resultados AP-less |
| 45 | `POST` | `/advanced/enterprise/start` | Lanzar Enterprise |
| 46 | `POST` | `/advanced/enterprise/stop` | Parar Enterprise |
| 47 | `GET` | `/advanced/enterprise/status` | Estado Enterprise |
| 48 | `GET` | `/advanced/enterprise/credentials` | Credenciales capturadas |
| 49 | `POST` | `/advanced/wpa3/attack` | Ataque WPA3 |
| 50 | `GET` | `/advanced/wpa3/results` | Resultados WPA3 |
| 51 | `GET` | `/captures/` | Listar archivos captura |
| 52 | `POST` | `/captures/check-handshake` | Verificar handshake/PMKID |
| 53 | `DELETE` | `/captures/` | Eliminar captura |
| 54 | `POST` | `/sessions/` | Crear sesión |
| 55 | `GET` | `/sessions/` | Listar sesiones |
| 56 | `GET` | `/sessions/{id}` | Detalle sesión |
| 57 | `POST` | `/sessions/{id}/findings` | Añadir hallazgo |
| 58 | `POST` | `/sessions/{id}/close` | Cerrar sesión |
| 59 | `GET` | `/sessions/{id}/report` | Exportar informe |

---

## 21. Configuración avanzada

### Variables de entorno (.env)

| Variable | Default | Descripción |
|---|---|---|
| `DEBUG` | `true` | Modo debug (auto-reload, logs verbosos) |
| `HOST` | `0.0.0.0` | Bind address del servidor |
| `PORT` | `8000` | Puerto HTTP |
| `REQUIRE_AUTH` | `false` | Si true, requiere header `X-API-Key` en cada request |
| `API_KEY` | `change-me-in-production` | API key para autenticación |

### Directorios de datos

Todos se crean automáticamente al iniciar el backend:

| Directorio | Contenido |
|---|---|
| `data/captures/` | Escaneos (.cap, .csv) |
| `data/handshakes/` | Handshakes WPA y AP-less |
| `data/pmkid/` | Capturas PMKID (.pcapng, .22000) |
| `data/reports/` | Sesiones + escaneos nmap (JSON, XML) |
| `data/wordlists/` | Diccionarios personalizados |
| `data/logs/` | Logs de ataques (dnsmasq, hostapd, mitm) |
| `data/hostapd/` | Configuraciones hostapd generadas |
| `data/enterprise/` | Certificados SSL y configs 802.1X |

---

## 22. Guía de troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| "No wireless interfaces found" | Adaptador no conectado o no reconocido | Verifica conexión USB. En VM, asigna el USB al guest. Instala drivers si es Realtek. |
| "airmon-ng: command not found" | aircrack-ng no instalado | `sudo apt install aircrack-ng` |
| Preflight dice "NOT READY" | No es root | Ejecutar con `sudo` |
| Escaneo devuelve 0 APs | Interfaz no en monitor | Activar monitor primero con `/interfaces/{name}/monitor` |
| Escaneo solo muestra 2.4 GHz | Band por defecto es `bg` | Usar `band: "abg"` para dual-band (requiere adaptador 5 GHz) |
| Handshake no capturado | No hay clientes conectados | Prueba PMKID primero (sin clientes). Si no, usa AP-less. |
| Deauth no funciona | Interfaz en managed mode | Debe estar en monitor mode |
| Crack no encuentra la clave | Clave no está en el diccionario | Genera wordlists personalizados con `cewl` (scraping web empresa) o `crunch` |
| Evil Twin: clientes no se conectan | AP legítimo tiene mejor señal | Acércate al objetivo. Usa deauth_legitimate para forzar reconexión. |
| Enterprise: no captura credenciales | Clientes validan el certificado | Algunos clientes modernos rechazan certificados autofirmados. |
| PMKID: "not captured" | AP no soporta PMKID | No todos los APs envían PMKID. Pasa al handshake tradicional. |
| Proceso colgado | Timeout insuficiente o bug en la herramienta | Mátalo con `POST /system/processes/{id}/cancel` |

---

## 23. Glosario técnico

| Término | Definición |
|---|---|
| **AP (Access Point)** | Dispositivo que crea la red WiFi. Puede ser un router o un AP dedicado. |
| **BSSID** | Basic Service Set Identifier. Es la MAC address del AP. |
| **ESSID/SSID** | Extended Service Set Identifier. El nombre visible de la red WiFi. |
| **Beacon** | Paquete que el AP envía periódicamente anunciando su existencia. |
| **Probe Request** | Paquete que un cliente envía buscando redes guardadas (PNL). |
| **PNL** | Preferred Network List. Lista de redes WiFi guardadas en un dispositivo. |
| **Handshake** | Intercambio de 4 mensajes entre cliente y AP para autenticación WPA/WPA2. |
| **PMKID** | Pairwise Master Key Identifier. Hash que algunos APs incluyen en el primer EAPOL. |
| **PMK** | Pairwise Master Key. Derivada de la contraseña WiFi + SSID con PBKDF2. |
| **PTK** | Pairwise Transient Key. Clave de sesión derivada del PMK + nonces + MACs. |
| **EAPOL** | Extensible Authentication Protocol over LAN. Protocolo usado en el handshake. |
| **Deauth** | Deauthentication. Paquete que fuerza la desconexión de un cliente del AP. |
| **Evil Twin** | AP falso que imita una red legítima para engañar a los clientes. |
| **RADIUS** | Remote Authentication Dial-In User Service. Servidor de autenticación centralizado. |
| **EAP** | Extensible Authentication Protocol. Framework de autenticación usado en Enterprise. |
| **SAE** | Simultaneous Authentication of Equals. Protocolo de autenticación de WPA3 (Dragonfly). |
| **OUI** | Organizationally Unique Identifier. Los primeros 3 bytes de una MAC que identifican al fabricante. |
| **Channel Hopping** | Técnica donde el adaptador salta entre canales para capturar tráfico de todos. |
| **Packet Injection** | Capacidad de enviar paquetes arbitrarios al aire (necesario para deauth, fake auth). |
| **Monitor Mode** | Modo del adaptador WiFi que captura todos los paquetes del aire sin asociarse a ningún AP. |
| **ARP Spoofing** | Enviar paquetes ARP falsos para redirigir tráfico a través de tu máquina (MITM). |
| **Wordlist** | Archivo de texto con contraseñas candidatas para ataques de diccionario. |
| **CTF** | Capture The Flag. En este contexto, demostrar acceso al panel del router. |
| **NSE** | Nmap Scripting Engine. Scripts Lua que nmap ejecuta para detectar vulnerabilidades. |
| **CCMP** | Counter Mode CBC-MAC Protocol. Cifrado AES usado en WPA2. |
| **TKIP** | Temporal Key Integrity Protocol. Cifrado legacy usado en WPA (basado en RC4). |
| **IV** | Initialization Vector. Valor único usado en cada paquete cifrado. En WEP era de 24 bits, demasiado corto. |
| **MIC** | Message Integrity Code. Verificación de integridad del mensaje en el handshake. |
| **MIMO** | Multiple-In Multiple-Out. Uso de múltiples antenas para mayor throughput. |
| **Beamforming** | Tecnología que enfoca la señal WiFi hacia donde está el cliente. |

---

*WFAudit Backend v2.0 — 2.742 líneas de código · 34 archivos · 11 servicios · 59 endpoints · 30+ herramientas integradas*
