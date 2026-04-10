"""API routes for system health, tool checks, and process management."""

from fastapi import APIRouter
from app.utils.tool_checker import check_tools, check_root, get_system_info
from app.utils.process_manager import process_manager

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/info")
async def system_info():
    """System info + root check."""
    return await get_system_info()


@router.get("/tools")
async def check_required_tools():
    """Check which required tools are installed."""
    return await check_tools()


@router.get("/preflight")
async def preflight_check():
    """
    Full preflight: system info + tools + root.
    Run this before starting any audit to verify the environment.
    """
    info = await get_system_info()
    tools = await check_tools()
    missing_critical = [
        name for name, t in tools.items()
        if t["critical"] and not t["installed"]
    ]
    return {
        "system": info,
        "tools": tools,
        "ready": len(missing_critical) == 0 and info["is_root"],
        "missing_critical": missing_critical,
        "warnings": [] if info["is_root"] else ["Not running as root — most operations will fail"],
    }


@router.get("/processes")
async def list_processes():
    """List all managed subprocesses."""
    procs = process_manager.list_all()
    return [
        {
            "id": p.id,
            "command": " ".join(p.command),
            "status": p.status,
            "started_at": p.started_at,
            "finished_at": p.finished_at,
            "return_code": p.return_code,
        }
        for p in procs
    ]


@router.post("/processes/{proc_id}/cancel")
async def cancel_process(proc_id: str):
    """Cancel a running subprocess."""
    success = await process_manager.cancel(proc_id)
    return {"cancelled": success}
