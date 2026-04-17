# WFAudit Backend — Documentación Exhaustiva

**Plataforma profesional de auditoría de seguridad WiFi.**

Backend API construido con **FastAPI (Python 3.11+)** que orquesta las herramientas estándar de la industria de ciberseguridad wireless para realizar auditorías completas sobre redes WiFi. Desde el reconocimiento pasivo hasta ataques avanzados contra WPA3 y Enterprise (802.1X), pasando por interceptación MITM con modo stealth.

> ⚠️ **AVISO LEGAL**: Esta herramienta está diseñada exclusivamente para auditorías de seguridad bajo contrato legal firmado entre el auditor y la organización propietaria de la infraestructura. El uso no autorizado constituye un delito en la mayoría de jurisdicciones (en España, artículos 197 y 264 del Código Penal; en EE.UU., Computer Fraud and Abuse Act; en la UE, Directiva 2013/40/UE).

---

## Tabla de Contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Fundamentos de seguridad WiFi](#2-fundamentos-de-seguridad-wifi)
3. [Requisitos del sistema](#3-requisitos-del-sistema)
4. [Instalación y arranque](#4-instalación-y-arranque)
5. [Arquitectura del proyecto](#5-arquitectura-del-proyecto)
6. [Módulo: System](#6-módulo-system--preparación-del-entorno)
7. [Módulo: Interfaces](#7-módulo-interfaces--gestión-de-tarjetas-wifi)
8. [Módulo: WiFi Scan](#8-módulo-wifi-scan--descubrimiento-de-redes)
9. [Módulo: Handshake & Crack](#9-módulo-handshake--crack--auditoría-wpawpa2)
10. [Módulo: PMKID](#10-módulo-pmkid--ataque-sin-clientes)
11. [Módulo: AP-Less](#11-módulo-ap-less--honeypot-sin-ap-legítimo)
12. [Módulo: Evil Twin](#12-módulo-evil-twin--punto-de-acceso-falso)
13. [Módulo: Enterprise](#13-módulo-enterprise--ataque-a-wpa2-enterprise)
14. [Módulo: WPA3](#14-módulo-wpa3--ataques-al-estándar-más-reciente)
15. [Módulo: Recon](#15-módulo-recon--reconocimiento-con-nmap)
16. [Módulo: MITM](#16-módulo-mitm--man-in-the-middle-avanzado)
17. [Módulo: Captures](#17-módulo-captures--gestión-de-archivos)
18. [Módulo: Sessions](#18-módulo-sessions--documentación-de-auditoría)
19. [Flujo de trabajo completo](#19-flujo-de-trabajo-completo-paso-a-paso)
20. [Referencia completa de endpoints](#20-referencia-completa-de-endpoints)
21. [Modelos de datos (schemas)](#21-modelos-de-datos-schemas)
22. [Configuración avanzada](#22-configuración-avanzada)
23. [Troubleshooting detallado](#23-troubleshooting-detallado)
24. [Preguntas frecuentes (FAQ)](#24-preguntas-frecuentes-faq)
25. [Glosario técnico](#25-glosario-técnico)
26. [Bibliografía y referencias](#26-bibliografía-y-referencias)

---

## 1. Resumen ejecutivo

### ¿Qué es WFAudit?

WFAudit es un **backend API REST** que abstrae la complejidad de las herramientas de auditoría WiFi de línea de comandos, exponiéndolas como endpoints HTTP fácilmente consumibles desde un frontend web, una app móvil, un script de automatización o cualquier cliente HTTP.

En lugar de ejecutar manualmente una decena de comandos diferentes en la terminal (`airodump-ng`, `aireplay-ng`, `hcxdumptool`, `hashcat`, `nmap`, `hostapd`, `arpspoof`, `mitmdump`, etc.) y parsear manualmente sus outputs dispares, WFAudit centraliza toda la operativa bajo una **API REST uniforme con documentación Swagger auto-generada**.

### Cifras del proyecto

| Métrica | Valor |
|---|---|
| Líneas de código Python | ~3.000 |
| Archivos fuente | 36 |
| Endpoints HTTP | 62 |
| Servicios (capa de negocio) | 11 |
| Routers (capa HTTP) | 8 |
| Utilidades compartidas | 6 |
| Schemas Pydantic | 50+ |
| Herramientas del sistema integradas | 30+ |

### Capacidades completas

**Reconocimiento pasivo:**
- Escaneo WiFi en bandas 2.4 GHz, 5 GHz o dual-band simultáneamente
- Identificación de Access Points con ESSID, BSSID, canal, potencia, seguridad, cifrado, autenticación, WPS, fabricante
- Detección de clientes wireless asociados y no asociados
- Análisis de Preferred Network Lists (PNL) y generación de candidatos Evil Twin
- Identificación de fabricantes vía OUI (200+ built-in + IEEE database)
- Detección de MAC randomizadas (dispositivos modernos con privacy)

**Ataques a WPA/WPA2-Personal:**
- Captura de handshake WPA 4-way con deauth dirigido o broadcast
- Cracking offline con aircrack-ng o hashcat (GPU-accelerated)
- Ataque PMKID sin clientes conectados (hcxdumptool + hashcat)
- Ataque AP-less honeypot para capturar handshakes de clientes en probing

**Ataques a WPA2-Enterprise (802.1X/EAP):**
- Rogue RADIUS con Evil Twin para capturar credenciales EAP (PEAP, EAP-TTLS)
- Generación automática de certificados SSL autofirmados
- Parseo de logs para extraer usernames y hashes MSCHAP

**Ataques a WPA3:**
- Detección de Transition Mode (WPA2+WPA3 coexistentes)
- Explotación de downgrade WPA3 → WPA2
- DoS contra SAE (Dragonfly handshake)

**Ataques de capa red:**
- Evil Twin con portal cautivo, forwarding de internet y deauth integrado
- MITM con ARP spoofing bidireccional + mitmproxy
- **Modo Stealth (invisible)**: DNS + TLS SNI + HTTP sin warnings
- **Modo Full**: interceptación HTTPS completa (requiere CA cert en target)
- Real-time flow viewer con filtros por host/método/credenciales

**Reconocimiento interno (post-acceso):**
- Nmap con 8 perfiles (quick, full, vuln, service, os_detect, stealth, UDP, custom)
- Router probe (CTF) con puertos configurables
- Detección de OS, servicios, versiones y vulnerabilidades

**Gestión y reporting:**
- Sesiones de auditoría con hallazgos categorizados por severidad
- Gestión centralizada de archivos de captura (.cap, .pcap, .pcapng, .22000, .csv, .jsonl)
- Exportación de informes estructurados en JSON
- Gestión de subprocesos con cancelación en caliente

---

## 2. Fundamentos de seguridad WiFi

Para entender qué hace internamente cada módulo del backend, es esencial conocer los fundamentos del protocolo IEEE 802.11 y sus mecanismos de seguridad. Esta sección te da toda la base necesaria.

### 2.1. Estándares IEEE 802.11

Las redes WiFi se basan en la familia 802.11 del IEEE. El backend opera sobre todas las variantes actualmente desplegadas:

| Estándar | Frecuencia | Velocidad máx. | Año | Notas |
|---|---|---|---|---|
| 802.11b | 2.4 GHz | 11 Mbps | 1999 | Legacy, casi extinto |
| 802.11g | 2.4 GHz | 54 Mbps | 2003 | Común en dispositivos antiguos |
| 802.11n | 2.4 + 5 GHz | 300 Mbps | 2009 | WiFi 4, MIMO |
| 802.11ac | 5 GHz | 1 Gbps | 2013 | WiFi 5, beamforming, MU-MIMO |
| 802.11ax | 2.4 + 5 GHz | 9.6 Gbps | 2019 | WiFi 6/6E, OFDMA |
| 802.11be | 2.4 + 5 + 6 GHz | 46 Gbps | 2024 | WiFi 7 (emergente) |

Cuando el backend escanea con `band: "bg"` captura en 2.4 GHz (canales 1-14). Con `band: "a"` captura 5 GHz (canales 36+). Con `band: "abg"` captura **ambas bandas simultáneamente**, lo cual es crítico porque muchas organizaciones tienen redes en 5 GHz que no se ven con un escaneo por defecto de 2.4 GHz.

### 2.2. Canales y frecuencias

**Banda de 2.4 GHz** — 14 canales pero solo 3 no se solapan entre sí: **1, 6 y 11**. La mayoría de redes empresariales usan estos tres. Cada canal ocupa 20 MHz de ancho. Los canales adyacentes (p.ej. 1 y 2) se solapan e interfieren.

**Banda de 5 GHz** — Muchos más canales disponibles: 36, 40, 44, 48, 52, 56, 60, 64, 100-144, 149-165. Los canales 52-144 están en el rango DFS (Dynamic Frequency Selection) donde el AP debe ceder el canal si detecta radares. Ancho variable: 20, 40, 80 o 160 MHz. Mucha menos interferencia pero menor alcance y penetración en muros.

**Banda de 6 GHz (WiFi 6E)** — Solo dispositivos WiFi 6E+. Canales 1-233 en un espectro totalmente nuevo.

El backend detecta automáticamente en qué banda y canal opera cada AP y puede listar los canales soportados por cada adaptador (`GET /interfaces/{name}/channels`).

### 2.3. Tipos de seguridad WiFi

**OPEN** — Sin cifrado ni autenticación. Cualquier dispositivo puede conectarse. En el modelo el backend lo identifica como `security: "open"`. Es un hallazgo crítico en una auditoría: todo el tráfico se transmite en texto plano (salvo el que esté cifrado a nivel aplicación).

**WEP (Wired Equivalent Privacy)** — Primer estándar de seguridad WiFi (1999). Completamente roto. Usa RC4 con un IV (Initialization Vector) de solo 24 bits que se repite rápidamente. Capturando suficientes IVs (100.000-500.000 paquetes) se puede derivar la clave en minutos con ataques estadísticos (Fluhrer-Mantin-Shamir, KoreK, PTW). Ya no se encuentra casi nunca en producción pero el backend lo detecta como `security: "wep"` y lo marca como hallazgo crítico automáticamente.

**WPA (Wi-Fi Protected Access)** — Sucesor de WEP (2003). Usa **TKIP** (Temporal Key Integrity Protocol) que mejora la aleatorización de claves respecto a WEP, pero sigue usando RC4 por debajo. Vulnerable a ataques de diccionario offline tras capturar el handshake. También vulnerable al ataque Beck-Tews que permite desencriptar paquetes cortos. El backend lo identifica como `security: "wpa"`.

**WPA2-Personal (PSK)** — El estándar más usado actualmente. Usa **AES-CCMP** (Counter Mode CBC-MAC Protocol) para cifrado, que sí es criptográficamente seguro. El problema no está en el cifrado sino en la **autenticación**: el handshake de 4 vías se puede capturar y crackear offline si la contraseña es débil. El backend tiene múltiples estrategias para atacarlo:
- Captura de handshake tradicional (deauth + captura)
- Ataque PMKID (sin clientes)
- Ataque AP-less (honeypot para capturar handshakes de clientes probing)

**WPA2-Enterprise (802.1X/EAP)** — En lugar de una contraseña compartida, cada usuario tiene credenciales individuales gestionadas por un servidor **RADIUS**. Usa protocolos **EAP** (Extensible Authentication Protocol) para la autenticación:
- **EAP-PEAP** (el más común) — Túnel TLS + MSCHAPv2 dentro
- **EAP-TTLS** — Túnel TLS + PAP/CHAP/MSCHAP dentro  
- **EAP-TLS** — Autenticación mutua con certificados cliente (el más seguro, menos común)
- **EAP-FAST** — Cisco propietario

El backend puede atacarlo con un Rogue RADIUS + Evil Twin que captura las credenciales EAP cuando los clientes se conectan al AP falso.

**WPA3-Personal (SAE)** — El estándar más reciente (2018-2020). Reemplaza el handshake de 4 vías por **SAE** (Simultaneous Authentication of Equals), también llamado "Dragonfly handshake". SAE es resistente a ataques de diccionario offline porque cada intento de autenticación requiere interacción live con el AP (imposible de precomputar). Además implementa **Forward Secrecy** — aunque te crackeen la contraseña en el futuro no puedes descifrar tráfico pasado. Sin embargo, el backend puede explotar el **Transition Mode** (cuando un AP soporta WPA2+WPA3 simultáneamente por compatibilidad), forzando un downgrade a WPA2.

### 2.4. El handshake de 4 vías (WPA/WPA2)

Este es el proceso central que el backend explota en los módulos de Handshake y PMKID. Cuando un cliente se conecta a un AP con WPA2-PSK, ocurren 4 mensajes en secuencia (RFC 4764, IEEE 802.11i):

```
Cliente                                              AP
  │                                                  │
  │          1. ANonce + RSN Info                    │
  │ ◄────────────────────────────────────────────────│
  │          (El AP envía un nonce aleatorio.        │
  │           Aquí puede incluir el PMKID →          │
  │           usado por el ataque PMKID)             │
  │                                                  │
  │          2. SNonce + MIC                         │
  │──────────────────────────────────────────────────►│
  │          (El cliente genera su nonce,            │
  │           calcula PTK usando la contraseña       │
  │           + nonces + MACs, envía MIC)            │
  │                                                  │
  │          3. Install + MIC                        │
  │ ◄────────────────────────────────────────────────│
  │          (El AP verifica el MIC,                 │
  │           confirma conocimiento de password,     │
  │           ordena instalar la clave)              │
  │                                                  │
  │          4. ACK + MIC                            │
  │──────────────────────────────────────────────────►│
  │          (Cliente confirma instalación)          │
```

**Derivación de claves:**

```
PMK = PBKDF2(HMAC-SHA1, passphrase, SSID, 4096 iteraciones, 32 bytes)
PTK = PRF-512(PMK, "Pairwise key expansion", 
              min(MAC_AP, MAC_STA) || max(MAC_AP, MAC_STA) ||
              min(ANonce, SNonce) || max(ANonce, SNonce))
```

El **handshake** capturado (mensajes 2-3 son suficientes) contiene:
- ANonce y SNonce (nonces de 32 bytes)
- MAC del AP y del cliente
- MIC calculado con la PTK
- El SSID

Con esta información, `aircrack-ng` o `hashcat` pueden probar contraseñas del diccionario: para cada candidato, recalculan la PMK + PTK + MIC y verifican si coincide con el MIC capturado. Si coincide, la contraseña es correcta.

**Velocidad de cracking** (aproximada, depende del hardware):
- CPU (aircrack-ng): 500-5.000 palabras/segundo
- GPU moderna (hashcat, modo 22000): 500.000-5.000.000 palabras/segundo

### 2.5. PMKID — La alternativa sin clientes

El **PMKID** es un hash que algunos APs incluyen en el **primer mensaje** del handshake (message 1) como optimización para reconexiones rápidas (PMKSA caching). Se calcula como:

```
PMKID = HMAC-SHA1-128(PMK, "PMK Name" || MAC_AP || MAC_STA)
```

Donde `PMK = PBKDF2(HMAC-SHA1, passphrase, SSID, 4096, 32)`.

La ventaja crítica del ataque PMKID frente al handshake tradicional:

| Aspecto | Handshake tradicional | PMKID |
|---|---|---|
| Clientes necesarios | Al menos 1 | **0** |
| Paquetes necesarios | 2-4 mensajes | **1 mensaje** |
| Deauth requerido | Normalmente sí | No |
| Detectabilidad | Media-alta | **Muy baja** |
| Velocidad de captura | 30-120 segundos | **5-30 segundos** |
| % de APs vulnerables | 100% | ~70-80% |

No todos los APs envían PMKID, pero la mayoría de dispositivos SOHO modernos sí. Descubierto por Jens Steube (creador de hashcat) en 2018.

El backend implementa dos estrategias:
- **hcxdumptool** (preferida) — Herramienta diseñada específicamente para PMKID. Genera archivo `.pcapng` que se convierte a formato hashcat `.22000` con `hcxpcapngtool`.
- **airodump-ng** (fallback) — También captura PMKIDs. Cuando lo hace, muestra "PMKID" en la columna Notes de su output CSV.

### 2.6. Preferred Network List (PNL)

Cada dispositivo WiFi almacena una lista de redes a las que se ha conectado anteriormente, con sus credenciales. Cuando el dispositivo no está conectado a ninguna red, envía **probe requests** (solicitudes de sondeo) buscando esas redes guardadas. Estos probes son visibles para cualquier adaptador en modo monitor.

**Ejemplo real de probes de un teléfono:**
```
Probing: "CasaMario"
Probing: "Starbucks_Free_WiFi"
Probing: "Corp_WiFi_Internal"
Probing: "HotelMarriott_Guest"
Probing: "AeropuertoMAD"
```

El backend analiza estos probes en `analyze_pnl()` (`parsers.py`) para:
- Identificar qué redes buscan los dispositivos del target (inteligencia social)
- Detectar redes en la PNL que **ya no existen** pero que los dispositivos siguen buscando — estos son **candidatos perfectos para Evil Twin**
- Identificar dispositivos con MAC randomizadas (iOS 14+, Android 10+)
- Correlacionar MACs con fabricantes para identificar dispositivos específicos

**Mitigación por parte de los fabricantes (randomización de MAC):**
- **iOS 14+** (2020): MAC randomizada por SSID guardado
- **Android 10+** (2019): MAC randomizada por defecto
- **Windows 10+** (2015): opcional, deshabilitada por defecto

La randomización se detecta mirando el segundo bit del primer octeto de la MAC: si es 1, es localmente administrada (probable randomización).

### 2.7. ARP Spoofing (fundamento del MITM)

El **Address Resolution Protocol** (ARP) mapea direcciones IP a MAC en una red local. Es stateless y no autentica — cualquiera puede enviar ARP replies no solicitados y los dispositivos los aceptarán, actualizando su caché.

Un atacante en la misma red local puede enviar ARP replies falsos diciendo "la IP del gateway es MI MAC" y los dispositivos víctima comenzarán a enviarle todo el tráfico destinado al gateway.

**ARP spoof bidireccional** (crítico para que funcione):

```
1. Atacante → Víctima: "La MAC del gateway (192.168.1.1) es mi MAC"
2. Atacante → Gateway: "La MAC de la víctima (192.168.1.98) es mi MAC"

Ahora:
  Víctima → Gateway: pasa por el atacante
  Gateway → Víctima: pasa por el atacante
```

Si solo haces ARP spoof en una dirección (error común), la víctima pierde internet porque sus respuestas del gateway van directo a ella pero sus paquetes salientes van al atacante que no los reenvía correctamente.

El backend implementa spoofing **bidireccional** lanzando dos procesos `arpspoof` por cada target, y configura iptables con `FORWARD ACCEPT` + `MASQUERADE` para que el kernel realmente reenvíe los paquetes correctamente.

### 2.8. TLS SNI — El talón de Aquiles de HTTPS

**Server Name Indication (SNI)** es una extensión TLS (RFC 6066) que el cliente envía **en texto plano** dentro del Client Hello, antes del handshake TLS. Indica a qué hostname quiere conectarse (necesario para servidores con múltiples certificados/dominios).

**Ejemplo de Client Hello (visible sin descifrar):**
```
Client Hello
├── TLS Version: 1.3
├── Random: ...
├── Extensions:
│   ├── server_name: "skyscanner.es"  ← VISIBLE EN TEXTO PLANO
│   ├── supported_versions: TLS 1.3, 1.2
│   └── ...
```

Esto significa que aunque no puedas descifrar el contenido HTTPS, **puedes ver exactamente a qué dominio se conecta cada TLS handshake**. Esto es lo que explota el **modo Stealth** del MITM: captura DNS queries + TLS SNI + HTTP sin necesidad de interceptar/descifrar HTTPS (y por tanto sin warnings en el dispositivo target).

**Encrypted Client Hello (ECH)** — Nueva extensión (RFC 9180, aún no ampliamente desplegada) que cifra el SNI. Cuando esté extendida, este vector perderá efectividad. A día de hoy (2026), la inmensa mayoría de clientes siguen enviando SNI en texto plano.

---

## 3. Requisitos del sistema

### 3.1. Sistema operativo

**Soportado oficialmente:**
- **Kali Linux 2024.x+** (recomendado — todas las herramientas preinstaladas)
- **Parrot OS Security 6+**
- **BlackArch Linux**
- **Debian 12+** / **Ubuntu 22.04+** (requiere instalar herramientas manualmente)
- **Arch Linux** con blackarch repo

**No soportado:**
- Windows (imposible — iptables, monitor mode, raw sockets Linux-only)
- macOS (parcial — no hay monitor mode estándar, no hay iptables)

El backend usa APIs específicas de Linux: kernel netlink, iptables, netfilter, AF_PACKET raw sockets.

### 3.2. Hardware requerido

**Equipo principal:**
- CPU x86_64 moderna (ARM funciona pero algunas herramientas como hashcat no están optimizadas)
- RAM: 4 GB mínimo, 8+ GB recomendado
- Disco: 10 GB libres para capturas grandes
- GPU (opcional pero altamente recomendable para cracking): cualquier GPU NVIDIA con CUDA o AMD con OpenCL acelera hashcat 100-1000x

**Adaptadores WiFi:**

Necesitas **al menos UN** adaptador con soporte para **modo monitor** y **packet injection**. Para Evil Twin o Enterprise necesitas **DOS** adaptadores.

**Chipsets recomendados (2026, probados y verificados):**

| Chipset | Adaptadores conocidos | Monitor | Injection | AP Mode | 5 GHz |
|---|---|---|---|---|---|
| **Atheros AR9271** | Alfa AWUS036NHA, TP-Link TL-WN722N v1 | ✓ | ✓ | ✓ | ✗ |
| **Ralink RT3070/RT5572** | Alfa AWUS036NH, AWUS051NH | ✓ | ✓ | ✓ | ✓ (RT5572) |
| **Realtek RTL8812AU** | Alfa AWUS036ACH, AWUS1900 | ✓ | ✓ | ✓ | ✓ |
| **Realtek RTL8814AU** | Alfa AWUS1900 | ✓ | ✓ | ✓ | ✓ (MU-MIMO) |
| **MediaTek MT7612U** | Alfa AWUS036ACM | ✓ | ✓ | ✓ | ✓ |

**Evitar:**
- TP-Link TL-WN722N v2/v3 (chipset Realtek RTL8188EUS, mala injection)
- Cualquier Intel integrado (drivers iwlwifi bloquean injection)
- Broadcom integrado en MacBooks (pésimo soporte)

**Cómo verificar que tu adaptador funciona:**

```bash
# 1. Identificar chipset
lsusb          # para USB
lspci | grep -i network    # para PCIe

# 2. Verificar monitor mode
sudo airmon-ng start wlan0
iwconfig wlan0mon    # debe decir Mode:Monitor

# 3. Test de injection (crítico)
sudo aireplay-ng --test wlan0mon
# Si responde "Injection is working!" → OK
# Si no responde → driver no soporta injection
```

### 3.3. Dependencias del sistema

El backend **requiere** estas herramientas instaladas en el PATH del sistema:

**Críticas (sin estas muchos módulos fallan):**
```
aircrack-ng   — Captura + crack WPA/WPA2 (incluye airodump-ng, aireplay-ng, airmon-ng)
hcxdumptool   — Captura PMKID
hcxtools      — Conversión pcapng → hashcat format (hcxpcapngtool)
hashcat       — GPU-accelerated cracking
nmap          — Port/service/OS scanning
hostapd       — Crear APs falsos (Evil Twin)
dnsmasq       — DHCP + DNS para Evil Twin
```

**Atacantes de red:**
```
dsniff        — Incluye arpspoof (MITM)
mitmproxy     — Proxy transparente HTTP/HTTPS
tshark        — CLI Wireshark (modo Stealth MITM)
tcpdump       — Captura pcap para respaldo
iptables      — NAT, forwarding, redirect
macchanger    — Cambio de MAC
```

**Opcionales:**
```
freeradius    — RADIUS server (Enterprise attack)
reaver        — WPS brute force
bully         — WPS brute force alternativo
crunch        — Generación de wordlists
arping        — Restauración ARP cache tras MITM
```

**Python 3.11+** con:
```
fastapi>=0.110
uvicorn[standard]>=0.29
pydantic>=2.6
pydantic-settings>=2.2
python-multipart   # para uploads
aiofiles           # para archivos async
```

El script `wfaudit install` del proyecto instala todo automáticamente según la distribución detectada.

### 3.4. Permisos

El backend **DEBE** ejecutarse con privilegios root. Esto es **imprescindible** y no hay forma de evitarlo sin perder funcionalidad:

- Monitor mode requiere `CAP_NET_ADMIN`
- Raw sockets requieren `CAP_NET_RAW`
- iptables requiere `CAP_NET_ADMIN`
- Modificar rutas requiere `CAP_NET_ADMIN`
- Algunas herramientas (hostapd, dnsmasq) bindean puertos privilegiados

**Opciones para ejecutar como root:**

```bash
# Opción 1: sudo directo (más simple)
sudo uvicorn app.main:app --host 0.0.0.0 --port 8000

# Opción 2: mediante el script wfaudit (recomendado)
sudo ./wfaudit start

# Opción 3: capabilities (complejo, evita sudo completo)
sudo setcap cap_net_admin,cap_net_raw+eip /usr/bin/python3.11
# Luego ejecuta uvicorn como usuario normal — funciona para la mayoría de operaciones
```

---

## 4. Instalación y arranque

### 4.1. Instalación automatizada (recomendada)

Usa el script `wfaudit` en la raíz del proyecto:

```bash
cd /ruta/al/proyecto
sudo ./wfaudit install
```

Esto instala todo: paquetes del sistema, crea `.venv`, instala requirements de Python, instala dependencias npm del frontend, y genera el certificado CA de mitmproxy.

### 4.2. Instalación manual paso a paso

Si prefieres tener control total del proceso:

**Paso 1: Instalar paquetes del sistema (Kali/Debian/Ubuntu)**

```bash
sudo apt update
sudo apt install -y \
    python3 python3-pip python3-venv python3-dev \
    aircrack-ng hcxdumptool hcxtools hashcat \
    nmap tcpdump tshark \
    hostapd dnsmasq macchanger \
    dsniff arping mitmproxy \
    iptables iproute2 net-tools \
    wireless-tools iw \
    build-essential libssl-dev libffi-dev \
    freeradius reaver
```

**Paso 2: Crear virtual environment**

```bash
cd /ruta/al/proyecto
sudo python3 -m venv .venv
sudo chown -R $USER:$USER .venv    # permitir leer sin sudo
```

**Paso 3: Instalar dependencias Python**

```bash
sudo .venv/bin/pip install --upgrade pip
sudo .venv/bin/pip install -r backend/requirements.txt
```

**Paso 4: Generar CA de mitmproxy**

```bash
sudo timeout 5 .venv/bin/mitmdump --listen-port 18888
# Ctrl+C o timeout automático
# Esto crea ~/.mitmproxy/mitmproxy-ca-cert.pem
```

**Paso 5: Arrancar el backend**

```bash
cd backend
sudo ../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4.3. Verificación post-instalación

Con el backend arrancado:

```bash
# Health check básico
curl http://localhost:8000/system/health
# → {"status":"ok","timestamp":"...","root":true}

# Preflight: verifica que todas las herramientas estén instaladas
curl http://localhost:8000/system/preflight | jq
# → lista completa de tools con status "ok" / "missing"

# Ver documentación interactiva Swagger
xdg-open http://localhost:8000/docs
```

Si `/system/preflight` reporta herramientas faltantes, instálalas antes de continuar.

### 4.4. Variables de entorno (`config.py`)

El backend usa `pydantic-settings` para gestionar configuración. Las variables se pueden sobrescribir vía entorno o archivo `.env`:

```bash
# Host/puerto
WFAUDIT_HOST=0.0.0.0
WFAUDIT_PORT=8000

# Directorios de trabajo
WFAUDIT_CAPTURES_DIR=/var/wfaudit/captures
WFAUDIT_LOGS_DIR=/var/wfaudit/logs
WFAUDIT_WORDLISTS_DIR=/usr/share/wordlists

# Seguridad (opcional)
WFAUDIT_API_KEY=tu-clave-secreta    # activar auth
WFAUDIT_CORS_ORIGINS=http://localhost:5173,http://192.168.1.10:5173
```

---

## 5. Arquitectura del proyecto

### 5.1. Visión general

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│              http://localhost:5173                           │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/JSON
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                           │
│                http://localhost:8000                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ROUTERS (capa HTTP — validación, serialización)    │    │
│  │  system / interfaces / wifi / recon / attacks /      │    │
│  │  advanced / captures / sessions                      │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       ▼                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SERVICES (capa de negocio — orquestación)          │    │
│  │  aircrack / pmkid / apless / enterprise / wpa3 /     │    │
│  │  nmap / interface / evil_twin / mitm / capture /     │    │
│  │  session                                             │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       ▼                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  UTILS (capa de infraestructura)                    │    │
│  │  process_manager (subprocess async)                  │    │
│  │  parsers (airodump CSV, nmap XML, etc.)             │    │
│  │  tool_checker (verificación de dependencias)        │    │
│  │  oui_lookup (fabricante por MAC)                    │    │
│  │  mitm_addon + mitm_stealth_monitor                   │    │
│  └────────────────────┬────────────────────────────────┘    │
└───────────────────────┼──────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          SUBPROCESOS DE HERRAMIENTAS DEL SISTEMA             │
│  airodump-ng / aireplay-ng / hcxdumptool / hashcat /         │
│  nmap / hostapd / dnsmasq / arpspoof / mitmdump / tshark     │
└─────────────────────────────────────────────────────────────┘
```

### 5.2. Estructura de directorios

```
backend/
├── requirements.txt
└── app/
    ├── __init__.py
    ├── main.py                  # FastAPI app + middleware + startup
    ├── config.py                # Settings con pydantic-settings
    │
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py           # 50+ modelos Pydantic (requests/responses)
    │
    ├── routers/                 # Capa HTTP — endpoints
    │   ├── system.py            # /system/* — health, preflight
    │   ├── interfaces.py        # /interfaces/* — gestión de adaptadores
    │   ├── wifi.py              # /wifi/* — escaneo, handshake, crack, deauth
    │   ├── recon.py             # /recon/* — nmap, router probe
    │   ├── attacks.py           # /attacks/* — Evil Twin, MITM
    │   ├── advanced.py          # /advanced/* — PMKID, AP-less, Enterprise, WPA3
    │   ├── captures.py          # /captures/* — gestión de archivos
    │   └── sessions.py          # /sessions/* — auditorías
    │
    ├── services/                # Capa de negocio
    │   ├── aircrack_service.py       (206 líneas)
    │   ├── pmkid_service.py          (197 líneas)
    │   ├── apless_service.py         (145 líneas)
    │   ├── enterprise_service.py     (170 líneas)
    │   ├── wpa3_service.py           (175 líneas)
    │   ├── nmap_service.py           (98 líneas)
    │   ├── interface_service.py      (153 líneas)
    │   ├── evil_twin_service.py      (68 líneas)
    │   ├── mitm_service.py           (333 líneas — el más complejo)
    │   ├── capture_service.py        (90 líneas)
    │   └── session_service.py        (55 líneas)
    │
    └── utils/
        ├── process_manager.py    # Ejecutar subprocesos async con cancelación
        ├── parsers.py            # Parseo de outputs de herramientas
        ├── tool_checker.py       # Detección de herramientas instaladas
        ├── oui_lookup.py         # OUI → fabricante
        ├── mitm_addon.py         # Addon mitmproxy para logging JSONL
        └── mitm_stealth_monitor.py  # Monitor stealth basado en tshark
```

### 5.3. Patrón arquitectónico: 3 capas

**Capa 1 — Routers (HTTP):** Definen endpoints, validan entrada con Pydantic, serializan salida. **No contienen lógica de negocio**, solo llaman al servicio correspondiente.

```python
# routers/wifi.py
@router.post("/scan")
async def scan_wifi(req: WifiScanRequest):
    return await aircrack_service.scan(req)
```

**Capa 2 — Services (negocio):** Orquestan herramientas, coordinan múltiples pasos, gestionan estado (sesiones activas, procesos). Son **singletons** (una instancia compartida por endpoint).

```python
# services/aircrack_service.py
class AircrackService:
    async def scan(self, req: WifiScanRequest) -> ScanResult:
        # 1. Poner interface en monitor
        # 2. Lanzar airodump-ng
        # 3. Esperar timeout
        # 4. Parsear CSV resultante
        # 5. Enriquecer con OUI lookup
        # 6. Retornar resultado estructurado
```

**Capa 3 — Utils (infraestructura):** Funciones puras reutilizables. Sin estado. Ejemplo: parsear un CSV de airodump, ejecutar un subprocess con timeout.

```python
# utils/process_manager.py
async def run_sync(cmd: list, timeout: int) -> tuple[str, str, int]:
    """Ejecuta y espera, devuelve (stdout, stderr, returncode)."""
```

Esta separación permite:
- Tests unitarios a nivel servicio sin levantar HTTP
- Reutilización de utils entre varios servicios
- Cambiar el framework HTTP sin tocar la lógica de negocio

### 5.4. Principios de diseño

**1. Async-first.** Todas las operaciones de I/O son async (`asyncio.subprocess`, `aiofiles`). Un solo thread puede manejar cientos de requests concurrentes sin bloqueo.

**2. Errores estructurados.** Cada servicio devuelve un dict con `error` si algo falla, en vez de excepciones opacas. Esto se traduce directamente a JSON para el frontend.

**3. Idempotencia.** `stop` se puede llamar aunque no haya nada corriendo — no crashea. `start` verifica si ya hay sesión activa antes de crear otra.

**4. Verificación activa.** Tras lanzar un proceso, se verifica que realmente funciona (puerto abierto, archivo creado, etc.) antes de reportar éxito.

**5. Cleanup garantizado.** Tras cualquier ataque, las funciones `stop` restauran el estado del sistema (iptables, IP forwarding, ARP cache, procesos colgados).

---

## 6. Módulo: System — Preparación del entorno

### 6.1. Propósito

Este módulo verifica el estado del host antes de ejecutar cualquier auditoría. Es el **primer módulo** que se debe consultar siempre — sin sus verificaciones pasando en verde, ningún ataque va a funcionar.

### 6.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/system/health` | GET | Health check básico (API viva + privilegios) |
| `/system/preflight` | GET | Verifica todas las herramientas instaladas |
| `/system/info` | GET | Info del sistema (kernel, distro, memoria) |
| `/system/processes` | GET | Lista procesos de auditoría corriendo |
| `/system/processes/{id}/kill` | POST | Mata un proceso por ID |

### 6.3. Endpoint `/system/preflight` en detalle

Verifica la presencia de ~30 herramientas del sistema y devuelve un JSON con estado individual:

```json
{
  "all_ok": false,
  "root": true,
  "tools": {
    "aircrack-ng": {"status": "ok", "path": "/usr/bin/aircrack-ng", "version": "1.7"},
    "hcxdumptool": {"status": "ok", "path": "/usr/bin/hcxdumptool"},
    "hashcat": {"status": "ok", "path": "/usr/bin/hashcat"},
    "nmap": {"status": "ok", "path": "/usr/bin/nmap"},
    "mitmproxy": {"status": "ok", "path": "/usr/bin/mitmdump"},
    "tshark": {"status": "missing", "install_cmd": "apt install tshark"},
    "arping": {"status": "missing", "install_cmd": "apt install arping"}
  },
  "warnings": [
    "tshark missing — stealth MITM mode will not work",
    "arping missing — ARP cache restoration will be skipped"
  ]
}
```

El frontend usa esto para mostrar qué funcionalidades están disponibles y cuáles no.

### 6.4. Detalles de implementación

**`utils/tool_checker.py`** — Usa `shutil.which()` para buscar cada herramienta en el PATH. Para algunas ejecuta el binario con `--version` o `-h` y parsea la salida para extraer la versión.

**`routers/system.py`** — Expone los endpoints. Es el más sencillo de todos los routers, ~40 líneas.

**Privilegios root:** Se verifica con `os.geteuid() == 0`. Si no se está como root, `health` devuelve `root: false` y el frontend muestra un banner rojo indicándolo.

---

## 7. Módulo: Interfaces — Gestión de tarjetas WiFi

### 7.1. Propósito

Antes de atacar necesitas configurar tu adaptador WiFi correctamente: ponerlo en modo monitor, cambiar su MAC si quieres anonimato, ajustar el canal para escaneo dirigido, etc. Este módulo encapsula toda esa gestión.

### 7.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/interfaces` | GET | Lista todas las interfaces WiFi con info detallada |
| `/interfaces/{name}` | GET | Info detallada de una interface específica |
| `/interfaces/{name}/channels` | GET | Canales soportados por el adaptador |
| `/interfaces/{name}/monitor` | POST | Activar modo monitor (crea wlanXmon) |
| `/interfaces/{name}/managed` | POST | Devolver a modo managed |
| `/interfaces/{name}/channel` | POST | Fijar canal específico |
| `/interfaces/{name}/macchange` | POST | Cambiar MAC (random o específica) |

### 7.3. Información devuelta por GET `/interfaces`

```json
[
  {
    "name": "wlan0",
    "mac": "aa:bb:cc:dd:ee:ff",
    "mode": "managed",
    "state": "UP",
    "driver": "ath9k_htc",
    "chipset": "Atheros AR9271",
    "phy": "phy0",
    "supports_monitor": true,
    "supports_injection": true,
    "supported_bands": ["2.4 GHz"],
    "supported_channels": [1,2,3,4,5,6,7,8,9,10,11,12,13],
    "current_channel": 6,
    "txpower": "20 dBm",
    "connected_to": "CasaWiFi"
  },
  {
    "name": "wlan1",
    "mac": "00:c0:ca:xx:yy:zz",
    "mode": "managed",
    "driver": "rtl8812au",
    "chipset": "Realtek RTL8812AU",
    "supports_monitor": true,
    "supports_injection": true,
    "supported_bands": ["2.4 GHz", "5 GHz"],
    "current_channel": null
  }
]
```

### 7.4. Detalles de implementación

**Ejecutar monitor mode:** Usa `airmon-ng start wlan0`. Esta herramienta hace varias cosas bajo el capó:
1. Mata procesos que interfieren (NetworkManager, wpa_supplicant) con `airmon-ng check kill`
2. Crea una nueva interface virtual (p.ej. `wlan0mon`)
3. La configura en modo monitor

El servicio **no mata NetworkManager por defecto** para evitar interrumpir el internet del auditor. Si hace falta, expone un toggle `kill_conflicts: true` en el request.

**Detección de chipset:** Combina `lshw -C network` + `lsusb`/`lspci` + lookup en base de datos interna de chipsets conocidos.

**Canales soportados:** Usa `iw phy phyN info` y parsea la sección "Frequencies" para extraer todos los canales legales.

**MAC change:** Usa `macchanger`:
```bash
# Down → change → up
ip link set wlan0 down
macchanger -A wlan0    # MAC aleatoria con OUI válido
ip link set wlan0 up
```

---

## 8. Módulo: WiFi Scan — Descubrimiento de redes

### 8.1. Propósito

Descubrir todas las redes WiFi alcanzables, identificar sus características de seguridad, enumerar clientes conectados, y generar inteligencia para los ataques posteriores. Este es el **primer paso** de toda auditoría.

### 8.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/wifi/scan` | POST | Lanzar escaneo airodump-ng |
| `/wifi/scan/status` | GET | Estado del escaneo en curso |
| `/wifi/scan/stop` | POST | Detener escaneo |
| `/wifi/scan/results` | GET | Obtener resultados |
| `/wifi/scan/pnl` | GET | Análisis de Preferred Network Lists |
| `/wifi/handshake/capture` | POST | Capturar handshake WPA |
| `/wifi/crack` | POST | Crackear handshake |
| `/wifi/deauth` | POST | Inyectar deauths |

### 8.3. Tipos de escaneo

**Por banda:**
- `band: "bg"` — Solo 2.4 GHz (canales 1-14). Más rápido, menos redes, más clientes típicamente.
- `band: "a"` — Solo 5 GHz (canales 36+). Más redes empresariales, mejores velocidades.
- `band: "abg"` — Dual band. Requiere adaptador compatible (no todos los chipsets).

**Por duración:**
- Escaneo corto: 30s — reconocimiento rápido, encuentra APs con clientes activos
- Escaneo medio: 60-120s — balance, captura la mayoría de redes
- Escaneo largo: 300s+ — intensivo, captura redes ocultas y clientes intermitentes

### 8.4. Flujo interno de un escaneo

```
1. Verificar interfaz en modo monitor
   → Si no, activarlo con airmon-ng start
   
2. Limpiar directorio temporal /tmp/wfaudit_scan/
   
3. Lanzar airodump-ng como subprocess async:
   airodump-ng -w /tmp/wfaudit_scan/scan --output-format csv,pcap
               --band <band> <interface_mon>
               
4. Cada 3 segundos, parsear el CSV generado:
   - Detecta nuevos APs y actualiza potencia/clientes de los existentes
   - Parsea probe requests de clientes (para análisis PNL)
   
5. Al finalizar timeout o stop manual:
   - Mata el proceso airodump-ng limpiamente (SIGINT, no SIGKILL)
   - Lee el CSV final
   - Parsea con utils/parsers.py → estructuras ricas
   - Enriquece con OUI lookup (utils/oui_lookup.py)
   - Guarda .pcap final en captures directory
   - Retorna JSON estructurado
```

### 8.5. Estructura de resultado

```json
{
  "scan_id": "abc123",
  "duration_seconds": 60,
  "band": "abg",
  "summary": {
    "total_aps": 23,
    "total_clients": 47,
    "hidden_networks": 2,
    "wps_enabled": 8,
    "open_networks": 3
  },
  "access_points": [
    {
      "bssid": "aa:bb:cc:dd:ee:ff",
      "essid": "CorporateWiFi",
      "channel": 6,
      "power": -45,
      "beacons": 487,
      "data_packets": 1203,
      "encryption": "WPA2",
      "cipher": "CCMP",
      "authentication": "PSK",
      "wps": true,
      "wps_version": "2.0",
      "pmkid_available": true,
      "vendor": "Cisco Systems",
      "first_seen": "2026-01-15 14:23:10",
      "last_seen": "2026-01-15 14:24:05",
      "associated_clients": [
        {"mac": "11:22:33:44:55:66", "power": -52, "vendor": "Apple"},
        {"mac": "aa:22:33:44:55:66", "power": -60, "vendor": "Samsung"}
      ]
    }
  ],
  "unassociated_clients": [
    {
      "mac": "cc:cc:cc:cc:cc:cc",
      "vendor": "Google",
      "power": -70,
      "probed_essids": ["HomeWiFi", "CafePlaza", "Starbucks_Guest"]
    }
  ],
  "capture_files": ["/captures/scan_abc123.cap", "/captures/scan_abc123.csv"]
}
```

### 8.6. Análisis PNL

El endpoint `/wifi/scan/pnl` analiza los probe requests capturados para construir inteligencia sobre los dispositivos del target:

```json
{
  "total_clients_analyzed": 47,
  "clients_with_pnl": 31,
  "unique_probed_essids": 89,
  "top_probed_essids": [
    {"essid": "CasaMario", "probed_by": 1, "exists_in_current_scan": false},
    {"essid": "HotelMarriott_Guest", "probed_by": 3, "exists_in_current_scan": false},
    {"essid": "CorporateWiFi", "probed_by": 12, "exists_in_current_scan": true}
  ],
  "evil_twin_candidates": [
    {
      "essid": "Starbucks_Free_WiFi",
      "probed_by_mac": "aa:bb:cc:dd:ee:ff",
      "client_vendor": "Samsung",
      "reason": "ESSID probed but no AP broadcasting it — Evil Twin candidate"
    }
  ],
  "randomized_macs": [
    {"mac": "da:cc:39:xx:xx:xx", "reason": "Locally-administered bit set"}
  ]
}
```

---

## 9. Módulo: Handshake & Crack — Auditoría WPA/WPA2

### 9.1. Propósito

Este es el ataque **canónico** contra WPA/WPA2-PSK: capturar el handshake cuando un cliente se conecta al AP, y luego hacer cracking offline con un diccionario. Es lento (comparado con PMKID), pero funciona contra el 100% de APs WPA/WPA2 y es el método más fiable cuando hay clientes conectados.

### 9.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/wifi/handshake/capture` | POST | Capturar handshake (con/sin deauth) |
| `/wifi/handshake/verify` | POST | Verificar que un .cap contiene handshake |
| `/wifi/crack` | POST | Crackear con aircrack-ng o hashcat |
| `/wifi/deauth` | POST | Enviar deauths sin captura (herramienta independiente) |

### 9.3. Flujo del ataque

**Fase 1: Captura**

```
1. airodump-ng escuchando en el canal del AP target, escribe a .cap
2. En paralelo, aireplay-ng --deauth envía frames de deauth al cliente
3. El cliente se desconecta del AP
4. Al reconectar, re-negocia el handshake de 4 vías
5. airodump-ng captura los 4 mensajes en el .cap
6. Se verifica que el handshake completo está presente
```

**Estrategias de deauth:**
- **Dirigido** (recomendado): deauth solo a un cliente específico. Menos ruidoso, más eficaz porque el cliente se reconecta rápido a la misma red.
- **Broadcast**: deauth a la BSSID destino=ff:ff:ff:ff:ff:ff. Afecta a todos los clientes. Más rápido pero más detectable.

**Fase 2: Cracking**

Dos motores disponibles:

**aircrack-ng** (CPU):
```bash
aircrack-ng -w wordlist.txt handshake.cap
# ~2000 palabras/segundo en CPU moderna
```

**hashcat** (GPU, mucho más rápido):
```bash
# Conversión a formato hashcat:
hcxpcapngtool -o handshake.22000 handshake.cap

# Crack (modo 22000 = WPA-PBKDF2-PMKID+EAPOL):
hashcat -m 22000 -a 0 handshake.22000 wordlist.txt
# ~500.000+ palabras/segundo en GPU NVIDIA RTX 3080+
```

### 9.4. Request de captura

```json
POST /wifi/handshake/capture
{
  "interface": "wlan0mon",
  "target_bssid": "aa:bb:cc:dd:ee:ff",
  "channel": 6,
  "timeout": 120,
  "deauth": true,
  "deauth_target_client": "11:22:33:44:55:66",  // opcional, si no se deauth a broadcast
  "deauth_packets": 50,
  "deauth_interval": 15   // cada cuántos segundos repetir deauth
}
```

### 9.5. Detalles de implementación

**`services/aircrack_service.py`** orquesta todo el flujo. Maneja:
- Lanzamiento del airodump-ng + aireplay-ng como tareas async paralelas
- Verificación del canal del AP (si no se especifica, lo busca con escaneo rápido)
- Re-intento de deauth si tras 30s no hay handshake
- Parseo del .cap al final con `cowpatty -r` para verificar handshake
- Timeout con cancelación limpia (SIGINT, espera, SIGKILL)

**Verificación de handshake:** No todo `.cap` con tráfico EAPOL contiene un handshake utilizable. Se verifican los 4 mensajes o al menos los mensajes 2 y 3 (suficientes para crack).

```python
async def verify_handshake(cap_file: str) -> dict:
    out, _, _ = await run_sync([
        "aircrack-ng", cap_file
    ])
    # Parsear: "1 handshake" significa que está completo
    return {"handshake": "1 handshake" in out}
```

---

## 10. Módulo: PMKID — Ataque sin clientes

### 10.1. Propósito

Capturar el hash PMKID directamente del AP **sin necesidad de clientes conectados ni deauths**. El más rápido y discreto de los ataques a WPA/WPA2.

### 10.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/advanced/pmkid/capture` | POST | Capturar PMKID de un AP |
| `/advanced/pmkid/crack` | POST | Crackear PMKID con hashcat |

### 10.3. Flujo del ataque

```
1. Poner la interface en modo monitor
2. Fijar el canal al del AP target
3. Lanzar hcxdumptool:
   hcxdumptool -i wlan0mon -c 6 --enable_status=15 -o capture.pcapng
4. hcxdumptool envía EAPOL M1 requests al AP
5. El AP responde con M1 que puede contener PMKID
6. Al capturar PMKID, hcxdumptool loguea "FOUND PMKID"
7. Convertir a formato hashcat:
   hcxpcapngtool -o hash.22000 capture.pcapng
8. Si hay algún PMKID/handshake válido, el .22000 se genera
```

### 10.4. Cracking

Formato **22000** (único que aceptan las versiones modernas de hashcat):

```bash
hashcat -m 22000 -a 0 hash.22000 rockyou.txt
```

Ejemplo del contenido de un `.22000`:
```
WPA*01*abc123def4567...*aabbccddeeff*112233445566*436f727041500a*...*...*...
   │    │               │           │           │
   │    │               │           │           └─ SSID en hex: "CorpAP"
   │    │               │           └─ MAC cliente
   │    │               └─ MAC AP
   │    └─ PMKID (16 bytes = 32 hex chars)
   └─ Tipo: 01 = PMKID, 02 = EAPOL handshake
```

### 10.5. Implementación (`pmkid_service.py`)

```python
async def capture(self, req: PMKIDRequest) -> dict:
    # 1. Interface en monitor + canal fijo
    await self._prepare_interface(req.interface, req.channel)
    
    # 2. hcxdumptool con filtro por BSSID si se especifica
    cmd = [
        "hcxdumptool", "-i", req.interface,
        "-c", str(req.channel),
        "--enable_status=15",
        "-o", pcapng_file,
    ]
    if req.target_bssid:
        cmd += ["--filterlist_ap", self._create_filter(req.target_bssid)]
    
    # 3. Ejecutar con timeout
    proc = await run_with_timeout(cmd, req.timeout)
    
    # 4. Convertir a formato hashcat
    await run_sync([
        "hcxpcapngtool", "-o", hash_file, pcapng_file
    ])
    
    # 5. Verificar que se capturó algo
    pmkid_found = os.path.exists(hash_file) and os.path.getsize(hash_file) > 0
    
    return {
        "pmkid_captured": pmkid_found,
        "method": "hcxdumptool",
        "hash_file": hash_file,
        "pcapng_file": pcapng_file,
    }
```

**Fallback:** Si `hcxdumptool` no está instalado, se usa `airodump-ng` que también captura PMKIDs (aunque menos eficientemente). Lo detecta en el CSV de airodump en la columna "Notes".

---

## 11. Módulo: AP-Less — Honeypot sin AP legítimo

### 11.1. Propósito

A veces quieres atacar el teléfono/portátil de alguien **cuando su red de casa no está cerca**. Por ejemplo, auditar a un ejecutivo en un hotel o aeropuerto. Ahí no puedes capturar el handshake contra el AP real porque el AP no existe en ese lugar.

La técnica **AP-less** (también llamada **KARMA** en su variante clásica, popularizada por Hostapd-WPE) crea un AP falso con el nombre de una red de la PNL del target. Cuando el dispositivo la ve, intenta conectarse — y en ese intento ya se captura suficiente información para atacar la contraseña.

### 11.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/advanced/apless/start` | POST | Iniciar honeypot AP-less |
| `/advanced/apless/stop` | POST | Detener honeypot |
| `/advanced/apless/status` | GET | Estado + capturas |

### 11.3. Flujo del ataque

```
1. Identificar ESSID candidato (vía PNL analysis previo)
   → Ejemplo: el target probando "HotelMarriott_WiFi"
   
2. Configurar dos interfaces:
   - wlan0mon: modo monitor (captura de handshake)
   - wlan1:    modo AP (broadcast del AP falso)
   
3. Lanzar hostapd con config:
   interface=wlan1
   ssid=HotelMarriott_WiFi
   channel=6
   wpa=2
   wpa_passphrase=any_fake_password
   wpa_key_mgmt=WPA-PSK
   
4. En paralelo, airodump-ng en wlan0mon capturando
   
5. El target, al ver "HotelMarriott_WiFi", intenta conectarse
   automáticamente (red guardada en PNL)
   
6. El AP falso acepta la conexión intentándose
   
7. Durante el intento, se genera un handshake parcial que
   contiene PMK derivada de la contraseña REAL del target
   (porque PMK = PBKDF2(passphrase, SSID) y el SSID coincide
   con el que tiene guardado el target)
   
8. Con este handshake capturado, se puede crackear offline
   la contraseña REAL de la red "HotelMarriott_WiFi" del target
```

### 11.4. Detalles técnicos

**Por qué funciona:** La PMK se deriva como `PBKDF2(passphrase, SSID)`. Si el SSID coincide con el que el target tenía guardado, la PMK que el target calcula es la REAL de su red guardada. El AP falso captura el intento de handshake con esa PMK. Aunque la conexión falle (porque la passphrase del AP falso es distinta), el handshake parcial contiene información suficiente para crackear offline la passphrase real.

**Limitaciones:**
- Solo funciona contra WPA/WPA2-PSK (no WPA3, no WPA-Enterprise)
- El target debe tener la red guardada en su PNL
- Dispositivos modernos (iOS 14+, Android 10+) con randomización de MAC y conexiones restringidas son más difíciles de engañar — no todos intentan auto-conectarse a redes familiares si no ven una huella EAP igual

---

## 12. Módulo: Evil Twin — Punto de acceso falso

### 12.1. Propósito

Crear un clon exacto de una red legítima para que los clientes se conecten al AP del atacante en lugar del original. A partir de ahí se puede:
- Interceptar todo el tráfico
- Presentar portales cautivos falsos para capturar credenciales
- Redirigir DNS a servidores maliciosos
- Inyectar contenido en páginas HTTP

### 12.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/attacks/evil-twin/start` | POST | Lanzar Evil Twin |
| `/attacks/evil-twin/stop` | POST | Detener y limpiar |
| `/attacks/evil-twin/status` | GET | Estado + clientes conectados |

### 12.3. Flujo completo

```
1. Fase de reconocimiento:
   - Identificar ESSID y canal del AP legítimo
   - Opcional: identificar clientes conectados
   
2. Configurar interfaz wlan1 en modo AP
   
3. Generar configuración de hostapd:
   interface=wlan1
   ssid=<mismo ESSID que el legítimo>
   channel=<mismo canal>
   hw_mode=g (o a para 5 GHz)
   # Sin seguridad para red abierta, o mismo WPA2 con password cualquiera
   
4. Lanzar hostapd
   
5. Lanzar dnsmasq para DHCP+DNS:
   interface=wlan1
   dhcp-range=192.168.200.10,192.168.200.100,12h
   dhcp-option=3,192.168.200.1    # gateway = nosotros
   dhcp-option=6,192.168.200.1    # DNS = nosotros
   
6. Configurar NAT en iptables para dar internet:
   iptables -A FORWARD -i wlan1 -j ACCEPT
   iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
   sysctl -w net.ipv4.ip_forward=1
   
7. (Opcional) Deauth contra el AP legítimo:
   aireplay-ng --deauth 0 -a <BSSID_legit> wlan0mon
   # Esto fuerza a los clientes a desconectarse y reconectarse,
   # muchos se conectan al Evil Twin si tiene mejor señal
```

### 12.4. Request de configuración

```json
POST /attacks/evil-twin/start
{
  "interface": "wlan1",                    // interfaz para broadcast AP
  "target_essid": "CorpWiFi",              // nombre a clonar
  "channel": 6,
  "internet_interface": "eth0",            // interfaz que da salida a internet (opcional)
  "captive_portal": true,                  // activar portal cautivo
  "captive_portal_template": "wifi_login", // template HTML a servir
  "deauth_legitimate": true,
  "deauth_interface": "wlan0mon",
  "deauth_bssid": "aa:bb:cc:dd:ee:ff",     // BSSID del legítimo
  "deauth_packets": 100
}
```

### 12.5. Portal cautivo

Cuando `captive_portal: true`, dnsmasq se configura para resolver **todas las queries DNS** a la IP del atacante, y se inicia un servidor HTTP en el puerto 80 que sirve una plantilla HTML.

Plantillas disponibles:
- `wifi_login` — Página de login genérica imitando captive portals comerciales
- `microsoft_365` — Imita página de Microsoft 365
- `google_signin` — Imita Google sign-in

Las credenciales introducidas se loguean en el archivo `/captures/evil_twin_<id>_credentials.txt`.

**Ético y legal:** Esto es phishing en red cerrada. Solo se debe usar en auditorías con consentimiento explícito por escrito.

---

## 13. Módulo: Enterprise — Ataque a WPA2-Enterprise

### 13.1. Propósito

WPA2-Enterprise usa un servidor RADIUS para autenticación individual por usuario (en lugar de contraseña compartida). El ataque consiste en levantar un servidor RADIUS falso con un Evil Twin y capturar los intentos de autenticación EAP para luego crackearlos offline.

### 13.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/advanced/enterprise/start` | POST | Lanzar Rogue RADIUS + Evil Twin Enterprise |
| `/advanced/enterprise/stop` | POST | Detener y extraer credenciales |
| `/advanced/enterprise/status` | GET | Estado + credenciales capturadas |

### 13.3. Protocolos EAP soportados para captura

**EAP-PEAP con MSCHAPv2 (el más común):**
- Fase 1: handshake TLS entre cliente y RADIUS
- Fase 2: dentro del túnel TLS, el cliente envía username + MSCHAPv2 hash
- El atacante con certificado falso puede completar fase 1 y capturar username + hash MSCHAPv2 para crackear offline con `asleap` o hashcat modo 5500

**EAP-TTLS:**
- Similar a PEAP pero con PAP/CHAP/MSCHAP dentro
- Si usa PAP, la contraseña se envía **en plano** dentro del túnel TLS (peor caso para la víctima)

**EAP-TLS:**
- Requiere certificado cliente válido
- **No vulnerable** a este ataque — si el cliente usa EAP-TLS, el rogue RADIUS no puede capturar nada porque no tiene la clave privada del certificado cliente

### 13.4. Flujo del ataque

```
1. Generar certificados SSL autofirmados para el RADIUS:
   openssl req -x509 -newkey rsa:2048 -keyout server.key
               -out server.crt -days 365 -nodes
               -subj "/CN=radius.corp.local"
   
2. Configurar freeradius (o hostapd-wpe si es más simple):
   /etc/freeradius/3.0/clients.conf:
     client anyhost { ipaddr = 0.0.0.0 secret = testing123 }
   
   /etc/freeradius/3.0/eap.conf:
     default_eap_type = peap
     tls { private_key_file = server.key
           certificate_file = server.crt }
   
3. Lanzar Evil Twin Enterprise con hostapd:
   interface=wlan1
   ssid=CorpWiFi_Enterprise
   wpa=2
   wpa_key_mgmt=WPA-EAP
   ieee8021x=1
   auth_server_addr=127.0.0.1
   auth_server_port=1812
   auth_server_shared_secret=testing123
   
4. Cliente intenta conectarse:
   - Ve SSID "CorpWiFi_Enterprise"
   - Inicia EAP-PEAP con nuestro rogue RADIUS
   - Acepta nuestro certificado falso (si no tiene pinning) ✗ problema para víctima
   - Envía username + MSCHAPv2 challenge/response dentro del túnel
   
5. freeradius loguea en /var/log/freeradius/radius.log:
   user = "empresa\\juan.perez"
   challenge = abcd1234...
   response = 5678efgh...
   
6. Extraer y parsear logs:
   hashcat -m 5500 hashes.txt rockyou.txt
```

### 13.5. Extracción de credenciales

El servicio parsea automáticamente los logs de freeradius al hacer `stop`:

```json
{
  "captured_credentials": [
    {
      "username": "juan.perez",
      "domain": "empresa",
      "challenge": "abcd1234567890ab",
      "response": "5678efgh90abcdef1234567890abcdef1234567890abcdef",
      "hash_line": "juan.perez::empresa:abcd1234567890ab:5678efgh90abcdef1234567890abcdef1234567890abcdef",
      "hashcat_mode": 5500,
      "crackable": true
    }
  ]
}
```

### 13.6. Mitigación por parte del target (para el informe)

Las organizaciones con WPA2-Enterprise bien configurado deberían:
1. **Validación estricta del certificado del servidor** — Rechazar certificados que no estén firmados por la CA corporativa
2. **Certificate pinning** en dispositivos cliente (requiere MDM)
3. **Preferir EAP-TLS** sobre PEAP/TTLS cuando sea posible
4. **Usar complejidad alta de passwords** (MSCHAPv2 es débil incluso con buenas passwords en 2026)
5. **Migrar a WPA3-Enterprise** (usa SAE-EAP y es inmune a este ataque)

---

## 14. Módulo: WPA3 — Ataques al estándar más reciente

### 14.1. Propósito

WPA3 es el estándar más reciente (2018) y es significativamente más seguro que WPA2. Sin embargo, tiene vulnerabilidades conocidas principalmente en el modo de **transición** (compatibilidad con WPA2). Este módulo las detecta y explota.

### 14.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/advanced/wpa3/detect` | POST | Detectar tipo de WPA3 (pure/transition) |
| `/advanced/wpa3/attack` | POST | Ejecutar ataque contra WPA3 |

### 14.3. Modos de WPA3

**WPA3-Personal Pure** — Solo SAE (Dragonfly). Inmune a ataques de diccionario offline. La seguridad es robusta salvo por bugs de implementación específicos (ej. Dragonblood CVE-2019-9494).

**WPA3-Transition Mode** — AP soporta WPA2-PSK **y** WPA3-SAE simultáneamente, para compatibilidad con clientes antiguos. Vulnerable: un atacante puede forzar a clientes capaces de WPA3 a usar WPA2, y entonces hacer los ataques tradicionales de WPA2 (captura de handshake, PMKID).

### 14.4. Tipos de ataque implementados

**1. Detección del modo** (`attack_type: "detect"`)

Analiza los beacons del AP buscando Information Elements específicos:
- **RSN IE** con cipher group = CCMP y AKM = PSK → WPA2 soportado
- **RSN IE** con AKM = SAE → WPA3 soportado
- Si ambos → **Transition Mode** (vulnerable)

**2. Downgrade attack** (`attack_type: "transition_mode"`)

Explota el modo de transición:
```
1. Atacante se hace pasar por el cliente enviando Association Request con WPA2-PSK
2. El AP acepta (por ser modo transición)
3. Se completa un handshake WPA2 — capturable y crackeable offline
```

**3. SAE DoS** (`attack_type: "sae_dos"`)

Ataque Dragonblood (CVE-2019-9494): el AP puede ser saturado con mensajes SAE Commit malformados, consumiendo todos sus recursos y denegando servicio a clientes legítimos.

### 14.5. Implementación

`wpa3_service.py` usa `hostapd` en modo específico para transmitir paquetes WPA3 malformados o forzar protocolos:

```python
async def attack(self, req: WPA3Request) -> dict:
    if req.attack_type == "detect":
        # Parsear beacons con tshark para detectar RSN IE
        return await self._detect_mode(req)
    elif req.attack_type == "transition_mode":
        # Forzar downgrade
        return await self._downgrade_attack(req)
    elif req.attack_type == "sae_dos":
        # Inyección de SAE Commit malformados
        return await self._sae_dos(req)
```

---

## 15. Módulo: Recon — Reconocimiento con nmap

### 15.1. Propósito

Una vez dentro de la red (conectado a través del Evil Twin, o con credenciales auditadas), reconocimiento interno: identificar dispositivos, servicios expuestos, vulnerabilidades, OS. Este es el puente entre auditoría WiFi y auditoría de red interna.

### 15.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/recon/nmap` | POST | Escaneo nmap con perfil |
| `/recon/nmap/status` | GET | Estado del escaneo en curso |
| `/recon/nmap/stop` | POST | Detener escaneo |
| `/recon/router-probe` | POST | Escaneo rápido del gateway |
| `/recon/arp-sweep` | POST | Descubrir dispositivos en LAN |

### 15.3. Perfiles de nmap

| Perfil | Flags equivalentes | Duración | Propósito |
|---|---|---|---|
| `quick` | `-T4 -F` | <1 min | 100 puertos comunes, rápido |
| `full` | `-p- -T4` | 5-30 min | 65535 puertos TCP |
| `vuln` | `--script vuln` | 10-60 min | Scripts NSE de vulnerabilidades |
| `service` | `-sV -sC` | 3-15 min | Detección de versiones + scripts default |
| `os_detect` | `-O` | 1-5 min | Detección de OS por fingerprinting |
| `stealth` | `-sS -T2` | 10-30 min | SYN scan, más lento, más discreto |
| `udp` | `-sU --top-ports 100` | 20-60 min | UDP scan (lento por naturaleza) |
| `custom` | flags custom | variable | Flags definidos por el usuario |

### 15.4. Request de escaneo

```json
POST /recon/nmap
{
  "target": "192.168.1.0/24",      // IP, hostname, rango CIDR o IP range
  "profile": "service",
  "ports": null,                    // opcional, solo para custom
  "extra_args": [],                 // flags adicionales
  "timeout": 600
}
```

### 15.5. Parseo del output XML

Nmap soporta output XML (`-oX`) que el servicio parsea con `xml.etree.ElementTree` y lo estructura para fácil consumo:

```json
{
  "scan_id": "xyz789",
  "command": "nmap -sV -sC -T4 -oX - 192.168.1.0/24",
  "duration_seconds": 234,
  "hosts": [
    {
      "ip": "192.168.1.1",
      "hostname": "router.local",
      "mac": "aa:bb:cc:dd:ee:ff",
      "vendor": "Cisco Systems",
      "state": "up",
      "latency": 0.003,
      "os": {
        "name": "Cisco IOS 15.x",
        "accuracy": 95
      },
      "ports": [
        {
          "port": 22, "protocol": "tcp", "state": "open",
          "service": "ssh", "version": "OpenSSH 7.9",
          "scripts": {
            "ssh-hostkey": "...",
            "ssh-auth-methods": "password,publickey"
          }
        },
        {
          "port": 80, "protocol": "tcp", "state": "open",
          "service": "http", "version": "Cisco IOS http config"
        }
      ]
    }
  ]
}
```

### 15.6. Router probe (especializado)

`/recon/router-probe` es un shortcut para auditar específicamente el gateway:
- Detecta IP del gateway automáticamente si no se especifica
- Puertos por defecto: 21, 22, 23, 53, 80, 443, 8080, 8443, 1900, 5000
- Detección de servicios
- Búsqueda de credenciales por defecto (opcional)
- Verificación de vulnerabilidades conocidas por marca/modelo

---

## 16. Módulo: MITM — Man-in-the-Middle avanzado

### 16.1. Propósito

Este es el módulo **más complejo y sofisticado** del backend. Permite interceptar y analizar tráfico de red en tiempo real con dos modos de operación diseñados para diferentes escenarios de auditoría.

### 16.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/attacks/mitm/start` | POST | Iniciar MITM (stealth o full) |
| `/attacks/mitm/stop` | POST | Detener y limpiar |
| `/attacks/mitm/status` | GET | Estado actual + contadores |
| `/attacks/mitm/flows` | GET | Consultar flows capturados (con filtros) |
| `/attacks/mitm/ca-cert` | GET | Info del certificado CA + instrucciones |
| `/attacks/mitm/ca-cert/download/{format}` | GET | Descargar CA (pem, cer, p12) |

### 16.3. Dos modos de operación

**🔇 MODO STEALTH (default — invisible al target)**

```
Teléfono → Tu máquina → PASS-THROUGH → Internet
              ↓
        tshark captura:
        • DNS queries (qué dominios resuelve el teléfono)
        • TLS Client Hello SNI (a qué webs HTTPS se conecta)
        • HTTP requests completos (contenido sin cifrar)
```

El teléfono navega **exactamente como normal** — misma velocidad, cero warnings, cero alertas. Tú capturas toda la inteligencia de red (qué visita, cuándo, cuánto volumen) aunque no puedas leer el contenido cifrado.

**🔓 MODO FULL INTERCEPTION (requiere CA cert en el dispositivo)**

```
Teléfono → Tu máquina → mitmproxy DESCIFRA HTTPS → Internet
              ↓
        Logs JSONL con TODO el contenido:
        • Request/response headers completos
        • Body de POST (detección automática de credenciales)
        • Duración, tamaño, status codes
```

Interceptas el contenido completo de HTTPS pero el teléfono mostrará warnings de certificado SSL **salvo que instales la CA de mitmproxy en el dispositivo** (lo que se hace en auditorías reales con consentimiento del cliente).

### 16.4. Arquitectura interna

**Componentes:**

1. **ARP spoofer bidireccional** (arpspoof × 2 por cada target)
2. **IP forwarding** (sysctl + iptables FORWARD/MASQUERADE)
3. **Redirección de tráfico** (iptables NAT REDIRECT):
   - Stealth: solo puerto 80 → mitmproxy
   - Full: puertos 80 + 443 → mitmproxy
4. **mitmproxy** con addon custom (`mitm_addon.py`)
5. **Stealth monitor** (`mitm_stealth_monitor.py` basado en tshark) — solo en modo stealth
6. **tcpdump** para respaldo pcap (siempre activo)

**Diagrama de flujo de datos:**

```
┌──────────┐      ┌──────────────────┐        ┌─────────┐
│ Target   │◄────►│  Atacante (tú)    │◄──────►│ Gateway │
│ WiFi     │ ARP  │                   │  ARP   │         │
└──────────┘ spoof│  ┌──────────────┐ │  spoof └─────────┘
                  │  │ IP forwarding│ │
                  │  │ (kernel)      │ │
                  │  └──────┬───────┘ │
                  │         │          │
                  │   iptables REDIRECT│
                  │  HTTP(80) ────────►│
                  │  HTTPS(443, full) ►│
                  │         ▼          │
                  │  ┌──────────────┐ │
                  │  │  mitmproxy    │ │
                  │  │  + addon JSONL│ │
                  │  └──────────────┘ │
                  │                    │
                  │  (modo stealth)    │
                  │  ┌──────────────┐ │
                  │  │  tshark       │ │
                  │  │  DNS + SNI    │ │
                  │  └──────────────┘ │
                  └──────────────────┘
```

### 16.5. Formato JSONL de los flows

Cada línea del archivo `mitm_<id>_flows.jsonl` es un JSON con un flow capturado:

```json
{
  "id": 42,
  "timestamp": "2026-04-17 12:13:25",
  "ts_epoch": 1776420805.06,
  "client_ip": "192.168.1.98",
  "method": "GET",
  "scheme": "https",
  "host": "www.skyscanner.es",
  "port": 443,
  "path": "/vuelos/madrid-paris",
  "url": "https://www.skyscanner.es/vuelos/madrid-paris",
  "is_https": true,
  "status_code": 200,
  "content_type": "text/html; charset=utf-8",
  "response_size": 98299,
  "request_size": 0,
  "duration_ms": 321.1,
  "type_tag": "HTML",
  "has_credentials": false
}
```

Para flows de modo Stealth (DNS/TLS) el schema es similar pero:
- `method` es "DNS" o "TLS"
- `path` contiene la query/SNI info
- `is_https` refleja el protocolo real

### 16.6. Detección automática de credenciales

El addon de mitmproxy escanea los request bodies de POSTs buscando palabras clave típicas:

```python
cred_keywords = ["password", "passwd", "pass=", "pwd", "token",
                 "auth", "login", "user", "email", "credential"]

if req.method == "POST":
    body = req.content.decode("utf-8", errors="ignore").lower()
    if any(kw in body for kw in cred_keywords):
        entry["has_credentials"] = True
```

Esto permite destacar en la UI los flows sospechosos de contener credenciales (prioritarios para análisis manual).

### 16.7. Cleanup en `stop`

Crítico para no dejar la red rota:

```
1. Matar arpspoof (restaura ARP cache del target en ~60s automáticamente)
2. Matar mitmdump
3. Matar mitm_stealth_monitor
4. Matar tcpdump
5. iptables -t nat -F           # Limpia NAT
6. iptables -F FORWARD          # Limpia forwarding
7. sysctl net.ipv4.ip_forward=0 # Desactiva forwarding
8. arping -A (si está)          # Gratuitous ARP para restaurar más rápido
```

Sin este cleanup, después de parar el MITM la víctima podría quedarse sin internet hasta que su caché ARP expire. Ahora es limpio.

---

## 17. Módulo: Captures — Gestión de archivos

### 17.1. Propósito

Durante una auditoría se generan decenas de archivos: capturas `.cap`, `.pcap`, `.pcapng`, CSVs, hashes `.22000`, logs `.jsonl`, XML de nmap, etc. Este módulo los centraliza con metadatos ricos.

### 17.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/captures` | GET | Listar todos los archivos con metadatos |
| `/captures/{filename}` | GET | Descargar archivo |
| `/captures/{filename}/info` | GET | Metadatos detallados |
| `/captures/{filename}` | DELETE | Eliminar archivo |
| `/captures/cleanup` | POST | Borrar archivos antiguos |

### 17.3. Tipos de archivo reconocidos

| Extensión | Generado por | Usado para |
|---|---|---|
| `.cap` | airodump-ng | Handshakes WPA/WPA2 |
| `.pcap` | tcpdump | Capturas raw completas |
| `.pcapng` | hcxdumptool | PMKID + handshakes |
| `.22000` | hcxpcapngtool | Formato hashcat |
| `.csv` | airodump-ng | Lista de APs/clients |
| `.xml` | nmap | Resultados de escaneo |
| `.json` | sessions | Informes de auditoría |
| `.jsonl` | mitm_addon | Flows MITM |
| `.flow` | mitmproxy | Flows binarios mitmproxy |
| `.txt` | varios | Credenciales, logs |

### 17.4. Metadatos

Cada archivo devuelve:

```json
{
  "filename": "scan_abc123.cap",
  "size_bytes": 2457600,
  "size_human": "2.3 MB",
  "created_at": "2026-04-17T12:13:25",
  "modified_at": "2026-04-17T12:14:10",
  "type": "handshake_capture",
  "color": "#00ff95",
  "icon": "📡",
  "description": "WPA handshake capture — use with aircrack-ng",
  "contains_handshake": true,    // análisis heurístico
  "contains_pmkid": false,
  "ap_bssids": ["aa:bb:cc:dd:ee:ff"],
  "related_session": "audit_2026_04_17"
}
```

### 17.5. Implementación (`capture_service.py`)

La función clave es `analyze_file()` que según la extensión:
- Para `.cap`/`.pcap`: corre `aircrack-ng file.cap` y parsea "X handshake"
- Para `.pcapng`: corre `hcxpcapngtool -o /dev/null file.pcapng` y cuenta PMKIDs
- Para `.csv`: parsea con `utils/parsers.parse_airodump_csv`
- Para `.xml`: parsea con `utils/parsers.parse_nmap_xml`

---

## 18. Módulo: Sessions — Documentación de auditoría

### 18.1. Propósito

Agrupar hallazgos de una auditoría bajo una "sesión" con metadatos (cliente, fecha, scope), severidades, y exportación a formato informe.

### 18.2. Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/sessions` | GET | Listar sesiones |
| `/sessions` | POST | Crear nueva sesión |
| `/sessions/{id}` | GET | Detalles + hallazgos |
| `/sessions/{id}/finding` | POST | Añadir hallazgo |
| `/sessions/{id}/export` | GET | Exportar informe JSON |
| `/sessions/{id}/close` | POST | Cerrar sesión |

### 18.3. Modelo de Finding

```json
{
  "id": "finding_42",
  "session_id": "audit_2026_04_17",
  "severity": "high",   // critical, high, medium, low, info
  "category": "wifi_encryption",
  "title": "Red WiFi con cifrado WEP",
  "description": "El AP 'Legacy_Office' (MAC aa:bb:cc:dd:ee:ff) usa cifrado WEP, roto desde 2001.",
  "evidence": {
    "bssid": "aa:bb:cc:dd:ee:ff",
    "essid": "Legacy_Office",
    "channel": 6,
    "capture_file": "scan_abc123.cap"
  },
  "recommendation": "Migrar inmediatamente a WPA2-PSK (mínimo) o WPA3 (recomendado).",
  "cvss_score": 9.1,
  "discovered_at": "2026-04-17T12:13:25"
}
```

### 18.4. Export de informe

`/sessions/{id}/export?format=json` devuelve:

```json
{
  "session": {
    "id": "audit_2026_04_17",
    "client": "ACME Corp",
    "scope": "Campus principal - 2 edificios",
    "auditor": "Juan Pérez",
    "start_date": "2026-04-17",
    "end_date": "2026-04-18"
  },
  "summary": {
    "total_findings": 12,
    "by_severity": {"critical":2, "high":4, "medium":3, "low":2, "info":1}
  },
  "findings": [...],
  "captures": [...],
  "executive_summary": "..."
}
```

---

## 19. Flujo de trabajo completo paso a paso

Guía paso a paso de una auditoría típica usando todos los módulos:

### Fase 1: Preparación

```
1. GET /system/health
   → Verificar que es root y API está viva
   
2. GET /system/preflight
   → Confirmar que todas las herramientas están instaladas
   
3. POST /sessions
   { "client": "ACME", "scope": "Edificio principal", "auditor": "Juan" }
   → Crear sesión de auditoría (id = "audit_001")
```

### Fase 2: Reconocimiento

```
4. GET /interfaces
   → Identificar interfaces disponibles (wlan0 managed, wlan1 AP-capable)
   
5. POST /interfaces/wlan0/monitor
   → Activar monitor mode en wlan0 (crea wlan0mon)
   
6. POST /wifi/scan
   { "interface": "wlan0mon", "band": "abg", "timeout": 120 }
   → Escaneo dual-band de 2 minutos
   
7. GET /wifi/scan/results
   → Obtener lista de APs y clientes
   
8. GET /wifi/scan/pnl
   → Análisis de PNL (candidatos Evil Twin)
```

### Fase 3: Selección de targets

Análisis manual de resultados. Ejemplo de hallazgos tempranos:
- AP "Legacy" usa WEP → finding crítico
- AP "CorpWiFi" usa WPA2 con WPS activado → candidato a PMKID
- AP "Guest" abierto (no cifrado) → finding alto
- AP "CorpEnterprise" usa WPA2-Enterprise → candidato Rogue RADIUS

### Fase 4: Ataques WPA2

```
9. POST /advanced/pmkid/capture
   { "interface": "wlan0mon", "target_bssid": "aa:bb:cc:dd:ee:ff",
     "channel": 6, "timeout": 60 }
   → Capturar PMKID de "CorpWiFi"
   
10. POST /advanced/pmkid/crack
    { "pmkid_file": "pmkid_xyz.22000", "wordlist": "rockyou.txt" }
    → Crackear. Si encuentra → finding crítico (password weak)

11. Si PMKID falla, POST /wifi/handshake/capture
    { "interface": "wlan0mon", "target_bssid": "...", "deauth": true }
    → Captura handshake tradicional
    
12. POST /wifi/crack
    { "capture_file": "scan.cap", "wordlist": "rockyou.txt" }
```

### Fase 5: Ataque Enterprise (si aplica)

```
13. POST /advanced/enterprise/start
    { "monitor_interface": "wlan0mon", "ap_interface": "wlan1",
      "target_essid": "CorpEnterprise", "channel": 6, "eap_type": "PEAP" }
    → Rogue RADIUS + Evil Twin Enterprise
    
14. Esperar ~5-15 minutos a que clientes se conecten
    
15. POST /advanced/enterprise/stop
    → Obtener credenciales capturadas (usernames + hashes MSCHAPv2)
    
16. hashcat -m 5500 hashes.txt wordlist.txt
```

### Fase 6: Post-acceso — reconocimiento interno

Asumiendo que se ha obtenido acceso a la red (password crackeada o Evil Twin):

```
17. Conectar wlan0 a la red target con credenciales obtenidas
    
18. POST /recon/nmap
    { "target": "192.168.1.0/24", "profile": "service", "timeout": 600 }
    → Descubrir todos los dispositivos y servicios
    
19. POST /recon/router-probe
    → Escaneo específico del gateway
```

### Fase 7: MITM para análisis de tráfico

```
20. Identificar IP de un cliente target (ej. 192.168.1.98) en los resultados
    
21. POST /attacks/mitm/start
    { "interface": "wlan0", "target_ips": ["192.168.1.98"],
      "gateway": "192.168.1.1", "proxy_port": 8080,
      "stealth": true }
    → Iniciar MITM en modo stealth (invisible)
    
22. Esperar mientras el target usa su dispositivo
    
23. GET /attacks/mitm/flows?limit=200
    → Analizar qué dominios visita, qué APIs consume
    
24. GET /attacks/mitm/flows?credentials_only=true
    → Filtrar flows con credenciales detectadas
    
25. POST /attacks/mitm/stop
    → Cierra limpiamente, restaura red
```

### Fase 8: Reporting

```
26. Para cada hallazgo, POST /sessions/audit_001/finding
    { "severity": "critical", "title": "...", "description": "...",
      "recommendation": "..." }
    
27. GET /sessions/audit_001/export?format=json
    → Descargar informe final estructurado
    
28. POST /sessions/audit_001/close
    → Marcar sesión como finalizada
```

---

## 20. Referencia completa de endpoints

Listado exhaustivo de los 62 endpoints del backend.

### System

```
GET    /system/health
GET    /system/preflight
GET    /system/info
GET    /system/processes
POST   /system/processes/{id}/kill
```

### Interfaces

```
GET    /interfaces
GET    /interfaces/{name}
GET    /interfaces/{name}/channels
POST   /interfaces/{name}/monitor
POST   /interfaces/{name}/managed
POST   /interfaces/{name}/channel
POST   /interfaces/{name}/macchange
```

### WiFi Scan

```
POST   /wifi/scan
GET    /wifi/scan/status
POST   /wifi/scan/stop
GET    /wifi/scan/results
GET    /wifi/scan/pnl
POST   /wifi/handshake/capture
POST   /wifi/handshake/verify
POST   /wifi/crack
POST   /wifi/deauth
```

### Advanced

```
POST   /advanced/pmkid/capture
POST   /advanced/pmkid/crack
POST   /advanced/apless/start
POST   /advanced/apless/stop
GET    /advanced/apless/status
POST   /advanced/enterprise/start
POST   /advanced/enterprise/stop
GET    /advanced/enterprise/status
POST   /advanced/wpa3/detect
POST   /advanced/wpa3/attack
```

### Attacks

```
POST   /attacks/evil-twin/start
POST   /attacks/evil-twin/stop
GET    /attacks/evil-twin/status
POST   /attacks/mitm/start
POST   /attacks/mitm/stop
GET    /attacks/mitm/status
GET    /attacks/mitm/flows
GET    /attacks/mitm/ca-cert
GET    /attacks/mitm/ca-cert/download/{format}
```

### Recon

```
POST   /recon/nmap
GET    /recon/nmap/status
POST   /recon/nmap/stop
POST   /recon/router-probe
POST   /recon/arp-sweep
```

### Captures

```
GET    /captures
GET    /captures/{filename}
GET    /captures/{filename}/info
DELETE /captures/{filename}
POST   /captures/cleanup
```

### Sessions

```
GET    /sessions
POST   /sessions
GET    /sessions/{id}
POST   /sessions/{id}/finding
GET    /sessions/{id}/export
POST   /sessions/{id}/close
DELETE /sessions/{id}
```

**Total: 62 endpoints**

La documentación interactiva Swagger con schemas completos y posibilidad de probar cada endpoint está disponible en `http://localhost:8000/docs`.

---

## 21. Modelos de datos (schemas)

Los modelos Pydantic están definidos en `app/models/schemas.py`. Son **50+ schemas** que cubren todos los requests y responses.

### 21.1. Enums principales

```python
class InterfaceMode(str, Enum):
    MANAGED = "managed"
    MONITOR = "monitor"

class SecurityType(str, Enum):
    OPEN = "open"
    WEP = "wep"
    WPA = "wpa"
    WPA2 = "wpa2"
    WPA3 = "wpa3"
    WPA2_ENTERPRISE = "wpa2_enterprise"
    WPA3_ENTERPRISE = "wpa3_enterprise"
    UNKNOWN = "unknown"

class WifiBand(str, Enum):
    BAND_2GHZ = "bg"
    BAND_5GHZ = "a"
    BAND_DUAL = "abg"

class NmapScanType(str, Enum):
    QUICK = "quick"
    FULL = "full"
    VULN = "vuln"
    OS_DETECT = "os_detect"
    SERVICE = "service"
    STEALTH = "stealth"
    UDP = "udp"
    CUSTOM = "custom"

class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"
```

### 21.2. Requests principales

**WifiScanRequest:**
```python
class WifiScanRequest(BaseModel):
    interface: str
    band: WifiBand = WifiBand.BAND_DUAL
    timeout: int = 60
    channel: Optional[int] = None
    target_bssid: Optional[str] = None
```

**HandshakeCaptureRequest:**
```python
class HandshakeCaptureRequest(BaseModel):
    interface: str
    target_bssid: str
    channel: int
    timeout: int = 120
    deauth: bool = True
    deauth_target_client: Optional[str] = None
    deauth_packets: int = 50
```

**MitmRequest:**
```python
class MitmRequest(BaseModel):
    interface: str
    target_ips: list[str] = []
    gateway: str
    proxy_port: int = 8080
    stealth: bool = True
    ssl_strip: bool = False
    capture_credentials: bool = True
    filter_hosts: list[str] = []
```

**NmapRequest:**
```python
class NmapRequest(BaseModel):
    target: str
    profile: NmapScanType = NmapScanType.QUICK
    ports: Optional[str] = None
    extra_args: list[str] = []
    timeout: int = 300
```

### 21.3. Responses estructurados

Los responses son diccionarios JSON sin validación estricta (retornados como `dict` desde los servicios, no como modelos Pydantic), lo que da flexibilidad para añadir campos sin romper clientes.

Esquemas recomendados para respuestas (a nivel documentación):

**AccessPoint:**
```
bssid: string (MAC)
essid: string | null (null si es oculto)
channel: int
power: int (dBm, negativo)
beacons: int
data_packets: int
encryption: SecurityType
cipher: string ("CCMP", "TKIP", "AES")
authentication: string ("PSK", "EAP", "SAE", "OPEN")
wps: bool
pmkid_available: bool
vendor: string (del OUI lookup)
first_seen: ISO8601
last_seen: ISO8601
associated_clients: array of Client
```

**Client:**
```
mac: string
power: int
vendor: string | null
probed_essids: array of string
is_randomized: bool
```

---

## 22. Configuración avanzada

### 22.1. Ajustes del archivo `config.py`

El archivo `app/config.py` define la configuración del backend con Pydantic Settings:

```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # API
    APP_NAME: str = "WFAudit"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Network
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Paths
    BASE_DIR: Path = Path(__file__).parent.parent
    CAPTURES_DIR: Path = BASE_DIR / "captures"
    LOGS_DIR: Path = BASE_DIR / "logs"
    WORDLISTS_DIR: Path = Path("/usr/share/wordlists")
    
    # Timeouts (segundos)
    DEFAULT_SCAN_TIMEOUT: int = 60
    DEFAULT_HANDSHAKE_TIMEOUT: int = 120
    DEFAULT_CRACK_TIMEOUT: int = 3600
    
    # Seguridad
    API_KEY: Optional[str] = None           # si se setea, requiere auth
    CORS_ORIGINS: list[str] = ["*"]         # producción: restringir
    
    # mitmproxy
    MITMPROXY_CA_DIR: Path = Path.home() / ".mitmproxy"
    
    class Config:
        env_prefix = "WFAUDIT_"
        env_file = ".env"

settings = Settings()
```

### 22.2. Tuning de rendimiento

**Para escaneos largos**, ajustar el `DEFAULT_SCAN_TIMEOUT` según disponibilidad. Un escaneo de 300s captura ~99% de redes visibles pero es lento si solo quieres reconocimiento rápido.

**Para cracking**, `DEFAULT_CRACK_TIMEOUT=3600` (1 hora) es razonable para diccionarios medianos. Para `rockyou.txt` (14M palabras) en CPU aircrack-ng puede tardar más — subir a 14400 (4 horas) o usar hashcat con GPU.

**Subprocesos paralelos:** `process_manager.py` permite N procesos concurrentes (por defecto no limita). Si tienes sistema modesto y quieres limitar memoria, añadir `semaphore = asyncio.Semaphore(5)` antes de lanzar subprocesos.

### 22.3. Logging

FastAPI usa `logging` estándar de Python. Configuración recomendada para producción en `main.py`:

```python
import logging
from logging.handlers import RotatingFileHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        RotatingFileHandler(
            "logs/backend.log",
            maxBytes=10*1024*1024,
            backupCount=5
        )
    ]
)
```

### 22.4. Autenticación API

Para entornos expuestos en red (no solo localhost), añadir middleware de API key:

```python
# app/main.py
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if settings.API_KEY:
        token = request.headers.get("X-API-Key")
        if token != settings.API_KEY:
            return JSONResponse(
                {"error": "Unauthorized"}, status_code=401
            )
    return await call_next(request)
```

Luego el frontend debe enviar el header en cada request:
```js
fetch("/api/wifi/scan", {
  headers: {"X-API-Key": "tu-secreto"}
});
```

### 22.5. CORS

Por defecto el backend acepta CORS de cualquier origen (`*`). Para producción **restringir explícitamente**:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,   # ["http://localhost:5173", "http://192.168.1.10:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 23. Troubleshooting detallado

### 23.1. "Operation not permitted" / errores de root

**Causa:** El backend no está corriendo como root.

**Solución:**
```bash
sudo uvicorn app.main:app --host 0.0.0.0 --port 8000
# o
sudo ./wfaudit start
```

Verifica con:
```bash
curl http://localhost:8000/system/health
# debe devolver "root": true
```

### 23.2. "Interface wlan0 not in monitor mode"

**Causa:** La interfaz está en modo managed.

**Solución manual:**
```bash
sudo airmon-ng check kill
sudo airmon-ng start wlan0
# Crea wlan0mon, usa ese como interface en los requests
```

**Solución API:**
```
POST /interfaces/wlan0/monitor
```

### 23.3. "Monitor created but no packets captured"

**Causa:** El driver de tu adaptador WiFi no soporta packet capture real o inyección. Muy común con adaptadores integrados (Intel, Broadcom).

**Solución:** Usar un adaptador USB externo con chipset compatible. Ver sección 3.2.

### 23.4. airodump-ng no muestra redes 5 GHz

**Causa 1:** Tu adaptador solo soporta 2.4 GHz.
**Causa 2:** Estás escaneando solo banda "bg".

**Solución:**
```json
POST /wifi/scan
{ "band": "abg", ... }  // o "a" solo para 5 GHz
```

Verifica capacidades del adaptador:
```
GET /interfaces/wlan0
# campo supported_bands debe incluir "5 GHz"
```

### 23.5. Handshake no se captura

**Causa 1:** No hay clientes conectados al AP.
**Solución:** Usa PMKID en su lugar.

**Causa 2:** El cliente está fuera del alcance o deauth no le llega.
**Solución:** Acercarse, usar antena direccional, o aumentar `deauth_packets`.

**Causa 3:** El AP usa PMF (Protected Management Frames, 802.11w) que hace los deauths ineficaces.
**Solución:** PMKID si el AP es vulnerable, o AP-less si tiene probes.

**Causa 4:** El cliente tiene roaming agresivo y se cambia a otro canal.
**Solución:** Verificar el canal del AP, fijar tu adaptador a ese canal con `/interfaces/{name}/channel`.

### 23.6. Cracking encuentra 0 passwords con un buen diccionario

**Causa 1:** El handshake capturado no es completo o está corrupto.
**Verificar:**
```
POST /wifi/handshake/verify
{ "capture_file": "scan.cap" }
```

**Causa 2:** La contraseña no está en el diccionario.
**Solución:** Probar diccionarios más grandes (`rockyou.txt` tiene 14M, pero hay de 100M+).

**Causa 3:** Hashcat format incorrecto.
**Solución:** Para formato modern (2022+) usar modo `22000`, no `2500` (obsoleto).

### 23.7. Evil Twin no aparece en dispositivos cercanos

**Causa 1:** hostapd falló al arrancar.
**Verificar logs:** `journalctl -u hostapd` o logs del backend.

**Causa 2:** El adaptador no soporta AP mode.
**Verificar:** `iw list | grep "AP"` — debe mostrar AP en supported modes.

**Causa 3:** Interferencia en el canal elegido.
**Solución:** Cambiar a canal 1, 6 u 11 (2.4 GHz) o 36, 40, 44, 48 (5 GHz).

### 23.8. MITM no captura flows

**Caso clásico ya resuelto en v5:** mitmproxy crasheaba silenciosamente por opciones incompatibles.

**Diagnóstico:**
```
GET /attacks/mitm/status
# Verificar:
# - active: true
# - mitm_listening: true      ← CRÍTICO
# - total_flows: > 0 tras navegar en target
```

Si `mitm_listening: false`, mitmproxy murió. Ejecutar manualmente para ver el error:
```bash
sudo mitmdump --mode transparent --listen-port 8080 --ssl-insecure
```

**Otra causa:** iptables REDIRECT no se aplicó.
**Verificar:**
```bash
sudo iptables -t nat -L -v
# Debe haber reglas PREROUTING con -j REDIRECT --to-port 8080
```

### 23.9. MITM activo pero target no navega

**Causa:** ARP spoof funciona pero forwarding está roto.
**Verificar:**
```bash
# 1. IP forwarding activado
cat /proc/sys/net/ipv4/ip_forward    # debe ser 1

# 2. Reglas FORWARD
sudo iptables -L FORWARD -v           # ACCEPT en ambas direcciones

# 3. NAT masquerade
sudo iptables -t nat -L POSTROUTING   # MASQUERADE presente
```

Si falta algo, reiniciar el MITM.

### 23.10. Stealth MITM no captura DNS/TLS

**Causa:** tshark no está instalado.
**Solución:**
```bash
sudo apt install tshark
# Durante instalación, aceptar "Should non-superusers be able to capture packets?" = Yes
```

### 23.11. Nmap muy lento

**Causa:** Perfil `full` escanea 65535 puertos + `-T4` puede ser demasiado rápido para algunas redes.

**Soluciones:**
- Usar perfil `quick` primero (100 puertos) → luego `full` solo sobre IPs interesantes
- Reducir target: `192.168.1.0/24` en vez de `0.0.0.0/0`
- Aumentar timeout del request

### 23.12. Procesos zombis tras `stop`

**Síntoma:** Tras hacer stop, `ps aux | grep airodump` o `grep mitmdump` sigue mostrando procesos.

**Solución:**
```bash
sudo pkill -9 airodump-ng aireplay-ng hcxdumptool hostapd dnsmasq arpspoof mitmdump tcpdump
sudo ./wfaudit restart
```

Y luego reiniciar el backend limpio.

---

## 24. Preguntas frecuentes (FAQ)

**P: ¿Puedo usar WFAudit sin ser root?**
R: No. Todas las operaciones de auditoría WiFi requieren privilegios root (monitor mode, raw sockets, iptables, modificación de rutas). Usa `sudo`.

**P: ¿Funciona en WSL (Windows Subsystem for Linux)?**
R: No. WSL no tiene acceso al hardware WiFi. Necesitas Linux nativo o dual-boot.

**P: ¿Puedo atacar redes 5G/móvil?**
R: No. WFAudit es exclusivamente para WiFi (802.11). Para redes móviles se usan SDRs + software como gqrx, Osmocom, YateBTS.

**P: ¿Cómo de detectable es el MITM en modo Stealth?**
R: A nivel wireless: los ARP spoofs son detectables por IDS que vigilen ARP anomalies (Suricata, Arpwatch). A nivel target: **indetectable para el usuario normal** — no hay warnings, velocidad normal.

**P: ¿Puedo automatizar todo con scripts?**
R: Sí. El backend es una API REST estándar. Cualquier script que pueda hacer HTTP (bash+curl, Python+requests, Go+net/http) puede orquestarlo. Ver scripts de ejemplo en `/examples/`.

**P: ¿Hashcat necesita GPU?**
R: Funciona con CPU pero es 100-1000x más lento. Para diccionarios medianos (1M+) una GPU es prácticamente imprescindible. NVIDIA RTX 3060+ o RX 6600+ son suficientes.

**P: ¿El backend funciona con Python 3.9 / 3.10?**
R: Recomendado Python 3.11+. Usa algunas features (union types con `|`, dict merging) que no existen en 3.9.

**P: ¿Puedo añadir autenticación LDAP/OAuth?**
R: Sí, FastAPI tiene integración con `python-jose` (JWT), `authlib` (OAuth), `ldap3`. Modifica `main.py` con tu middleware preferido.

**P: ¿Guarda la base de datos algo?**
R: No hay BD por defecto. Todo está en archivos planos (captures/, logs/, sessions JSON). Para producción seria se puede añadir SQLAlchemy + PostgreSQL con `async`.

**P: ¿Cómo escalo a múltiples auditores simultáneos?**
R: El backend es stateful (sesiones activas en memoria). Para múltiples usuarios: o bien una instancia por auditor, o refactorizar `services` para persistir estado en Redis/DB.

**P: ¿El modo Stealth realmente es 100% invisible?**
R: Visualmente sí (ni warnings ni lentitud). Pero a nivel red un admin atento puede notar:
- ARP anomalies (la MAC del gateway cambia de repente)
- Aumento de tráfico en la interfaz del atacante
- Su dispositivo hace MUCHAS peticiones DNS al mismo tiempo (visible en DNS logs del router)
- Aumento de ~10-20ms en ping al gateway

En un entorno corporativo con IDS/monitorización, estos signs son detectables.

---

## 25. Glosario técnico

**AKM** (Authentication and Key Management) — Suite de autenticación en 802.11 RSN. Ejemplos: PSK, EAP, SAE.

**ARP** (Address Resolution Protocol) — Mapea IP a MAC en redes locales. Stateless, sin autenticación, vulnerable a spoofing.

**BSSID** — Basic Service Set Identifier. Es la MAC del Access Point. 6 bytes (aa:bb:cc:dd:ee:ff).

**CA** (Certificate Authority) — Entidad que firma certificados SSL/TLS. Los navegadores confían en CAs específicas preinstaladas.

**CCMP** — Counter Mode CBC-MAC Protocol. Cifrado de WPA2 basado en AES.

**Deauth** — Frame 802.11 que fuerza a un cliente a desconectarse. No autenticado, fácilmente spoofable (salvo con 802.11w/PMF).

**EAP** (Extensible Authentication Protocol) — Framework para 802.1X. Variantes: PEAP, TTLS, TLS, FAST.

**EAPOL** — EAP over LAN. Protocolo para transportar mensajes EAP/handshake a nivel LAN.

**ESSID** — Extended SSID. Es el nombre "legible" de una red WiFi ("CorpWiFi", "Starbucks Guest").

**Evil Twin** — AP falso que impersona a uno legítimo.

**Handshake** — En WPA/WPA2, el intercambio de 4 mensajes EAPOL entre AP y cliente durante la conexión.

**hostapd** — Daemon de Linux que convierte una interface en modo AP.

**ICMP** — Internet Control Message Protocol. Lo que usa `ping`. También aparece como respuesta a paquetes a puertos cerrados ("Port Unreachable").

**IV** — Initialization Vector. En WEP, 24 bits usados en cifrado RC4. Débil porque se repite.

**KARMA** — Ataque clásico de KARMA (2004): responder sí a todos los probes WiFi, haciendo que dispositivos se conecten automáticamente. Dispositivos modernos han mitigado esto.

**MIC** — Message Integrity Check. Checksum autenticado en frames WPA.

**mitmproxy** — Proxy HTTP/HTTPS que permite interceptar, modificar y visualizar tráfico en tiempo real.

**Monitor mode** — Modo de adaptador WiFi donde captura todos los paquetes 802.11 en el aire (no solo los dirigidos a su MAC).

**OUI** — Organizationally Unique Identifier. Primeros 3 bytes de una MAC, identifican al fabricante.

**PBKDF2** — Password-Based Key Derivation Function 2. Algoritmo usado en WPA2 para derivar la PMK.

**PMF** (Protected Management Frames) — 802.11w. Autentica frames de management (beacons, deauths) para prevenir spoofing. Obligatorio en WPA3.

**PMK** — Pairwise Master Key. Clave derivada de la passphrase + SSID en WPA/WPA2.

**PMKID** — Hash incluido opcionalmente en el EAPOL M1, que permite crackear la PMK sin completar el handshake.

**PMKSA** — PMK Security Association. Caché para fast roaming.

**PNL** (Preferred Network List) — Lista de redes guardadas en un dispositivo.

**Probe Request/Response** — Frames 802.11 usados para descubrir redes.

**PSK** (Pre-Shared Key) — Modo de WPA/WPA2 con contraseña compartida.

**PTK** — Pairwise Transient Key. Clave derivada del PMK + nonces que se usa para cifrar el tráfico unicast.

**RADIUS** — Remote Authentication Dial-In User Service. Servidor de autenticación usado en WPA2-Enterprise.

**RSN** — Robust Security Network. Término oficial para "WPA2-style security" en 802.11.

**SAE** (Simultaneous Authentication of Equals) — Handshake de WPA3. También llamado "Dragonfly". Resistente a ataques de diccionario offline.

**SNI** (Server Name Indication) — Extensión TLS que indica el hostname en el Client Hello (visible en texto plano).

**SSID** — Alias de ESSID, uso informal.

**TKIP** — Temporal Key Integrity Protocol. Cifrado de WPA (basado en RC4). Deprecado.

**WPS** (WiFi Protected Setup) — Protocolo de setup con PIN de 8 dígitos. Vulnerable a brute force (reaver, bully).

---

## 26. Bibliografía y referencias

### Especificaciones técnicas (RFCs e IEEE)

- **IEEE 802.11-2020** — Base estándar WiFi.
- **IEEE 802.11i-2004** — WPA2 / RSN / CCMP.
- **IEEE 802.11w-2009** — Protected Management Frames.
- **IEEE 802.1X-2020** — Port-Based Network Access Control.
- **RFC 3748** — Extensible Authentication Protocol (EAP).
- **RFC 4764** — EAP Pre-Shared Key.
- **RFC 5216** — EAP-TLS.
- **RFC 5247** — EAP Key Management Framework.
- **RFC 6066** — TLS Extensions (SNI).
- **RFC 7170** — TEAP (Tunnel EAP).
- **RFC 8110** — Opportunistic Wireless Encryption.
- **RFC 8446** — TLS 1.3.
- **RFC 9180** — Hybrid Public Key Encryption (ECH).

### Papers y publicaciones

- Fluhrer, Mantin, Shamir. *"Weaknesses in the Key Scheduling Algorithm of RC4"* (2001). Ataque contra WEP.
- Tews, Weinmann, Pyshkin. *"Breaking 104 bit WEP in less than 60 seconds"* (2007).
- Steube, Jens. *"Attack on WPA/WPA2 using PMKID"* (2018). Hashcat Forum.
- Vanhoef, Piessens. *"Dragonblood: A Security Analysis of WPA3's SAE Handshake"* (2019).
- Vanhoef, Piessens. *"Key Reinstallation Attacks: Forcing Nonce Reuse in WPA2"* (KRACK, 2017).

### Herramientas y documentación

- **aircrack-ng** — https://aircrack-ng.org
- **hashcat** — https://hashcat.net/wiki/
- **mitmproxy** — https://docs.mitmproxy.org
- **hcxdumptool** — https://github.com/ZerBea/hcxdumptool
- **nmap** — https://nmap.org/book/
- **FastAPI** — https://fastapi.tiangolo.com

### Libros recomendados

- *"Hacking Exposed Wireless"* (Cache, Liu, Wright) — Referencia clásica.
- *"The Hacker Playbook 3"* (Peter Kim) — Metodología de pentesting.
- *"Network Security Assessment"* (Chris McNab) — Reconocimiento de red.

### Recursos legales

- **España**: Ley Orgánica 10/1995 del Código Penal (Artículos 197, 264).
- **UE**: Directiva 2013/40/UE sobre ataques contra sistemas de información.
- **USA**: Computer Fraud and Abuse Act (18 U.S.C. § 1030).

---

## Notas finales

Este README ha cubierto el backend de WFAudit en profundidad — desde los fundamentos teóricos de la seguridad WiFi hasta la arquitectura del código, los 62 endpoints, los flujos de trabajo completos, la configuración avanzada y la resolución de problemas.

**Contribuciones:** Si encuentras un bug, tienes una feature request o quieres contribuir código, abre un issue o PR en el repositorio.

**Licencia:** Este proyecto está distribuido con fines educativos y de auditoría legítima. Revisa el archivo LICENSE.

**Responsabilidad:** El autor no se hace responsable del uso indebido de esta herramienta. El atacante es legalmente responsable de verificar que tiene autorización explícita por escrito antes de ejecutar cualquier ataque contra una red.

---

*Generado para el proyecto WFAudit. Última actualización: 2026*
