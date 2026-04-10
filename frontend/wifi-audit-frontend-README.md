# WFAudit — Frontend

Interfaz gráfica para el backend de auditoría WiFi. Dashboard cyberpunk con tema oscuro/claro, 9 secciones y documentación integrada.

> ⚠️ **Solo para uso autorizado bajo contrato de auditoría.**

---

## Características

| Característica | Descripción |
|---|---|
| **Tema oscuro/claro** | Toggle en la barra lateral. Oscuro = cyberpunk terminal; claro = profesional |
| **9 páginas** | System, Interfaces, WiFi Scan, Handshake & Crack, Recon, Attacks, Sessions, Processes, Help |
| **100% funcional** | Cada botón llama a un endpoint real del backend |
| **Help integrada** | 12 secciones de documentación con glosario, flujo de trabajo y troubleshooting |
| **Responsive** | Sidebar colapsable, grids adaptables |
| **Reloj en vivo** | Hora actual en la barra lateral |
| **Auto-refresh** | Procesos se actualiza cada 5s |

---

## Requisitos

- Backend corriendo en `http://localhost:8000`
- Navegador moderno

## Configuración

```javascript
const API_BASE = "http://localhost:8000"; // Cambiar si el backend está en otro host
```

---

## Páginas

### ◉ System
Preflight check: root, herramientas instaladas, OS. Indicadores verde/rojo.

### ⚡ Interfaces
Listar tarjetas WiFi, activar/desactivar modo monitor, cambiar MAC (aleatorio o manual). Log de operaciones.

### 📡 WiFi Scanner
Escaneo con airodump-ng. Tabla de APs: ESSID, BSSID, canal, señal (coloreada), seguridad, WPS, clientes. Detalle por AP. Historial de escaneos.

### 🔓 Handshake & Crack
Dos paneles: captura de handshake (con deauth opcional) + cracking con wordlist. Herramienta deauth independiente abajo.

### 🔍 Recon
Nmap con 8 perfiles (Quick, Full, Vuln, OS, Service, Stealth, UDP, Custom). Tabla de hosts con Deep/Vuln por host. Router Probe (CTF) para sondear puertos del gateway.

### ⚔ Attacks
Evil Twin (hostapd+dnsmasq) y MITM (arpspoof+mitmproxy). Controles start/stop con estado en vivo.

### 📋 Sessions
Crear sesiones, registrar hallazgos (categoría, severidad, evidencia, recomendación), exportar informe.

### ▣ Processes
Monitor de subprocesos con auto-refresh. Kill de procesos colgados.

### ? Help
12 secciones: visión general, requisitos, cada página explicada, flujo completo paso a paso, troubleshooting y glosario de términos. Permite que cualquier persona use la herramienta sin conocimientos previos.

---

## Temas

| | Oscuro | Claro |
|---|---|---|
| Fondo | #080b10 | #f0f2f5 |
| Tarjetas | #0d1117 | #ffffff + sombra |
| Acento | Cyan #0ff | Azul #0077b6 |
| Sidebar | Oscura siempre | Oscura siempre |
| Terminal | Verde/negro | Verde/azul oscuro |

Toggle: ☀/☾ en sidebar o topbar (sidebar colapsada).

---

## Estructura

Archivo único React (.jsx):
- **ThemeContext** — Temas con React Context y 2 paletas completas
- **Componentes** — GlitchText, TerminalLog, Badge, Btn, Input, Select, Card, DataTable, Stat, Checkbox
- **9 páginas** — Un componente por sección
- **Help** — Markdown renderer con negritas, bullets, código, numeración
- **App** — Router, sidebar colapsable, topbar con terminal prompt, reloj
