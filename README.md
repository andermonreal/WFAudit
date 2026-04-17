# WFAudit — Management Script

Script de gestión del proyecto WFAudit que automatiza la instalación, despliegue y control de la plataforma de auditoría WiFi.

## Instalación

**Requisitos previos:** Sistema Linux (Kali / Debian / Ubuntu / Arch / Fedora) con acceso root.

```bash
# Hacer el script ejecutable (solo la primera vez)
chmod +x wfaudit

# Instalación completa (root obligatorio)
sudo ./wfaudit install
```

El comando `install` ejecuta automáticamente:

1. **Paquetes del sistema** — Instala ~25 herramientas necesarias: aircrack-ng, nmap, hostapd, mitmproxy, tshark, hcxdumptool, hashcat, arpspoof, etc. Detecta la distribución automáticamente y usa `apt`, `pacman` o `dnf` según corresponda.
2. **Entorno Python** — Crea un `.venv` en la raíz del proyecto, instala todas las dependencias listadas en `backend/requirements.txt`. Como el backend corre como root pero el usuario normal también debe poder leer el venv, el script ajusta automáticamente los permisos para el usuario que invocó `sudo`.
3. **Node.js + npm** — Si Node no está instalado, lo descarga vía NodeSource (versión 20.x). Luego ejecuta `npm install` en el directorio frontend como el usuario no-root.
4. **Certificado CA de mitmproxy** — Ejecuta mitmdump brevemente para generar el certificado CA que se usará en el modo Full Interception del módulo MITM.

## Comandos disponibles

### `sudo ./wfaudit install`

Instalación completa. Idempotente — se puede ejecutar varias veces sin problema, saltará los paquetes ya instalados.

### `sudo ./wfaudit start`

Arranca backend y frontend en background. Verifica que ambos servicios respondan antes de confirmar. Los procesos quedan registrados en `.pids/backend.pid` y `.pids/frontend.pid`.

- Backend: http://localhost:8000 (API + docs en /docs)
- Frontend: http://localhost:5173 (interfaz web)

Si alguno de los servicios ya está corriendo, avisa y sale sin duplicar procesos.

### `sudo ./wfaudit stop`

Detiene todos los servicios de forma ordenada:

1. Mata el proceso frontend (PID registrado + cualquier vite residual)
2. Mata el proceso backend (uvicorn)
3. **Limpia procesos de ataques que pudieran haber quedado activos**: arpspoof, mitmdump, mitm_stealth_monitor, hostapd
4. **Restaura el estado de red**: flush de iptables (NAT + FORWARD) y desactiva IP forwarding

Este último paso es crítico — asegura que si tenías un MITM o Evil Twin activo, la máquina vuelve a su estado normal de red al parar.

### `./wfaudit status`

Muestra el estado de los servicios sin requerir root:

- Estado de backend y frontend (running/stopped + PID + URL)
- Health check del endpoint `/system/health`
- Detecta si hay MITM o Evil Twin activos

### `./wfaudit logs`

Tail en tiempo real de `logs/backend.log` y `logs/frontend.log`. Si tienes `multitail` instalado, los muestra en dos paneles separados.

### `sudo ./wfaudit clean`

Reset completo. Tras pedir confirmación, elimina `.venv`, `node_modules`, `logs/` y `.pids/`. Útil cuando quieres hacer una reinstalación limpia o liberar espacio.

### `sudo ./wfaudit restart`

Equivale a `stop` seguido de `start`.

### `./wfaudit help`

Muestra la ayuda con todos los comandos y ejemplos.

## Variables de entorno

Puedes personalizar puertos y host antes de ejecutar el script:

| Variable | Default | Descripción |
|---|---|---|
| `WFAUDIT_HOST` | `0.0.0.0` | Host en el que escucha el backend |
| `WFAUDIT_PORT` | `8000` | Puerto del backend FastAPI |
| `WFAUDIT_FRONTEND_PORT` | `5173` | Puerto del frontend Vite |

Ejemplo:

```bash
WFAUDIT_PORT=9000 WFAUDIT_FRONTEND_PORT=3000 sudo ./wfaudit start
```

## Flujo típico de uso

```bash
# Primera vez — instalar todo
sudo ./wfaudit install

# Arrancar la plataforma
sudo ./wfaudit start

# Ver logs en tiempo real (en otra terminal)
./wfaudit logs

# Abrir http://localhost:5173 en el navegador y usar la aplicación

# Al terminar — parar todo y limpiar iptables
sudo ./wfaudit stop
```

## ¿Por qué root?

Las operaciones de auditoría WiFi requieren permisos root porque necesitan:

- Poner adaptadores WiFi en modo monitor (`airmon-ng`)
- Inyectar paquetes (`aireplay-ng`, `arpspoof`)
- Modificar iptables y rutas del kernel
- Escuchar tráfico de red raw (`tcpdump`, `tshark`)
- Enlazar puertos privilegiados

El script siempre indica claramente qué comandos requieren root y cuáles no (`status`, `logs`, `help` funcionan sin sudo).

## Archivos generados por el script

```
wfaudit-project/
├── .venv/              ← Python virtual environment (install)
├── logs/
│   ├── backend.log     ← stdout/stderr del backend (start)
│   └── frontend.log    ← stdout/stderr del frontend (start)
└── .pids/
    ├── backend.pid     ← PID del backend en ejecución (start)
    └── frontend.pid    ← PID del frontend en ejecución (start)
```

## Troubleshooting

**"Backend failed to start"** — Revisa `logs/backend.log`. Lo más común es que falten dependencias Python o que el puerto 8000 esté ocupado.

**"Frontend may not be ready yet"** — Vite a veces tarda más de 20 segundos en compilar por primera vez. Mira `logs/frontend.log` y accede directamente a http://localhost:5173 después de unos segundos.

**"Virtual environment not found"** — Ejecuta `sudo ./wfaudit install` primero.

**Los comandos de ataque no funcionan** — Verifica que todas las herramientas estén instaladas con el endpoint `/system/preflight` del backend, o vuelve a ejecutar `sudo ./wfaudit install`.

**Después de parar, la red no funciona bien** — El comando `stop` limpia iptables y el ARP spoof. Si algo queda colgado, un `sudo reboot` restaura todo.

## Aviso legal

Esta herramienta está diseñada para auditorías de seguridad autorizadas. El uso contra redes sin autorización explícita del propietario constituye un delito informático en la mayoría de jurisdicciones. El autor no se hace responsable del uso indebido.
