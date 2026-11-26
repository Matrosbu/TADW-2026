import { getStatus } from "./api.js";
import { el, clear } from "./dom.js";

let currentStatus = null;
let timer = null;

export function getSystemStatus() {
  return currentStatus;
}

function setBannerMessage(container, status, readyMessage = false) {
  clear(container);
  if (!status) {
    container.hidden = false;
    container.append(el("span", "", "Verificando el estado del sistema…"));
    return;
  }

  if (readyMessage) {
    container.hidden = false;
    container.append(el("span", "", "¡Listo! Ya podés valorar películas."));
    window.setTimeout(() => {
      container.hidden = true;
      clear(container);
    }, 6000);
    return;
  }

  container.hidden = false;
  if (status.phase === "curating") {
    container.append(el("span", "", "Estamos limpiando y validando los datos del catálogo. Podés explorar el catálogo y leer reseñas; las recomendaciones y las nuevas valoraciones se habilitan al terminar."));
    if (typeof status.cleaning?.step === "string" && status.cleaning.step) {
      container.append(el("span", "", `Paso: ${status.cleaning.step}`));
    }
    const progress = status.cleaning?.progress;
    if (progress && Number.isInteger(progress.done) && progress.done >= 0 && Number.isInteger(progress.total) && progress.total > 0) {
      const progressElement = el("progress", "status-progress");
      progressElement.max = progress.total;
      progressElement.value = progress.done;
      container.append(progressElement, el("span", "", `${progress.done} de ${progress.total}`));
    }
  } else if (status.phase === "indexing") {
    container.append(el("span", "", "Los datos ya están limpios. Estamos preparando el motor de recomendaciones; las valoraciones se habilitan en un momento."));
  } else {
    container.hidden = true;
  }
}

export function startStatusPoll(container) {
  let stopped = false;
  let querying = false;

  setBannerMessage(container, null);

  async function poll() {
    if (querying) return;
    querying = true;
    try {
      const nextStatus = await getStatus();
      const previousStatus = currentStatus;
      currentStatus = nextStatus;

      if (previousStatus && previousStatus.phase !== "ready" && nextStatus.phase === "ready") {
        setBannerMessage(container, nextStatus, true);
        document.dispatchEvent(new CustomEvent("systemready"));
      } else {
        setBannerMessage(container, nextStatus);
      }

      document.dispatchEvent(new CustomEvent("systemstatus", { detail: { status: nextStatus } }));

      if (nextStatus.phase === "ready") {
        stopped = true;
        if (timer) window.clearTimeout(timer);
        timer = null;
        return;
      }
    } catch {
      clear(container);
      container.hidden = false;
      container.append(el("span", "", "No se pudo consultar el estado del sistema. Reintentando…"));
      document.dispatchEvent(new CustomEvent("systemstatus", { detail: { status: currentStatus } }));
    } finally {
      querying = false;
    }

    if (!stopped) timer = window.setTimeout(poll, 4000);
  }

  poll();

  return {
    refresh() {
      if (querying) return;
      stopped = false;
      if (timer) window.clearTimeout(timer);
      timer = null;
      poll();
    },
  };
}
