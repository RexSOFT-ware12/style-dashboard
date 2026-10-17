/**
 * FabricNow API client — shared by every dashboard page.
 *
 * Set window.FABRICNOW_API_BASE before this script runs to point at a
 * different backend (e.g. a deployed URL). Defaults to local dev.
 */
const API_BASE =
  window.FABRICNOW_API_BASE ||
  import.meta.env.FABRICNOW_API_BASE ||
  "http://localhost:4000/api";

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
  getTaxonomies: () => apiRequest("/taxonomies"),
  getTaxonomiesManage: () => apiRequest("/taxonomies/manage"),
  createTaxonomy: (payload) => apiRequest("/taxonomies", { method: "POST", body: payload }),
  updateTaxonomy: (id, payload) => apiRequest(`/taxonomies/${id}`, { method: "PUT", body: payload }),
  deleteTaxonomy: (id) => apiRequest(`/taxonomies/${id}`, { method: "DELETE" }),
  createProduct: (formData) =>
    apiRequest("/products", { method: "POST", body: formData, isFormData: true }),
  updateProduct: (id, formData) =>
    apiRequest(`/products/${id}`, { method: "PUT", body: formData, isFormData: true }),
  deleteProduct: (id) => apiRequest(`/products/${id}`, { method: "DELETE" }),

  // Design Patterns — a Product under the hood (category: "Design
  // Patterns"), created/edited through their own dedicated endpoints so the
  // backend can trace the uploaded PNG into an SVG before saving.
  createDesignPattern: (formData) =>
    apiRequest("/products/design-patterns", { method: "POST", body: formData, isFormData: true }),
  updateDesignPattern: (id, formData) =>
    apiRequest(`/products/design-patterns/${id}`, { method: "PUT", body: formData, isFormData: true }),

  // Digital file — resumable direct-to-GCS upload.
  // The API only creates the upload session; the ZIP bytes go directly from
  // the browser to GCS in 16MB chunks. This avoids App Engine's 32MB request
  // limit and lets us retry/resume individual chunks on flaky connections.
  // IMPORTANT: this is NOT a time-limited signed URL. The returned session URI
  // is used only until this particular upload finishes. Customer downloads are
  // still permanently available through the authenticated order endpoint.
  uploadDigitalFile: async (file, onProgress) => {
    if (!file || !file.name || !/\.zip$/i.test(file.name)) {
      throw new Error("Please choose a .zip file.");
    }
    const maxBytes = 1000 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      throw new Error("The ZIP file must be between 1 byte and 1000MB.");
    }

    const contentType = file.type || "application/zip";
    const { data } = await apiRequest("/products/digital-file/resumable-upload", {
      method: "POST",
      body: { originalName: file.name, contentType, size: file.size },
    });

    const sessionUrl = data.uploadUrl;
    const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB — reliable without huge browser buffers
    const MAX_RETRIES = 5;

    const xhrRequest = (method, url, body, headers = {}) =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(new Error("Upload connection failed. Please retry."));
        xhr.ontimeout = () => reject(new Error("Upload timed out. Please retry."));
        xhr.timeout = 0; // Large files may legitimately take a long time.
        xhr.send(body);
      });

    const queryOffset = async () => {
      const xhr = await xhrRequest("PUT", sessionUrl, null, {
        "Content-Range": `bytes */${file.size}`,
      });
      if (xhr.status === 308) {
        const range = xhr.getResponseHeader("Range");
        if (!range) return 0;
        const match = /bytes=0-(\d+)/i.exec(range);
        return match ? Number(match[1]) + 1 : 0;
      }
      if (xhr.status >= 200 && xhr.status < 300) return file.size;
      throw new Error(`Could not resume upload (${xhr.status})`);
    };

    let uploaded = 0;
    while (uploaded < file.size) {
      const end = Math.min(uploaded + CHUNK_SIZE, file.size) - 1;
      const chunk = file.slice(uploaded, end + 1);
      let completed = false;

      for (let attempt = 0; attempt <= MAX_RETRIES && !completed; attempt += 1) {
        try {
          const xhr = await xhrRequest("PUT", sessionUrl, chunk, {
            "Content-Type": contentType,
            "Content-Range": `bytes ${uploaded}-${end}/${file.size}`,
          });

          if (xhr.status === 308) {
            const range = xhr.getResponseHeader("Range");
            const match = range && /bytes=0-(\d+)/i.exec(range);
            const nextOffset = match ? Number(match[1]) + 1 : end + 1;
            uploaded = Math.max(uploaded, nextOffset);
            completed = true;
          } else if (xhr.status >= 200 && xhr.status < 300) {
            uploaded = file.size;
            completed = true;
          } else if (xhr.status >= 500) {
            throw new Error(`Temporary storage error (${xhr.status})`);
          } else {
            throw new Error(`Upload to storage failed (${xhr.status})`);
          }
        } catch (error) {
          if (attempt >= MAX_RETRIES) throw error;
          // If the response was lost after GCS accepted the bytes, asking GCS
          // for its current offset prevents us from duplicating a chunk.
          try {
            uploaded = await queryOffset();
            if (uploaded >= file.size) completed = true;
            else if (uploaded > end) completed = true;
          } catch {
            // Brief backoff, then retry the same chunk.
            await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
          }
        }
      }

      if (onProgress) onProgress(Math.min(100, Math.round((uploaded / file.size) * 100)));
    }

    return { objectName: data.objectName, originalName: file.name, size: file.size };
  },

  // Auth
  signin: (payload) => apiRequest("/auth/signin", { method: "POST", body: payload }),
  me: () => apiRequest("/auth/me"),

  // Stats
  getStats: () => apiRequest("/stats"),

  // Admin (the server rejects these unless the signed-in user is an admin)
  adminOverview: () => apiRequest("/admin/overview"),
  adminListUsers: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))).toString();
    return apiRequest(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  adminGetUser: (id) => apiRequest(`/admin/users/${id}`),
  adminBlockUser: (id, reason) => apiRequest(`/admin/users/${id}/block`, { method: "POST", body: { reason } }),
  adminUnblockUser: (id) => apiRequest(`/admin/users/${id}/unblock`, { method: "POST", body: {} }),
  adminMarkApiPaid: (id, payload) => apiRequest(`/admin/users/${id}/api-subscription`, { method: "POST", body: payload }),
  adminAdjustApiCredits: (id, payload) => apiRequest(`/admin/users/${id}/api-credits`, { method: "POST", body: payload }),
  adminCancelApiPlan: (id) => apiRequest(`/admin/users/${id}/api-subscription/cancel`, { method: "POST", body: {} }),
  adminListCompanies: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))).toString();
    return apiRequest(`/admin/companies${qs ? `?${qs}` : ""}`);
  },
  adminListProviderKeys: () => apiRequest("/admin/provider-keys"),
  adminSetProviderKey: (name, value) => apiRequest(`/admin/provider-keys/${encodeURIComponent(name)}`, { method: "PUT", body: { value } }),
  adminClearProviderKey: (name) => apiRequest(`/admin/provider-keys/${encodeURIComponent(name)}`, { method: "DELETE" }),
  adminTestProviderKey: (name, value) => apiRequest(`/admin/provider-keys/${encodeURIComponent(name)}/test`, { method: "POST", body: { value } }),
  adminAudit: (limit = 30) => apiRequest(`/admin/audit?limit=${limit}`),

  // Local session helpers
  authToken,
  setAuthToken,
  currentUser,
  setCurrentUser,
};

window.FabricNowAPI = FabricNowAPI;