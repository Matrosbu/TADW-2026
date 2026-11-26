const STORAGE_KEY = "dcic-user";
let currentUser = "usr_0001";

function isValidUser(value) {
  if (typeof value !== "string" || !/^usr_[0-9]{4}$/.test(value)) return false;
  const number = Number(value.slice(4));
  return number >= 1 && number <= 2000;
}

try {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (isValidUser(saved)) currentUser = saved;
} catch {
}

export function getUser() {
  return currentUser;
}

export function setUser(value) {
  if (!isValidUser(value)) return false;
  currentUser = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
  }
  document.dispatchEvent(new CustomEvent("userchange", { detail: { user: value } }));
  return true;
}
