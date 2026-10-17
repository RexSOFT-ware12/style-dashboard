// Admin sign-in only. Public account registration is intentionally unavailable.
const ALLOWED_REDIRECTS = ["index.html", "inventory.html", "create-product.html", "product-detail.html", "reports.html", "docs.html", "taxonomies.html", "design-patterns.html", "users.html", "provider-keys.html"];
function redirectToDashboard() {
  const next = new URLSearchParams(window.location.search).get("next");
  window.location.replace(`./${ALLOWED_REDIRECTS.includes(next) ? next : "index.html"}`);
}
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signinForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const button = form.querySelector('button[type="submit"]');
    const originalText = button?.textContent;
    if (button) { button.disabled = true; button.textContent = "Signing in…"; }
    try {
      const { token, user } = await window.FabricNowAPI.signin({ email, password });
      window.FabricNowAPI.setAuthToken(token);
      window.FabricNowAPI.setCurrentUser(user);
      await window.FabricNowAPI.adminOverview();
      redirectToDashboard();
    } catch (error) {
      window.FabricNowAPI.setAuthToken(null);
      window.FabricNowAPI.setCurrentUser(null);
      let alert = document.getElementById("signinError");
      if (!alert) {
        alert = document.createElement("div");
        alert.id = "signinError";
        alert.className = "alert alert-danger mt-3";
        form.append(alert);
      }
      alert.textContent = error.message || "Sign in failed. Use an authorized admin account.";
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText || "Sign in"; }
    }
  });
});
