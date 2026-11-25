import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from pymongo.errors import ConnectionFailure

from messaging import RabbitConsumer
from storage import MongoStorage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s ingest-consumer %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("ingest-consumer")


class Interaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    interaction_id: uuid.UUID
    user_id: str
    movie_id: str
    rating: int = Field(strict=True, ge=1, le=5)
    comment: str = Field(min_length=1, max_length=1000)
    ts: datetime

    @field_validator("interaction_id")
    @classmethod
    def validate_uuid4(cls, value):
        if value.version != 4:
            raise ValueError("interaction_id debe ser uuid4")
        return value

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

    @field_validator("ts")
    @classmethod
    def validate_utc_timestamp(cls, value):
        if value.tzinfo is None:
            raise ValueError("ts debe ser ISO-8601 UTC")
        if value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("ts debe ser ISO-8601 UTC")
        return value.astimezone(timezone.utc).replace(tzinfo=timezone.utc)


async def process_message(message, storage):
    interaction_id = None
    try:
        payload = json.loads(message.body.decode("utf-8"))
        if isinstance(payload, dict):
            interaction_id = payload.get("interaction_id")
        interaction = Interaction.model_validate(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        await message.reject(requeue=False)
        logger.info("interaction_id=%s rechazado: JSON inválido", interaction_id)
        return
    except ValidationError as exc:
        await message.reject(requeue=False)
        reasons = "; ".join(error["msg"] for error in exc.errors())
        logger.info("interaction_id=%s rechazado: %s", interaction_id, reasons)
        return

    try:
        if not await storage.movie_exists(interaction.movie_id):
            await message.reject(requeue=False)
            logger.info("interaction_id=%s rechazado: película inexistente", interaction_id)
            return
        await storage.persist(interaction)
        await message.ack()
        logger.info("interaction_id=%s persistido", interaction_id)
    except ConnectionFailure:
        await message.nack(requeue=True)
        logger.info("interaction_id=%s reencolado: Mongo no disponible", interaction_id)
        await asyncio.sleep(2)
    except Exception:
        await message.reject(requeue=False)
        logger.exception("interaction_id=%s rechazado: excepción inesperada", interaction_id)


async def main():
    rabbit = RabbitConsumer()
    mongo = MongoStorage()
    await rabbit.connect()
    await mongo.connect()

    queue = await rabbit.channel.get_queue("interactions")
    async with queue.iterator() as messages:
        async for message in messages:
            await process_message(message, mongo)


if __name__ == "__main__":
    asyncio.run(main())
