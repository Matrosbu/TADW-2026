import os
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import AsyncMongoClient


def serialize(value):
    return _serialize(value, top_level=True)


def _serialize(value, top_level=False):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(value, dict):
        serialized = {}
        for key, item in value.items():
            output_key = "id" if top_level and key == "_id" else key
            serialized[output_key] = _serialize(item)
        return serialized
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    return value


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

        self.client = AsyncMongoClient(
            host,
            port,
            username=user,
            password=password,
            authSource="admin",
            serverSelectionTimeoutMS=3000,
        )
        self.db = self.client[db_name]

    async def close(self):
        if self.client:
            await self.client.close()
