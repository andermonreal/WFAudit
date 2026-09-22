"""API routes for wordlist generation and management."""
import os
import shutil
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.models.schemas import WordlistGenerateRequest
from app.services.wordlist_service import wordlist_service
from app.config import settings

router = APIRouter(prefix="/wordlists", tags=["Wordlists"])

# Diccionarios comunes del sistema (SecLists / rockyou) importables como wordlists.
# Cada clave mapea a varias rutas candidatas (SecLists/seclists según distro).
COMMON_LISTS = {
    "xato-100k": (["/usr/share/SecLists/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt",
                   "/usr/share/seclists/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt"],
                  "xato-top-100000.txt"),
    "xato-10m": (["/usr/share/SecLists/Passwords/Common-Credentials/xato-net-10-million-passwords.txt",
                  "/usr/share/seclists/Passwords/Common-Credentials/xato-net-10-million-passwords.txt"],
                 "xato-10-million.txt"),
    "rockyou": (["/usr/share/wordlists/rockyou.txt",
                 "/usr/share/SecLists/Passwords/Leaked-Databases/rockyou.txt",
                 "/usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt"],
                "rockyou.txt"),
    "10k": (["/usr/share/SecLists/Passwords/Common-Credentials/10k-most-common.txt",
             "/usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt"],
            "10k-most-common.txt"),
}


def _resolve_src(candidates):
    return next((p for p in candidates if os.path.isfile(p)), None)


@router.get("")
async def list_wordlists():
    """List all wordlists in the configured wordlists directory with metadata."""
    return wordlist_service.list_wordlists()


@router.post("/generate")
async def generate_wordlist(req: WordlistGenerateRequest):
    """
    Generate a custom wordlist with mutations from seed words.

    Takes 1-50 seed words (names, dates, places, keywords) and produces
    a massive password dictionary using leetspeak, case mutations,
    number/symbol appendages, word combinations, and more.

    Output is written to the configured wordlists directory.
    Returns metadata: total count, file size, generation time.
    """
    params = req.model_dump()
    return await wordlist_service.generate(params)


@router.post("/estimate")
async def estimate_wordlist(req: WordlistGenerateRequest):
    """
    Estimate how many passwords will be generated, without actually generating.
    Useful for previewing before launching a long generation.
    """
    params = req.model_dump()
    return await wordlist_service.estimate(params)


@router.post("/preview")
async def preview_mutations(req: WordlistGenerateRequest):
    """
    Generate a small live-preview (~60 sample mutations grouped by category)
    showing what each mutation type would produce. Useful for UI feedback.
    """
    params = req.model_dump()
    return await wordlist_service.preview(params)


@router.get("/common-lists")
async def available_common_lists():
    """Diccionarios comunes del sistema (SecLists/rockyou) disponibles para importar."""
    out = []
    for key, (cands, dst) in COMMON_LISTS.items():
        src = _resolve_src(cands)
        out.append({
            "key": key, "name": dst, "source": src or cands[0], "available": src is not None,
            "size_bytes": os.path.getsize(src) if src else 0,
            "imported": (settings.WORDLISTS_DIR / dst).exists(),
        })
    return out


@router.post("/import-common/{key}")
async def import_common_list(key: str):
    """Copia un diccionario común de SecLists a la carpeta de wordlists (para crackear)."""
    if key not in COMMON_LISTS:
        raise HTTPException(400, "Lista desconocida")
    cands, dst = COMMON_LISTS[key]
    src = _resolve_src(cands)
    if not src:
        raise HTTPException(404, "No está en el sistema (instala seclists o wordlists)")
    settings.WORDLISTS_DIR.mkdir(parents=True, exist_ok=True)
    dest = settings.WORDLISTS_DIR / dst
    try:
        shutil.copy2(src, dest)
    except Exception as e:
        raise HTTPException(500, f"No se pudo copiar: {e}")
    return {"imported": True, "filename": dst, "size_bytes": dest.stat().st_size}


@router.get("/{filename}/info")
async def wordlist_info(filename: str):
    """Get detailed info about a specific wordlist."""
    filename = os.path.basename(filename)  # prevent path traversal
    path = settings.WORDLISTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Wordlist not found")

    stat = path.stat()
    info = {
        "filename": filename,
        "path": str(path),
        "size_bytes": stat.st_size,
        "modified_at": stat.st_mtime,
        "lines": None,
        "sample_first": [],
        "sample_random": [],
    }

    # Count lines and sample
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        info["lines"] = len(lines)
        info["sample_first"] = [l.strip() for l in lines[:20]]
        # Random sample (every Nth line)
        if len(lines) > 40:
            step = len(lines) // 20
            info["sample_random"] = [lines[i].strip() for i in range(0, len(lines), step)][:20]
    except Exception as e:
        info["error"] = str(e)

    return info


@router.get("/{filename}/download")
async def download_wordlist(filename: str):
    """Download a wordlist file."""
    filename = os.path.basename(filename)
    path = settings.WORDLISTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Wordlist not found")
    return FileResponse(path, filename=filename, media_type="text/plain")


@router.delete("/{filename}")
async def delete_wordlist(filename: str):
    """Delete a wordlist file."""
    filename = os.path.basename(filename)
    return wordlist_service.delete_wordlist(filename)


@router.get("/presets/info")
async def get_presets():
    """Return preset configurations for the UI."""
    return {
        "presets": [
            {
                "id": "fast",
                "label": "Fast (~50K)",
                "description": "Quick generation with basic mutations. Good for testing.",
                "estimated_count": 50000,
                "config": {
                    "use_leet": True, "leet_intensity": "low",
                    "use_doubling": False, "use_stretching": False,
                    "use_alternating_case": False, "use_palindrome": False,
                    "number_max_length": 2,
                    "use_years": False, "use_birth_years": False,
                    "use_double_symbols": False, "combine_words": False,
                    "add_common_base": False, "add_spanish_base": False,
                },
            },
            {
                "id": "balanced",
                "label": "Balanced (~500K-2M)",
                "description": "Most common mutations. Best balance of speed and coverage.",
                "estimated_count": 1000000,
                "config": {
                    "use_leet": True, "leet_intensity": "medium",
                    "use_doubling": True, "use_stretching": False,
                    "use_alternating_case": False, "use_palindrome": False,
                    "number_max_length": 4,
                    "use_years": True, "use_birth_years": True,
                    "use_double_symbols": True, "combine_words": True,
                    "add_common_base": True, "add_spanish_base": True,
                },
            },
            {
                "id": "exhaustive",
                "label": "Exhaustive (5M-10M)",
                "description": "Every mutation enabled. Generates massive lists, slow but thorough.",
                "estimated_count": 8000000,
                "config": {
                    "use_leet": True, "leet_intensity": "high",
                    "use_doubling": True, "use_stretching": True,
                    "use_alternating_case": True, "use_palindrome": True,
                    "number_max_length": 4,
                    "use_years": True, "use_birth_years": True,
                    "use_double_symbols": True, "combine_words": True,
                    "add_common_base": True, "add_spanish_base": True,
                },
            },
            {
                "id": "spanish",
                "label": "Spanish target",
                "description": "Optimized for Spanish targets — Spanish words + Spanish formats.",
                "estimated_count": 1500000,
                "config": {
                    "use_leet": True, "leet_intensity": "medium",
                    "use_doubling": True, "use_stretching": False,
                    "use_alternating_case": False, "use_palindrome": False,
                    "number_max_length": 4,
                    "use_years": True, "use_birth_years": True,
                    "use_double_symbols": True, "combine_words": True,
                    "add_common_base": False, "add_spanish_base": True,
                },
            },
        ]
    }
