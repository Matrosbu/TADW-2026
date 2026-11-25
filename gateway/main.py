import logging
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Request
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from messaging import RabbitPublisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s gateway %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("gateway")

publisher = RabbitPublisher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await publisher.connect()
    yield
    await publisher.close()


app = FastAPI(lifespan=lifespan)


class Interaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    movie_id: str
    rating: int = Field(strict=True, ge=1, le=5)
    comment: str = Field(min_length=1, max_length=1000)

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, value):
        if not re.fullmatch(r"usr_[0-9]{4}", value):
            raise ValueError("user_id debe tener formato usr_NNNN")
        number = int(value[4:])
        if number < 1 or number > 2000:
            raise ValueError("user_id debe estar entre usr_0001 y usr_2000")
        return value

    @field_validator("movie_id")
    @classmethod
    def validate_movie_id(cls, value):
        if not re.fullmatch(r"[0-9A-Fa-f]{24}", value):
            raise ValueError("movie_id debe tener 24 caracteres hexadecimales")
        return value

    @field_validator("comment", mode="before")
    @classmethod
    def normalize_comment(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    message = exc.errors()[0].get("msg", "datos inválidos")
    if message.startswith("Value error,"):
        message = message.split("Value error,", 1)[1].strip()
    else:
        message = "datos inválidos"
    return JSONResponse(status_code=400, content={"error": message})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/interactions")
async def create_interaction(interaction: Interaction):
    interaction_id = str(uuid.uuid4())
    message = {
        "interaction_id": interaction_id,
        "user_id": interaction.user_id,
        "movie_id": interaction.movie_id,
        "rating": interaction.rating,
        "comment": interaction.comment,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }

    try:
        await publisher.publish(message, interaction_id)
    except Exception:
        logger.exception("publicación fallida interaction_id=%s", interaction_id)
        return JSONResponse(status_code=503, content={"error": "RabbitMQ no disponible"})

    logger.info(
        "publicación exitosa interaction_id=%s user_id=%s movie_id=%s",
        interaction_id,
        interaction.user_id,
        interaction.movie_id,
    )
    return JSONResponse(status_code=202, content={"interaction_id": interaction_id})
