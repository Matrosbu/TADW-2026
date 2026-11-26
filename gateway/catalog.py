import re

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request

from storage import serialize

router = APIRouter(prefix="/api")


def parse_movie_id(movie_id):
    if not re.fullmatch(r"[0-9A-Fa-f]{24}", movie_id):
        raise HTTPException(status_code=400, detail="movie_id inválido")
    return ObjectId(movie_id)


def check_pagination(page, size):
    if page < 1:
        raise HTTPException(status_code=400, detail="page inválido")
    if size < 1 or size > 50:
        raise HTTPException(status_code=400, detail="size inválido")


async def paginate(collection, query, projection, sort, page, size):
    cursor = collection.find(query, projection).sort(sort)
    cursor = cursor.skip((page - 1) * size).limit(size)
    items = [serialize(item) async for item in cursor]
    total = await collection.count_documents(query)
    return {"items": items, "page": page, "size": size, "total": total}


@router.get("/movies")
async def list_movies(
    request: Request,
    genre: str | None = None,
    q: str | None = None,
    page: int = 1,
    size: int = 20,
):
    check_pagination(page, size)
    if genre is not None and len(genre) > 50:
        raise HTTPException(status_code=400, detail="genre inválido")
    if q is not None and len(q) > 100:
        raise HTTPException(status_code=400, detail="q inválido")

    db = request.app.state.mongo.db
    movie_filter = {}
    if genre is not None:
        movie_filter["genres"] = genre
    if q is not None:
        movie_filter["title"] = {"$regex": re.escape(q), "$options": "i"}

    projection = {
        "_id": 1,
        "title": 1,
        "year": 1,
        "genres": 1,
        "runtime": 1,
        "poster": 1,
        "imdb.rating": 1,
        "imdb.votes": 1,
    }
    return await paginate(
        db.movies,
        movie_filter,
        projection,
        [("title", 1), ("_id", 1)],
        page,
        size,
    )


@router.get("/movies/{movie_id}")
async def get_movie(request: Request, movie_id: str):
    object_id = parse_movie_id(movie_id)
    db = request.app.state.mongo.db
    movie = await db.movies.find_one({"_id": object_id})
    if movie is None:
        raise HTTPException(status_code=404, detail="película no encontrada")
    return serialize(movie)


@router.get("/movies/{movie_id}/reviews")
async def list_reviews(
    request: Request,
    movie_id: str,
    page: int = 1,
    size: int = 20,
):
    check_pagination(page, size)
    object_id = parse_movie_id(movie_id)

    db = request.app.state.mongo.db
    if await db.movies.find_one({"_id": object_id}, {"_id": 1}) is None:
        raise HTTPException(status_code=404, detail="película no encontrada")

    review_filter = {"movie_id": object_id}
    projection = {
        "_id": 1,
        "user_id": 1,
        "user_name": 1,
        "rating": 1,
        "comment": 1,
        "date": 1,
    }
    return await paginate(
        db.reviews,
        review_filter,
        projection,
        [("date", -1), ("_id", -1)],
        page,
        size,
    )


@router.get("/genres")
async def list_genres(request: Request):
    db = request.app.state.mongo.db
    genres = await db.movies.distinct("genres")
    return {"items": sorted(genres)}
