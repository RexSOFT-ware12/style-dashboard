// Shared auth handler for signin.html and signup.html.

const ALLOWED_REDIRECTS = ["index.html", "inventory.html", "create-product.html", "reports.html", "docs.html"];

function redirectToDashboard() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  window.location.href = ALLOWED_REDIRECTS.includes(next) ? `./${next}` : "./index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // If already signed in, skip straight to the dashboard.
  if (window.FabricNowAPI.authToken() && (window.location.pathname.endsWith("signin.html") || window.location.pathname.endsWith("signup.html"))) {
    // Don't force-redirect automatically (user may want to switch accounts),
    // but no extra action needed here.
  }

  const signinForm = document.getElementById("signinForm");
  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      try {
        const { token, user } = await window.FabricNowAPI.signin({ email, password });
        window.FabricNowAPI.setAuthToken(token);
        window.FabricNowAPI.setCurrentUser(user);
        redirectToDashboard();
      } catch (err) {
        alert(err.message || "Sign in failed.");
      }
    });
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("fullName").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      try {
        const { token, user } = await window.FabricNowAPI.signup({ name, email, password });
        window.FabricNowAPI.setAuthToken(token);
        window.FabricNowAPI.setCurrentUser(user);
        redirectToDashboard();
      } catch (err) {
        alert(err.message || "Sign up failed.");
      }
    });
  }
});
