import asyncio
import logging
import os

from bson import ObjectId
from pymongo import AsyncMongoClient
from pymongo.errors import ConnectionFailure

logger = logging.getLogger("ingest-consumer")


class MongoStorage:
    def __init__(self):
        self.client = None
        self.db = None

    async def connect(self):
        host = os.getenv("MONGO_HOST", "mongo")
        port = int(os.getenv("MONGO_PORT", "27017"))
        user = os.getenv("MONGO_USER", "flix_admin")
        password = os.getenv("MONGO_PASSWORD", "dev_only_change_me")
        db_name = os.getenv("MONGO_DB", "peliculas-proyectos")

        for attempt, delay in enumerate((1, 2, 4, 8, 8), start=1):
            try:
                self.client = AsyncMongoClient(
                    host,
                    port,
                    username=user,
                    password=password,
                    authSource="admin",
                    serverSelectionTimeoutMS=3000,
                )
                await self.client.admin.command("ping")
                self.db = self.client[db_name]
                await self.db.reviews.create_index(
                    "interaction_id",
                    unique=True,
                    partialFilterExpression={"interaction_id": {"$exists": True}},
                )
                return
            except (ConnectionFailure, OSError) as exc:
                logger.warning("intento=%s Mongo falló: %s", attempt, type(exc).__name__)
                await asyncio.sleep(delay)
        raise RuntimeError("Mongo no disponible")

    async def close(self):
        if self.client:
            await self.client.close()

    async def movie_exists(self, movie_id):
        movie = await self.db.movies.find_one({"_id": ObjectId(movie_id)})
        return movie is not None

    async def persist(self, interaction):
        existing = await self.db.reviews.find_one({"user_id": interaction.user_id})
        user_name = existing.get("user_name") if existing else None
        user_email = existing.get("user_email") if existing else None

        await self.db.reviews.update_one(
            {
                "user_id": interaction.user_id,
                "movie_id": ObjectId(interaction.movie_id),
            },
            {
                "$set": {
                    "rating": interaction.rating,
                    "comment": interaction.comment,
                    "date": interaction.ts,
                    "interaction_id": str(interaction.interaction_id),
                    "user_name": user_name,
                    "user_email": user_email,
                }
            },
            upsert=True,
        )
