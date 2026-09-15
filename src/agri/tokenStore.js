// The admin token is never hard-coded here. It is typed in by the admin at
// runtime (see AdminDashboard.jsx) and kept only in memory + sessionStorage,
// so it never ends up committed to source and disappears when the tab closes.

const SESSION_KEY = "agri_admin_token";

let memoryToken = null;

export function getToken() {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(SESSION_KEY) || null;
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function setToken(token) {
  memoryToken = token || null;
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage unavailable (private mode etc.) — memory only, fine.
  }
}

export function clearToken() {
  setToken(null);
}