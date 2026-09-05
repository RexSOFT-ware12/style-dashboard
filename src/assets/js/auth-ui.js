/**
 * Wires the topbar profile dropdown + sidebar "Account" section to real
 * auth state (window.FabricNowAPI), and handles logout. Included on every
 * dashboard page after api.js.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const api = window.FabricNowAPI;
  if (!api) return;

  const els = {
    topbarUserName: document.getElementById("topbarUserName"),
    topbarUserHandle: document.getElementById("topbarUserHandle"),
    topbarAccountSettingsLink: document.getElementById("topbarAccountSettingsLink"),
    topbarLoginLink: document.getElementById("topbarLoginLink"),
    topbarSignupLink: document.getElementById("topbarSignupLink"),
    topbarLogoutLink: document.getElementById("topbarLogoutLink"),
    sidebarLoginItem: document.getElementById("sidebarLoginItem"),
    sidebarSignupItem: document.getElementById("sidebarSignupItem"),
    sidebarUserItem: document.getElementById("sidebarUserItem"),
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarLogoutItem: document.getElementById("sidebarLogoutItem"),
  };

  function renderSignedOut() {
    if (els.topbarUserName) els.topbarUserName.textContent = "Guest";
    if (els.topbarUserHandle) els.topbarUserHandle.textContent = "Not signed in";
    if (els.topbarAccountSettingsLink) els.topbarAccountSettingsLink.hidden = true;
    if (els.topbarLoginLink) els.topbarLoginLink.hidden = false;
    if (els.topbarSignupLink) els.topbarSignupLink.hidden = false;
    if (els.topbarLogoutLink) els.topbarLogoutLink.hidden = true;

    if (els.sidebarLoginItem) els.sidebarLoginItem.hidden = false;
    if (els.sidebarSignupItem) els.sidebarSignupItem.hidden = false;
    if (els.sidebarUserItem) els.sidebarUserItem.hidden = true;
    if (els.sidebarLogoutItem) els.sidebarLogoutItem.hidden = true;
  }

  function renderSignedIn(user) {
    if (els.topbarUserName) els.topbarUserName.textContent = user.name || "Account";
    if (els.topbarUserHandle) els.topbarUserHandle.textContent = user.email || "";
    if (els.topbarAccountSettingsLink) els.topbarAccountSettingsLink.hidden = false;
    if (els.topbarLoginLink) els.topbarLoginLink.hidden = true;
    if (els.topbarSignupLink) els.topbarSignupLink.hidden = true;
    if (els.topbarLogoutLink) els.topbarLogoutLink.hidden = false;

    if (els.sidebarLoginItem) els.sidebarLoginItem.hidden = true;
    if (els.sidebarSignupItem) els.sidebarSignupItem.hidden = true;
    if (els.sidebarUserItem) els.sidebarUserItem.hidden = false;
    if (els.sidebarUserName) els.sidebarUserName.textContent = user.name || "Account";
    if (els.sidebarLogoutItem) els.sidebarLogoutItem.hidden = false;
  }

  function logout() {
    api.setAuthToken(null);
    api.setCurrentUser(null);
    window.location.href = "./signin.html";
  }

  if (els.topbarLogoutLink) els.topbarLogoutLink.addEventListener("click", (e) => { e.preventDefault(); logout(); });
  const sidebarLogoutLink = document.getElementById("sidebarLogoutLink");
  if (sidebarLogoutLink) sidebarLogoutLink.addEventListener("click", (e) => { e.preventDefault(); logout(); });

  const token = api.authToken();
  if (!token) {
    renderSignedOut();
    return;
  }

  // Show cached user immediately (avoids a flash of "Guest"), then confirm
  // the token is still valid against the server.
  const cachedUser = api.currentUser();
  if (cachedUser) renderSignedIn(cachedUser);
  else renderSignedOut();

  try {
    const { user } = await api.me();
    api.setCurrentUser(user);
    renderSignedIn(user);
  } catch (err) {
    // Token expired/invalid — clear it and fall back to signed-out state.
    api.setAuthToken(null);
    api.setCurrentUser(null);
    renderSignedOut();
  }
});
