from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    DiscoverRequest, ReconScanRequest, AddHostRequest, HostUpdateRequest, LegendRequest,
)
from app.services.recon_service import recon_service

router = APIRouter(prefix="/recon", tags=["Reconnaissance"])


@router.get("/map")
async def get_map():
    """Mapa de red persistente (hosts + escaneos de puertos acumulados)."""
    return recon_service.get_map()


@router.post("/discover")
async def discover(req: DiscoverRequest):
    """Descubre hosts activos en un CIDR (arp-scan en LAN, nmap -sn si no).

    Corre en segundo plano: devuelve el mapa con discovering=true y hay que
    consultar /recon/map para ver el progreso.
    """
    r = recon_service.discover(req.cidr)
    if isinstance(r, dict) and r.get("error"):
        raise HTTPException(400, r["error"])
    return r


@router.post("/scan")
async def scan(req: ReconScanRequest):
    """Lanza un escaneo de puertos en segundo plano sobre un host del mapa."""
    r = recon_service.scan_host(req.ip, req.scan_type)
    if isinstance(r, dict) and r.get("error"):
        raise HTTPException(400, r["error"])
    return r


@router.post("/host")
async def add_host(req: AddHostRequest):
    """Añade manualmente una IP al mapa (para escanear un host escrito a mano)."""
    r = recon_service.add_host(req.ip)
    if isinstance(r, dict) and r.get("error"):
        raise HTTPException(400, r["error"])
    return r


@router.patch("/host/{ip}")
async def update_host(ip: str, req: HostUpdateRequest):
    """Edita etiqueta/notas/color/posición de un host."""
    r = recon_service.update_host(ip, req.model_dump(exclude_none=True))
    if isinstance(r, dict) and r.get("error"):
        raise HTTPException(404, r["error"])
    return r


@router.delete("/host/{ip}")
async def remove_host(ip: str):
    return recon_service.remove_host(ip)


@router.put("/legend")
async def set_legend(req: LegendRequest):
    """Guarda la leyenda de colores del grafo (color → significado)."""
    return recon_service.update_legend(req.legend)


@router.delete("/map")
async def clear_map():
    return recon_service.clear_map()
