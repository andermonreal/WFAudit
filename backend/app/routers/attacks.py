"""API routes for all attack vectors."""
from fastapi import APIRouter
from app.models.schemas import EvilTwinRequest, MitmRequest
from app.services.evil_twin_service import evil_twin_service
from app.services.mitm_service import mitm_service

router = APIRouter(prefix="/attacks", tags=["Attack Vectors"])

@router.post("/evil-twin/start")
async def start_evil_twin(req: EvilTwinRequest):
    """Launch Evil Twin with optional deauth of legitimate AP."""
    return await evil_twin_service.start(req)

@router.post("/evil-twin/stop")
async def stop_evil_twin():
    return await evil_twin_service.stop()

@router.get("/evil-twin/status")
async def evil_twin_status():
    return evil_twin_service.status()

@router.post("/mitm/start")
async def start_mitm(req: MitmRequest):
    return await mitm_service.start(req)

@router.post("/mitm/stop")
async def stop_mitm():
    return await mitm_service.stop()

@router.get("/mitm/status")
async def mitm_status():
    return mitm_service.status()
