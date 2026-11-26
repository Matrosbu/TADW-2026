export const CATALOG_PAGE_SIZE = 24;
export const REVIEWS_PAGE_SIZE = 10;

async function request(path, options = {}) {
  const fetchOptions = {
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    signal: options.signal,
  };
  if (options.method) fetchOptions.method = options.method;
  if (options.body) fetchOptions.body = JSON.stringify(options.body);

  const response = await fetch(path, fetchOptions);
  const data = await response.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
  if (!response.ok) {
    const error = new Error(data.error || "Error al comunicarse con el servidor");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getStatus(signal) {
  return request("/api/status", { signal });
}

export function postInteraction(payload) {
  return request("/api/interactions", { method: "POST", body: payload });
}

export function getGenres(signal) {
  return request("/api/genres", { signal });
}

export function getMovies(params) {
  const search = new URLSearchParams();
  if (params.genre) search.set("genre", params.genre);
  if (params.q) search.set("q", params.q);
  search.set("page", String(params.page));
  search.set("size", String(params.size || CATALOG_PAGE_SIZE));
  return request(`/api/movies?${search}`, { signal: params.signal });
}

export function getMovie(id, signal) {
  return request(`/api/movies/${encodeURIComponent(id)}`, { signal });
}

export function getMovieReviews(id, page, size = REVIEWS_PAGE_SIZE, signal) {
  return request(`/api/movies/${encodeURIComponent(id)}/reviews?page=${page}&size=${size}`, { signal });
}
