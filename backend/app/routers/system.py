from fastapi import APIRouter
from app.utils.tool_checker import check_tools, check_tools_by_category, check_root, get_system_info
from app.utils.process_manager import process_manager
from app.utils.oui_lookup import lookup_manufacturer, download_oui_db

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/health")
async def health():
    return {"status": "ok"}

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
