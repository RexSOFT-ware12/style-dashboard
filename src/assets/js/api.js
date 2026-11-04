/**
 * FabricNow API client — shared by every dashboard page.
 *
 * Set window.FABRICNOW_API_BASE before this script runs to point at a
 * different backend (e.g. a deployed URL). Defaults to local dev.
 */
const configuredApiBase =
  window.FABRICNOW_API_BASE ||
  import.meta.env.FABRICNOW_API_BASE ||
  "http://localhost:4000";
const API_BASE = `${configuredApiBase.replace(/\/+$/, "").replace(/\/api$/i, "")}/api`;

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

  // ZIP bytes upload directly to Cloudinary in signed chunks. The backend
  // keeps the API secret and only returns short-lived upload signatures.
  uploadDigitalFile: async (file, onProgress) => {
    if (!file || !file.name || !/\.zip$/i.test(file.name)) {
      throw new Error("Please choose a .zip file.");
    }
    const maxBytes = 200 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      throw new Error("The ZIP file must be between 1 byte and 200MB.");
    }

    const CHUNK_SIZE = 20 * 1024 * 1024;
    const getSignature = (publicId) =>
      apiRequest("/products/digital-file/upload-signature", {
        method: "POST",
        body: { originalName: file.name, publicId, size: file.size },
      }).then((response) => response.data);

    let signed = await getSignature();
    const publicId = signed.publicId;
    const uploadId = crypto.randomUUID();
    let finalAsset = null;
    let uploaded = 0;

    const uploadChunk = (start, end, signature) =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file.slice(start, end), file.name);
        formData.append("api_key", signature.apiKey);
        formData.append("timestamp", String(signature.timestamp));
        formData.append("signature", signature.signature);
        formData.append("public_id", signature.publicId);
        formData.append("type", signature.type);
        formData.append("filename_override", signature.filenameOverride);
        formData.append("overwrite", "false");
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${signature.cloudName}/raw/upload`, true);
        xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
        xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.min(99, Math.round(((start + event.loaded) / file.size) * 100)));
          }
        };
        xhr.onload = () => {
          let result;
          try {
            result = JSON.parse(xhr.responseText);
          } catch {
            result = null;
          }
          if (xhr.status >= 200 && xhr.status < 300) return resolve(result);
          reject(new Error(result?.error?.message || `Cloudinary upload failed (${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Upload connection failed. Please restart the ZIP upload."));
        xhr.ontimeout = () => reject(new Error("Upload timed out. Please restart the ZIP upload."));
        xhr.timeout = 0;
        xhr.send(formData);
      });

    while (uploaded < file.size) {
      const end = Math.min(uploaded + CHUNK_SIZE, file.size);
      signed = await getSignature(publicId);
      finalAsset = await uploadChunk(uploaded, end, signed);
      uploaded = end;
      if (onProgress) onProgress(Math.min(100, Math.round((uploaded / file.size) * 100)));
    }

    if (!finalAsset?.public_id || Number(finalAsset.bytes) !== file.size) {
      throw new Error("Cloudinary did not confirm the complete ZIP upload. Please try again.");
    }

    return { publicId: finalAsset.public_id, originalName: file.name, size: file.size };
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