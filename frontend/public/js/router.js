export function installRouter(render) {
  function navigate(path) {
    if (window.location.pathname === "/" && path.startsWith("/movie/")) {
      const catalogUrl = window.location.pathname + window.location.search;
      window.history.replaceState({ catalogUrl }, "", catalogUrl);
      window.history.pushState({ catalogUrl }, "", path);
    } else if (window.location.pathname + window.location.search + window.location.hash !== path) {
      window.history.pushState({}, "", path);
    }
    render();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-link]");
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  });

  window.addEventListener("popstate", render);
  render();
}

export function currentRoute() {
  const match = window.location.pathname.match(/^\/movie\/([0-9A-Fa-f]{24})$/);
  if (match) return { name: "movie", id: match[1] };
  if (window.location.pathname === "/") return { name: "catalog" };
  return { name: "not-found" };
}
