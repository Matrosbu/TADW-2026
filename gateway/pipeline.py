import logging

from fastapi import APIRouter, Request
from pymongo.errors import ConnectionFailure

router = APIRouter(prefix="/api")
logger = logging.getLogger("gateway")
last_known_phase = None


async def get_status(db):
    global last_known_phase
    document = await db.system_state.find_one({"_id": "pipeline"})
    cleaning = document.get("cleaning") if isinstance(document, dict) else None
    recsys = document.get("recsys") if isinstance(document, dict) else None

    cleaning = cleaning if isinstance(cleaning, dict) else {}
    recsys = recsys if isinstance(recsys, dict) else {}

    cleaning_status = cleaning.get("status")
    if cleaning_status not in ("pending", "running", "done"):
        cleaning_status = "pending"

    recsys_status = recsys.get("status")
    if recsys_status not in ("pending", "building", "ready"):
        recsys_status = "pending"

    step = cleaning.get("step")
    if not isinstance(step, str):
        step = None

    progress_value = cleaning.get("progress")
    if isinstance(progress_value, dict):
        done = progress_value.get("done")
        total = progress_value.get("total")
        progress = {
            "done": done if isinstance(done, int) and not isinstance(done, bool) else None,
            "total": total if isinstance(total, int) and not isinstance(total, bool) else None,
        }
    else:
        progress = None

    if cleaning_status != "done":
        phase = "curating"
    elif recsys_status != "ready":
        phase = "indexing"
    else:
        phase = "ready"

    last_known_phase = phase
    return {
        "phase": phase,
        "cleaning": {
            "status": cleaning_status,
            "step": step,
            "progress": progress,
        },
        "recsys": {"status": recsys_status},
    }


async def votes_allowed(db):
    try:
        status = await get_status(db)
        return status["phase"] == "ready"
    except ConnectionFailure:
        logger.warning("Mongo no disponible al consultar el estado de votación")
        return last_known_phase == "ready"


@router.get("/status")
async def status(request: Request):
    return await get_status(request.app.state.mongo.db)
