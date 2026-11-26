import { el } from "../dom.js";
import { getUser, setUser } from "../user.js";

export function createUserSelector() {
  const wrapper = el("div", "user-selector");
  const label = el("label", "", "Usuario");
  const input = el("input", "user-input");
  input.id = "active-user";
  input.type = "text";
  input.setAttribute("list", "user-options");
  input.value = getUser();
  label.htmlFor = input.id;

  const datalist = el("datalist");
  datalist.id = "user-options";
  for (let number = 1; number <= 2000; number += 1) {
    const option = el("option");
    option.value = `usr_${String(number).padStart(4, "0")}`;
    datalist.append(option);
  }

  const message = el("p", "user-message");
  message.setAttribute("aria-live", "polite");

  input.addEventListener("change", () => {
    if (!setUser(input.value)) {
      message.textContent = "Usuario inválido";
      input.value = getUser();
      return;
    }
    message.textContent = "";
  });

  wrapper.append(label, input, datalist, message);
  return wrapper;
}
