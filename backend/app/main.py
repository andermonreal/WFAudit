"""WiFi Audit Backend — Main Application."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import interfaces, wifi, recon, attacks, sessions, system  # noqa: F401
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
    description="Backend API for professional WiFi security auditing.",
    lifespan=lifespan,
)

# CORS — permissive for local frontend dev, lock down in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Optional API Key auth ──

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if settings.REQUIRE_AUTH and not request.url.path.startswith("/docs"):
        api_key = request.headers.get("X-API-Key")
        if api_key != settings.API_KEY:
            return JSONResponse(status_code=401, content={"detail": "Invalid API key"})
    return await call_next(request)


# ── Register routers ──

from app.routers.system import router as system_router
from app.routers.interfaces import router as interfaces_router
from app.routers.wifi import router as wifi_router
from app.routers.recon import router as recon_router
from app.routers.attacks import router as attacks_router
from app.routers.sessions import router as sessions_router

app.include_router(system_router)
app.include_router(interfaces_router)
app.include_router(wifi_router)
app.include_router(recon_router)
app.include_router(attacks_router)
app.include_router(sessions_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
