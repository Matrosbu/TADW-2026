import { REVIEWS_PAGE_SIZE, getMovie, getMovieReviews } from "../api.js";
import { el, clear, poster, errorView } from "../dom.js";

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function formatDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export async function renderMovie(app, id) {
  document.title = "Película · DCIC-Flix26";
  clear(app);
  const section = el("section", "movie-view");
  section.append(el("p", "loading-state", "Cargando película…"));
  app.append(section);

  let movieController;
  let movieSequence = 0;

  async function load() {
    if (movieController) movieController.abort();
    movieController = new AbortController();
    const sequence = ++movieSequence;

    clear(section);
    try {
      const movie = await getMovie(id, movieController.signal);
      if (sequence !== movieSequence) return;
      document.title = `${typeof movie.title === "string" ? movie.title : "Película"} · DCIC-Flix26`;

      const catalogUrl = window.history.state?.catalogUrl || "/";
      const back = el("a", "back-link", "← Volver al catálogo");
      back.href = catalogUrl;
      back.dataset.link = "";
      section.append(back);

      const detail = el("article", "movie-detail");
      detail.append(poster(movie));
      const info = el("div", "movie-info");
      info.append(el("h1", "movie-title", typeof movie.title === "string" ? movie.title : "Sin título"));

      const meta = el("div", "movie-meta");
      const year = positiveNumber(movie.year);
      const runtime = positiveNumber(movie.runtime);
      if (year) meta.append(el("span", "", String(year)));
      if (runtime) meta.append(el("span", "", `${runtime} min`));
      if (typeof movie.rated === "string" && movie.rated.trim()) meta.append(el("span", "", movie.rated.trim()));
      if (meta.childNodes.length) info.append(meta);

      if (Array.isArray(movie.genres)) {
        const genres = el("div", "genre-tags");
        movie.genres.filter((genre) => typeof genre === "string" && genre.trim()).forEach((genre) => genres.append(el("span", "tag", genre.trim())));
        if (genres.childNodes.length) info.append(genres);
      }

      if (movie.imdb && typeof movie.imdb.rating === "number") {
        info.append(el("p", "imdb-rating", `IMDb ★ ${movie.imdb.rating}`));
      }

      if (typeof movie.plot === "string" || typeof movie.fullplot === "string") {
        const synopsis = typeof movie.fullplot === "string" && movie.fullplot.trim() ? movie.fullplot : movie.plot;
        if (typeof synopsis === "string" && synopsis.trim()) {
          info.append(el("h2", "section-heading", "Sinopsis"));
          info.append(el("p", "synopsis", synopsis));
        }
      }

      if (Array.isArray(movie.directors) && movie.directors.some((item) => typeof item === "string")) {
        info.append(el("h2", "section-heading", "Director(es)"));
        info.append(el("p", "detail-text", movie.directors.filter((item) => typeof item === "string").join(", ")));
      }
      if (Array.isArray(movie.cast) && movie.cast.some((item) => typeof item === "string")) {
        info.append(el("h2", "section-heading", "Reparto"));
        info.append(el("p", "detail-text", movie.cast.filter((item) => typeof item === "string").join(", ")));
      }
      if (movie.awards && typeof movie.awards.text === "string" && movie.awards.text.trim()) {
        info.append(el("h2", "section-heading", "Premios"));
        info.append(el("p", "detail-text", movie.awards.text));
      }

      detail.append(info);
      section.append(detail);
      await renderReviews(section, id);
    } catch (error) {
      if (sequence !== movieSequence || error.name === "AbortError") return;
      clear(section);
      const message = error.status === 404
        ? "Película no encontrada"
        : (error.status === 503 ? "El catálogo no está disponible por el momento" : (error.message || "Error al cargar la película"));
      section.append(errorView(message, load));
    }
  }

  async function renderReviews(container, movieId) {
    let page = 1;
    let reviewSequence = 0;
    let reviewController;

    const reviewsSection = el("section", "reviews-section");
    reviewsSection.append(el("h2", "section-heading", "Reseñas de la comunidad"));
    const list = el("div", "reviews-list");
    reviewsSection.append(list);
    container.append(reviewsSection);

    async function loadReviews() {
      if (reviewController) reviewController.abort();
      reviewController = new AbortController();
      const sequence = ++reviewSequence;
      const more = reviewsSection.querySelector("button[data-more]");
      if (more) more.disabled = true;

      try {
        const data = await getMovieReviews(movieId, page, REVIEWS_PAGE_SIZE, reviewController.signal);
        if (sequence !== reviewSequence) return;
        if (page === 1) clear(list);

        if (!Array.isArray(data.items) || data.items.length === 0) {
          if (page === 1) list.append(el("p", "empty-state", "Aún no hay reseñas"));
        } else {
          data.items.forEach((review) => {
            if (!review || typeof review !== "object") return;
            const article = el("article", "review-card");
            const header = el("div", "review-header");
            const rating = positiveNumber(review.rating) && review.rating <= 5 ? Math.round(review.rating) : null;
            const stars = el("span", "review-stars");
            if (rating) {
              stars.setAttribute("aria-label", `${rating} de 5`);
              let text = "";
              for (let index = 1; index <= 5; index += 1) text += index <= rating ? "★" : "☆";
              stars.textContent = text;
            } else {
              stars.setAttribute("aria-label", "Sin puntaje");
            }
            const identity = el("div", "review-identity");
            identity.append(el("strong", "", typeof review.user_name === "string" && review.user_name.trim() ? review.user_name : "Usuario"));
            if (typeof review.user_id === "string") identity.append(el("span", "review-user-id", review.user_id));
            header.append(stars, identity);
            article.append(header);

            const date = formatDate(review.date);
            if (date) article.append(el("time", "review-date", date));
            if (typeof review.comment === "string" && review.comment.trim()) article.append(el("p", "review-comment", review.comment));
            list.append(article);
          });
        }

        const oldMore = reviewsSection.querySelector("button[data-more]");
        if (oldMore) oldMore.remove();
        if (Array.isArray(data.items) && data.items.length === REVIEWS_PAGE_SIZE && page * REVIEWS_PAGE_SIZE < data.total) {
          const moreButton = el("button", "button", "Ver más");
          moreButton.type = "button";
          moreButton.dataset.more = "";
          moreButton.addEventListener("click", () => {
            page += 1;
            loadReviews();
          });
          reviewsSection.append(moreButton);
        }
      } catch (error) {
        if (sequence !== reviewSequence || error.name === "AbortError") return;
        const moreButton = reviewsSection.querySelector("button[data-more]");
        if (moreButton) moreButton.disabled = false;
        if (page === 1) clear(list);
        list.append(el("p", "state error-state", error.status === 503 ? "El catálogo no está disponible por el momento" : (error.message || "Error al cargar reseñas")));
      }
    }

    await loadReviews();
  }

  await load();
}
