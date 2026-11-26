export function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function poster(movie) {
  const wrapper = el("div", "poster");
  const title = typeof movie.title === "string" && movie.title.trim() ? movie.title : "Película";
  const url = typeof movie.poster === "string" ? movie.poster : "";

  if (/^https?:\/\//i.test(url)) {
    const image = el("img");
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.alt = title;
    image.src = url;
    image.addEventListener("error", () => {
      wrapper.replaceChildren(placeholder(title));
    }, { once: true });
    wrapper.append(image);
  } else {
    wrapper.append(placeholder(title));
  }
  return wrapper;
}

function placeholder(title) {
  const node = el("div", "poster-placeholder", title.trim().charAt(0).toUpperCase() || "?");
  node.setAttribute("aria-label", title);
  return node;
}

export function loadingSkeletons(count = 8) {
  const grid = el("div", "movie-grid");
  for (let index = 0; index < count; index += 1) {
    const card = el("div", "skeleton-card");
    card.setAttribute("aria-hidden", "true");
    card.append(el("div", "skeleton poster-skeleton"), el("div", "skeleton title-skeleton"));
    grid.append(card);
  }
  return grid;
}

export function errorView(message, retry) {
  const view = el("section", "state error-state");
  view.append(el("p", "", message));
  const button = el("button", "button", "Reintentar");
  button.type = "button";
  button.addEventListener("click", retry);
  view.append(button);
  return view;
}
