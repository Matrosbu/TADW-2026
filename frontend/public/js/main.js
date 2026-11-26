import { installRouter, currentRoute } from "./router.js";
import { renderCatalog } from "./views/catalog.js";
import { renderMovie } from "./views/movie.js";
import { el, clear } from "./dom.js";

const app = document.querySelector("#app");

function render() {
  const route = currentRoute();
  if (route.name === "catalog") {
    renderCatalog(app);
  } else if (route.name === "movie") {
    renderMovie(app, route.id);
  } else {
    document.title = "Página no encontrada · DCIC-Flix26";
    clear(app);
    const view = el("section", "state");
    view.append(el("h1", "page-heading", "Página no encontrada"));
    const link = el("a", "back-link", "Volver al inicio");
    link.href = "/";
    link.dataset.link = "";
    view.append(link);
    app.append(view);
  }
}

installRouter(render);
