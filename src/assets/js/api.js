/**
 * FabricNow API client — shared by every dashboard page.
 *
 * Set window.FABRICNOW_API_BASE before this script runs to point at a
 * different backend (e.g. a deployed URL). Defaults to local dev.
 */
const API_BASE =
  window.FABRICNOW_API_BASE || "http://localhost:4000/api";

function authToken() {
  return localStorage.getItem("fabricnow_token");
}

function setAuthToken(token) {
  if (token) localStorage.setItem("fabricnow_token", token);
  else localStorage.removeItem("fabricnow_token");
}

function currentUser() {
  const raw = localStorage.getItem("fabricnow_user");
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  if (user) localStorage.setItem("fabricnow_user", JSON.stringify(user));
  else localStorage.removeItem("fabricnow_user");
}

async function apiRequest(path, { method = "GET", body, isFormData = false } = {}) {
  const headers = {};
  const token = authToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

const FabricNowAPI = {
  // Products
  listProducts: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
    ).toString();
    return apiRequest(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (id) => apiRequest(`/products/${id}`),
  getMeta: () => apiRequest("/products/meta"),
  createProduct: (formData) =>
    apiRequest("/products", { method: "POST", body: formData, isFormData: true }),
  updateProduct: (id, formData) =>
    apiRequest(`/products/${id}`, { method: "PUT", body: formData, isFormData: true }),
  deleteProduct: (id) => apiRequest(`/products/${id}`, { method: "DELETE" }),
  adjustStock: (id, payload) =>
    apiRequest(`/products/${id}/stock`, { method: "PATCH", body: payload }),

  // Auth
  signup: (payload) => apiRequest("/auth/signup", { method: "POST", body: payload }),
  signin: (payload) => apiRequest("/auth/signin", { method: "POST", body: payload }),
  me: () => apiRequest("/auth/me"),

  // Stats
  getStats: () => apiRequest("/stats"),

  // Local session helpers
  authToken,
  setAuthToken,
  currentUser,
  setCurrentUser,
};

window.FabricNowAPI = FabricNowAPI;
