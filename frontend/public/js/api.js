export const CATALOG_PAGE_SIZE = 24;
export const REVIEWS_PAGE_SIZE = 10;

async function request(path, signal) {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  const data = await response.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
  if (!response.ok) {
    const error = new Error(data.error || "Error al consultar el catálogo");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getGenres(signal) {
  return request("/api/genres", signal);
}

export function getMovies(params) {
  const search = new URLSearchParams();
  if (params.genre) search.set("genre", params.genre);
  if (params.q) search.set("q", params.q);
  search.set("page", String(params.page));
  search.set("size", String(params.size || CATALOG_PAGE_SIZE));
  return request(`/api/movies?${search}`, params.signal);
}

export function getMovie(id, signal) {
  return request(`/api/movies/${encodeURIComponent(id)}`, signal);
}

export function getMovieReviews(id, page, size = REVIEWS_PAGE_SIZE, signal) {
  return request(`/api/movies/${encodeURIComponent(id)}/reviews?page=${page}&size=${size}`, signal);
}
