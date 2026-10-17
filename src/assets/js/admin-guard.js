/**
 * Every admin page requires a valid session AND server-confirmed admin access.
 */
const api = window.FabricNowAPI;
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const allowlist = new Set(["index.html", "inventory.html", "create-product.html", "product-detail.html", "design-patterns.html", "taxonomies.html", "reports.html", "users.html", "provider-keys.html", "docs.html", "404-error.html"]);
function goToLogin() {
  const next = allowlist.has(currentPage) ? currentPage : "index.html";
  window.location.replace(`./signin.html?next=${encodeURIComponent(next)}`);
}
document.addEventListener("DOMContentLoaded", async () => {
  if (!api?.authToken()) { goToLogin(); return; }
  try {
    const results = await Promise.all([api.me(), api.adminOverview()]);
    if (results[0]?.user) api.setCurrentUser(results[0].user);
    document.body.classList.add("admin-ready");
  } catch (error) {
    api.setAuthToken(null);
    api.setCurrentUser(null);
    goToLogin();
  }
});
