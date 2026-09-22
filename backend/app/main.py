"""WiFi Audit Backend v2.0 — Main Application."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.utils.process_manager import process_manager

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    yield
    logger.info("Shutting down — cleaning up processes...")
    await process_manager.cleanup()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Professional WiFi security audit backend with PMKID, AP-less, Enterprise, WPA3 attack support.",
    lifespan=lifespan,
)

# Rutas que NUNCA requieren token: sondas de salud y la propia consulta de
# "¿hace falta token?" (para que el frontend pueda preguntar antes de tenerlo),
# más la documentación de la API.
_AUTH_EXEMPT = ("/system/health", "/system/auth-status", "/docs", "/redoc", "/openapi.json")


# IMPORTANTE: este middleware de auth se añade ANTES que el de CORS. En Starlette
# el último middleware añadido queda por fuera, así que CORS envuelve a la auth y
# hasta una respuesta 401 lleva cabeceras CORS; de lo contrario el navegador vería
# un error de CORS en lugar del 401 y no podría pedir el token al usuario.
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if (
        settings.REQUIRE_AUTH
        and request.method != "OPTIONS"
        and not request.url.path.startswith(_AUTH_EXEMPT)
    ):
        auth = request.headers.get("Authorization", "")
        token = (
            auth[7:] if auth.startswith("Bearer ") else ""
        ) or request.headers.get("X-API-Key", "") or request.query_params.get("token", "")
        if token != settings.API_KEY:
            return JSONResponse(status_code=401, content={"detail": "Token de acceso inválido o ausente"})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routers.system import router as system_router
from app.routers.interfaces import router as interfaces_router
from app.routers.wifi import router as wifi_router
from app.routers.recon import router as recon_router
from app.routers.attacks import router as attacks_router
from app.routers.advanced import router as advanced_router
from app.routers.captures import router as captures_router
from app.routers.sessions import router as sessions_router
from app.routers.wordlists import router as wordlists_router

app.include_router(system_router)
app.include_router(interfaces_router)
app.include_router(wifi_router)
app.include_router(recon_router)
app.include_router(attacks_router)
app.include_router(advanced_router)
app.include_router(captures_router)
app.include_router(sessions_router)
app.include_router(wordlists_router)


@app.get("/", tags=["Root"])
async def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
