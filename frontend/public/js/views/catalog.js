import { CATALOG_PAGE_SIZE, getGenres, getMovies } from "../api.js";
import { el, clear, poster, loadingSkeletons, errorView } from "../dom.js";

export async function renderCatalog(app) {
  document.title = "Catálogo · DCIC-Flix26";
  clear(app);

  const section = el("section", "catalog-view");
  const heading = el("h1", "page-heading", "Catálogo");
  const controls = el("div", "catalog-controls");
  const search = el("input", "search-input");
  search.type = "search";
  search.placeholder = "Buscar por título";
  const select = el("select", "genre-select");
  const allGenres = el("option", "", "Todos los géneros");
  allGenres.value = "";
  select.append(allGenres);

  const params = new URLSearchParams(window.location.search);
  let q = params.get("q") || "";
  let genre = params.get("genre") || "";
  let page = Number.parseInt(params.get("page") || "1", 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  search.value = q;

  controls.append(search, select);
  const results = el("div", "catalog-results");
  section.append(heading, controls, results);
  app.append(section);

  let availableGenres = [];
  try {
    const genreData = await getGenres();
    if (Array.isArray(genreData.items)) {
      availableGenres = genreData.items.filter((item) => typeof item === "string" && item.trim());
      availableGenres.sort((a, b) => a.trim().localeCompare(b.trim(), "es"));
      availableGenres.forEach((item) => {
        const option = el("option", "", item.trim());
        option.value = item;
        select.append(option);
      });
    }
  } catch {
  }

  if (genre && !availableGenres.includes(genre)) {
    genre = "";
  }
  select.value = genre;

  function updateUrl() {
    const next = new URL(window.location.href);
    next.search = "";
    if (q) next.searchParams.set("q", q);
    if (genre) next.searchParams.set("genre", genre);
    if (page > 1) next.searchParams.set("page", String(page));
    window.history.replaceState({}, "", `${next.pathname}${next.search}`);
  }

  let timer;
  let loadController;
  let loadSequence = 0;

  search.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      q = search.value;
      page = 1;
      updateUrl();
      load();
    }, 300);
  });
  select.addEventListener("change", () => {
    genre = select.value;
    page = 1;
    updateUrl();
    load();
  });

  async function load() {
    if (loadController) loadController.abort();
    loadController = new AbortController();
    const sequence = ++loadSequence;
    const controller = loadController;

    clear(results);
    results.append(loadingSkeletons());
    try {
      const data = await getMovies({ q, genre, page, size: CATALOG_PAGE_SIZE, signal: controller.signal });
      if (sequence !== loadSequence) return;
      clear(results);

      const total = typeof data.total === "number" && data.total >= 0 ? data.total : 0;
      const pages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
      if (page > pages) {
        page = pages;
        updateUrl();
        await load();
        return;
      }

      if (!Array.isArray(data.items) || data.items.length === 0) {
        results.append(el("p", "empty-state", "No se encontraron películas"));
        return;
      }

      const grid = el("div", "movie-grid");
      data.items.forEach((movie) => {
        if (!movie || typeof movie !== "object") return;
        const id = typeof movie.id === "string" ? movie.id : "";
        if (!id) return;
        const card = el("a", "movie-card");
        card.href = `/movie/${encodeURIComponent(id)}`;
        card.dataset.link = "";
        card.append(poster(movie));

        const body = el("div", "movie-card-body");
        body.append(el("h2", "movie-card-title", typeof movie.title === "string" ? movie.title : "Sin título"));
        const meta = el("p", "movie-card-meta");
        if (Number.isInteger(movie.year) && movie.year > 0) meta.append(document.createTextNode(String(movie.year)));
        if (movie.imdb && typeof movie.imdb.rating === "number") {
          if (meta.childNodes.length) meta.append(document.createTextNode(" · "));
          meta.append(document.createTextNode(`★ ${movie.imdb.rating}`));
        }
        body.append(meta);
        card.append(body);
        grid.append(card);
      });
      results.append(grid);

      const pager = el("nav", "pagination");
      pager.setAttribute("aria-label", "Paginación del catálogo");
      const previous = el("button", "button", "Anterior");
      previous.type = "button";
      previous.disabled = page <= 1;
      previous.addEventListener("click", () => {
        page -= 1;
        updateUrl();
        load();
      });
      const label = el("span", "pagination-label", `Página ${page} de ${pages} · ${total} películas`);
      const next = el("button", "button", "Siguiente");
      next.type = "button";
      next.disabled = page >= pages;
      next.addEventListener("click", () => {
        page += 1;
        updateUrl();
        load();
      });
      pager.append(previous, label, next);
      results.append(pager);
    } catch (error) {
      if (sequence !== loadSequence || error.name === "AbortError") return;
      clear(results);
      const message = error.status === 503
        ? "El catálogo no está disponible por el momento"
        : (error.message || "Error al cargar el catálogo");
      results.append(errorView(message, load));
    }
  }

  await load();
}
