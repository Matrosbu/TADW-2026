import { getUser } from "../user.js";
import { postInteraction } from "../api.js";
import { el } from "../dom.js";
import { getSystemStatus } from "../status.js";

export function createReviewForm(movieId, refreshReviews) {
  const section = el("section", "review-form-section");
  section.append(el("h2", "section-heading", "Tu reseña"));

  const label = el("p", "reviewing-as");
  function updateUserLabel() {
    label.textContent = `Valorando como ${getUser()}`;
  }
  updateUserLabel();

  section.append(label, el("p", "review-replacement", "Si ya valoraste esta película, tu nueva reseña reemplaza a la anterior."));

  const form = el("form", "review-form");
  const fieldset = el("fieldset", "review-fieldset");
  const ratingFieldset = el("fieldset", "rating-fieldset");
  ratingFieldset.append(el("legend", "", "Puntaje"));

  const ratingGroup = el("div", "star-rating");
  for (let rating = 5; rating >= 1; rating -= 1) {
    const radio = el("input", "star-radio");
    radio.type = "radio";
    radio.name = "rating";
    radio.id = `rating-${rating}-${movieId}`;
    radio.value = String(rating);
    radio.setAttribute("aria-label", `${rating} de 5`);
    const star = el("label", "star-label", "★");
    star.htmlFor = radio.id;
    ratingGroup.append(radio, star);
  }
  ratingFieldset.append(ratingGroup);
  fieldset.append(ratingFieldset);

  const ratingError = el("p", "field-error");
  ratingError.setAttribute("aria-live", "polite");
  ratingFieldset.append(ratingError);

  const commentLabel = el("label", "comment-label", "Comentario");
  commentLabel.htmlFor = `comment-${movieId}`;
  const textarea = el("textarea", "review-comment-input");
  textarea.id = `comment-${movieId}`;
  textarea.maxLength = 1000;
  textarea.rows = 5;
  const counter = el("p", "comment-counter", "0/1000");
  const commentError = el("p", "field-error");
  commentError.setAttribute("aria-live", "polite");
  textarea.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length}/1000`;
  });
  fieldset.append(commentLabel, textarea, counter, commentError);

  const submit = el("button", "button", "Enviar reseña");
  submit.type = "submit";
  fieldset.append(submit);
  form.append(fieldset);

  const disabledMessage = el("p", "review-disabled-message", "Las valoraciones se habilitan cuando termine la preparación de los datos.");
  disabledMessage.setAttribute("aria-live", "polite");
  const formMessage = el("p", "form-message");
  formMessage.setAttribute("aria-live", "polite");
  section.append(form, disabledMessage, formMessage);

  function updateStatus(event) {
    const status = event?.detail?.status || getSystemStatus();
    const ready = status?.phase === "ready";
    fieldset.disabled = !ready;
    disabledMessage.hidden = ready;
  }
  updateStatus();

  document.addEventListener("systemstatus", updateStatus);
  document.addEventListener("userchange", updateUserLabel);

  const listenerObserver = new MutationObserver(() => {
    if (!section.isConnected) {
      document.removeEventListener("systemstatus", updateStatus);
      document.removeEventListener("userchange", updateUserLabel);
      listenerObserver.disconnect();
    }
  });
  listenerObserver.observe(document.body, { childList: true, subtree: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    ratingError.textContent = "";
    commentError.textContent = "";
    formMessage.textContent = "";

    const selected = form.querySelector('input[name="rating"]:checked');
    const comment = textarea.value.trim();
    let valid = true;
    if (!selected) {
      ratingError.textContent = "Elegí un puntaje";
      valid = false;
    }
    if (!comment) {
      commentError.textContent = "Escribí un comentario";
      valid = false;
    }
    if (!valid) return;

    const userId = getUser();
    submit.disabled = true;
    fieldset.disabled = true;
    try {
      await postInteraction({
        user_id: userId,
        movie_id: movieId,
        rating: Number(selected.value),
        comment,
      });
      formMessage.textContent = "¡Gracias! Tu reseña fue enviada y aparecerá en unos segundos.";
      form.reset();
      counter.textContent = "0/1000";

      let found = false;
      try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          found = await refreshReviews(userId, comment);
          if (found) break;
        }
      } catch {
        found = false;
      }
      if (!found) {
        formMessage.textContent = "Todavía se está procesando; actualizá en unos segundos.";
      }
    } catch (error) {
      if (error.status === 400 || error.status === 503) {
        formMessage.textContent = error.message;
      } else {
        formMessage.textContent = "No se pudo enviar la reseña. Probá de nuevo.";
      }
      if (error.status === 503) {
        document.dispatchEvent(new CustomEvent("refreshstatus"));
      }
    } finally {
      submit.disabled = false;
      updateStatus();
    }
  });

  return section;
}
