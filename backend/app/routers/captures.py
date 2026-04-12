"""API routes for capture file management."""
from fastapi import APIRouter
from typing import Optional
from app.services.capture_service import capture_service

router = APIRouter(prefix="/captures", tags=["Capture Files"])

@router.get("/")
async def list_captures(directory: Optional[str] = None):
    """List all capture files (.cap, .pcapng, .csv, .22000, etc.)."""
    return await capture_service.list_captures(directory)

@router.post("/check-handshake")
async def check_handshake(filepath: str):
    """Check if a capture file contains a WPA handshake or PMKID."""
    return await capture_service.check_handshake(filepath)

@router.delete("/")
async def delete_capture(filepath: str):
    return await capture_service.delete_capture(filepath)
