// Small helpers shared by the admin pages (users.js, provider-keys.js).

export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtNum = (n) => (n == null ? "∞" : Number(n).toLocaleString());

export function showAlert(message, type = "danger") {
  const box = document.getElementById("adminAlert");
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = message;
  box.classList.remove("d-none");
  if (type === "success") setTimeout(() => box.classList.add("d-none"), 5000);
}

/**
 * Every admin page starts here: must be signed in, and the server must agree
 * the account is an admin (the menu links alone prove nothing). Returns true
 * when the page may continue loading.
 */
export async function requireAdminPage(page) {
  const api = window.FabricNowAPI;
  if (!api?.authToken()) {
    window.location.href = `./signin.html?next=${encodeURIComponent(page)}`;
    return false;
  }
  try {
    await api.adminOverview();
    return true;
  } catch (err) {
    const main = document.querySelector("main .container-fluid");
    if (main) {
      main.innerHTML = `<div class="alert alert-warning mt-4">
        <h2 class="h5">Admin access required</h2>
        <p class="mb-0">${esc(err.message || "You don't have access to this page.")} Sign in with an admin account, or ask the site owner to make you an admin.</p>
      </div>`;
    }
    return false;
  }
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
