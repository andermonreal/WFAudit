import os
import shutil
from fastapi import APIRouter
from app.config import settings
from app.utils.tool_checker import check_tools, check_tools_by_category, check_root, get_system_info
from app.utils.process_manager import process_manager
from app.utils.oui_lookup import lookup_manufacturer, download_oui_db

router = APIRouter(prefix="/system", tags=["System"])

_DATA_DIRS = [
    settings.DATA_DIR, settings.CAPTURES_DIR, settings.REPORTS_DIR,
    settings.HANDSHAKES_DIR, settings.PMKID_DIR, settings.WORDLISTS_DIR,
    settings.LOGS_DIR, settings.HOSTAPD_DIR, settings.ENTERPRISE_DIR,
    settings.EVIDENCE_DIR, settings.RECON_DIR,
]


def _dir_size(path) -> int:
    total = 0
    try:
        for root, _dirs, files in os.walk(path):
            for f in files:
                try:
                    total += os.path.getsize(os.path.join(root, f))
                except OSError:
                    pass
    except OSError:
        pass
    return total

@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/auth-status")
async def auth_status():
    """Indica si el backend exige token de acceso (endpoint sin autenticación,
    para que el frontend sepa si debe pedir el token antes de tenerlo)."""
    return {"require_auth": settings.REQUIRE_AUTH}

@router.get("/info")
async def system_info():
    return await get_system_info()

@router.get("/tools")
async def check_required_tools():
    return await check_tools()

@router.get("/tools/categories")
async def tools_by_category():
    return await check_tools_by_category()

@router.get("/preflight")
async def preflight_check():
    info = await get_system_info()
    tools = await check_tools()
    missing_critical = [n for n, t in tools.items() if t["critical"] and not t["installed"]]
    return {
        "system": info, "tools": tools, "ready": len(missing_critical) == 0 and info["is_root"],
        "missing_critical": missing_critical,
        "warnings": [] if info["is_root"] else ["Not running as root — most operations will fail"],
    }

@router.get("/processes")
async def list_processes():
    return [{"id": p.id, "command": " ".join(p.command), "status": p.status, "started_at": p.started_at, "finished_at": p.finished_at, "return_code": p.return_code} for p in process_manager.list_all()]

@router.post("/processes/{proc_id}/cancel")
async def cancel_process(proc_id: str):
    return {"cancelled": await process_manager.cancel(proc_id)}

@router.get("/oui/{mac}")
async def oui_lookup(mac: str):
    """Look up manufacturer for a MAC address."""
    return lookup_manufacturer(mac)

@router.post("/oui/download")
async def download_oui():
    """Download IEEE OUI database for manufacturer lookups."""
    return await download_oui_db()


def _human(n: int) -> str:
    for u in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.0f} {u}" if u == "B" else f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} PB"


@router.get("/data-usage")
async def data_usage():
    """Uso de disco de la carpeta de datos del backend, desglosado por subcarpeta."""
    folders = []
    total = 0
    for d in _DATA_DIRS:
        if d == settings.DATA_DIR:
            continue
        size = _dir_size(d)
        cnt = 0
        try:
            cnt = sum(len(fs) for _r, _ds, fs in os.walk(d))
        except OSError:
            pass
        total += size
        folders.append({"name": d.name, "path": str(d), "bytes": size,
                        "human": _human(size), "files": cnt})
    folders.sort(key=lambda x: x["bytes"], reverse=True)
    return {"data_dir": str(settings.DATA_DIR), "total_bytes": total,
            "total_human": _human(total), "folders": folders}


@router.post("/wipe-data")
async def wipe_data():
    """Borra TODO el contenido de la carpeta de datos del backend (capturas, informes,
    wordlists, evidencias, recon, handshakes, logs…). Irreversible. Recrea las
    carpetas vacías y resetea el estado en memoria (sesiones, mapa de recon, escaneos).
    """
    removed = []
    if settings.DATA_DIR.exists():
        for child in list(settings.DATA_DIR.iterdir()):
            try:
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                else:
                    child.unlink()
                removed.append(child.name)
            except Exception:
                pass
    for d in _DATA_DIRS:
        try:
            d.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
    # resetear estado en memoria para que no queden referencias a ficheros borrados
    try:
        from app.services.session_service import session_service
        session_service._sessions.clear()
    except Exception:
        pass
    try:
        from app.services.recon_service import recon_service
        recon_service.clear_map()
    except Exception:
        pass
    try:
        from app.services.aircrack_service import aircrack_service
        aircrack_service._scans.clear()
    except Exception:
        pass
    return {"wiped": True, "removed": removed}
