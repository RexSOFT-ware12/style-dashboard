// Handles the "Add/Edit Product" form on create-product.html.
// If the URL has ?id=<productId>, this loads that product and switches the
// page into edit mode (PUT /api/products/:id) instead of create mode
// (POST /api/products).

function showAlert(message, type = "danger") {
  const alertBox = document.getElementById("formAlert");
  if (!alertBox) return;
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove("d-none");
}

function hideAlert() {
  const alertBox = document.getElementById("formAlert");
  if (alertBox) alertBox.classList.add("d-none");
}


async function loadTaxonomyOptions(selected = {}) {
  const api = window.FabricNowAPI;
  const selectMap = {
    category: document.getElementById("productCategory"),
    style: document.getElementById("productStyle"),
    fabric: document.getElementById("productFabric"),
  };

  const pluralKey = {
    category: "categories",
    style: "styles",
    fabric: "fabrics",
  };
  try {
    const data = await api.getTaxonomies();
    for (const [type, select] of Object.entries(selectMap)) {
      if (!select) continue;
      const key = pluralKey[type] || `${type}s`;
      const values = data[key] || data[type] || data.data?.[key] || [];
      select.innerHTML = `<option value="">Select ${type}</option>` + values
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join("");
      if (selected[type]) select.value = selected[type];
    }
  } catch (err) {
    for (const [type, select] of Object.entries(selectMap)) {
      if (select) select.innerHTML = `<option value="">Could not load ${type}s</option>`;
    }
    showAlert(err.message || "Could not load catalog options.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEditId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function fillFormFromProduct(product) {
  document.getElementById("productName").value = product.name || "";
  document.getElementById("productSKU").value = product.sku || "";
  document.getElementById("productPrice").value = product.price ?? "";
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("productBrand").value = product.brand || "FabricNow";
  document.getElementById("productStyle").value = product.style || "";
  document.getElementById("productFabric").value = product.fabric || "";
  document.getElementById("productColor").value = product.color || "";
  document.getElementById("productDescription").value = product.description || "";
  document.getElementById("productPinterestUrl").value = product.pinterestUrl || "";

  const heroImages =
    Array.isArray(product.heroImages) && product.heroImages.length
      ? product.heroImages
      : product.image
      ? [product.image]
      : [];
  if (heroImages.length) {
    const preview = document.getElementById("currentImagePreview");
    if (preview) {
      preview.innerHTML = heroImages
        .map(
          (src) =>
            `<img src="${src}" alt="" style="width:64px; height:64px; object-fit:cover;" class="rounded border">`
        )
        .join("");
      preview.classList.remove("d-none");
    }
  }
  document.getElementById("imageHelpText").textContent =
    "Upload 1 or more to replace the current set — leave blank to keep it.";

  if (product.fabricImage) {
    const preview = document.getElementById("currentFabricImagePreview");
    const thumb = document.getElementById("currentFabricImageThumb");
    if (preview && thumb) {
      thumb.src = product.fabricImage;
      preview.classList.remove("d-none");
    }
  }
  document.getElementById("fabricImageHelpText").textContent =
    "Optional — leave blank to keep the current fabric photo.";

  if (Array.isArray(product.images) && product.images.length) {
    const galleryPreview = document.getElementById("currentGalleryPreview");
    if (galleryPreview) {
      galleryPreview.innerHTML = product.images
        .map(
          (src) =>
            `<img src="${src}" alt="" style="width:64px; height:64px; object-fit:cover;" class="rounded border">`
        )
        .join("");
      galleryPreview.classList.remove("d-none");
      galleryPreview.classList.add("d-flex");
    }
  }
  document.getElementById("galleryHelpText").textContent =
    "Optional — up to 6 photos. Uploading new files here replaces the whole gallery shown above; leave blank to keep it.";

  const digitalNote = document.getElementById("currentDigitalFileNote");
  if (digitalNote) {
    digitalNote.textContent = product.hasDigitalFile
      ? `Current file: ${product.digitalFile?.originalName || "attached"}. Leave blank to keep it.`
      : "No digital file attached yet.";
    digitalNote.classList.remove("d-none");
  }
  document.getElementById("digitalFileHelpText").textContent =
    "Leave blank to keep the current file, or choose a new .zip to replace it. Up to 1000MB.";
}

document.addEventListener("DOMContentLoaded", async () => {
  // This page only ever does authenticated writes (POST/PUT /api/products) —
  // send anyone who isn't signed in straight to signin.html instead of
  // letting them fill out a form that will just 401 on submit.
  if (window.FabricNowAPI && !window.FabricNowAPI.authToken()) {
    const next = getEditId()
      ? `create-product.html?id=${encodeURIComponent(getEditId())}`
      : "create-product.html";
    window.location.href = `./signin.html?next=${encodeURIComponent(next)}`;
    return;
  }

  const form = document.getElementById("addProductForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn");
  const editId = getEditId();
  const isEditMode = Boolean(editId);

  let existingProduct = null;
  try {
    if (isEditMode) {
      const { data: product } = await window.FabricNowAPI.getProduct(editId);
      existingProduct = product;
    }
    await loadTaxonomyOptions(existingProduct ? {
      category: existingProduct.category,
      style: existingProduct.style,
      fabric: existingProduct.fabric,
    } : {});
  } catch (err) {
    if (isEditMode) {
      showAlert(err.message || "Could not load this product for editing.");
      submitBtn.disabled = true;
      return;
    }
  }

  if (isEditMode) {
    document.getElementById("pageTitle").textContent = "Edit Product";
    document.getElementById("pageSubtitle").textContent = "Update this product's details";
    submitBtn.textContent = "Update Product";

    try {
      fillFormFromProduct(existingProduct);
    } catch (err) {
      showAlert(err.message || "Could not load this product for editing.");
      submitBtn.disabled = true;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const imageInput = document.getElementById("productImage");
    const imageFiles = imageInput.files ? Array.from(imageInput.files) : [];
    const hasFile = imageFiles.length > 0;

    const fabricImageInput = document.getElementById("productFabricImage");
    const hasFabricImage = fabricImageInput.files && fabricImageInput.files.length > 0;

    const galleryInput = document.getElementById("productGalleryImages");
    const galleryFiles = galleryInput.files ? Array.from(galleryInput.files) : [];

    const digitalFileInput = document.getElementById("productDigitalFile");
    const hasDigitalFile = digitalFileInput.files && digitalFileInput.files.length > 0;

    const fields = {
      name: document.getElementById("productName").value.trim(),
      sku: document.getElementById("productSKU").value.trim(),
      price: document.getElementById("productPrice").value,
      category: document.getElementById("productCategory").value,
      brand: document.getElementById("productBrand").value.trim() || "FabricNow",
      style: document.getElementById("productStyle").value,
      fabric: document.getElementById("productFabric").value,
      color: document.getElementById("productColor").value.trim(),
      description: document.getElementById("productDescription").value.trim(),
      pinterestUrl: document.getElementById("productPinterestUrl").value.trim(),
    };

    if (!fields.name || !fields.price || !fields.category || !fields.style || !fields.fabric) {
      showAlert("Please fill in all required fields (name, price, category, style, fabric).");
      return;
    }

    // A digital file is only mandatory when creating a brand-new product —
    // in edit mode the existing one is kept unless a new .zip is chosen.
    if (!isEditMode && !hasDigitalFile) {
      showAlert("Please attach the .zip file customers will download after purchase (it should include the .zprj and any related assets).");
      return;
    }

    submitBtn.disabled = true;

    const progressWrap = document.getElementById("digitalFileProgressWrap");
    const progressBar = document.getElementById("digitalFileProgressBar");
    const progressText = document.getElementById("digitalFileProgressText");

    try {
      if (!window.FabricNowAPI.authToken()) {
        showAlert(
          "You're not signed in. Sign in first, or the request will be rejected by the API.",
          "warning"
        );
      }

      // Large .zip bundles are uploaded straight to cloud storage first —
      // this request never carries the file's bytes, which is what lets it
      // go up to ~1000MB without hitting the API's own request-size limit.
      let digitalFileGcs = null;
      if (hasDigitalFile) {
        submitBtn.textContent = "Uploading file...";
        progressWrap?.classList.remove("d-none");
        progressText?.classList.remove("d-none");
        digitalFileGcs = await window.FabricNowAPI.uploadDigitalFile(
          digitalFileInput.files[0],
          (percent) => {
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressText) progressText.textContent = `Uploading ${digitalFileInput.files[0].name} — ${percent}%`;
          }
        );
      }

      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
      if (hasFile) imageFiles.forEach((file) => formData.append("image", file));
      if (hasFabricImage) formData.append("fabricImage", fabricImageInput.files[0]);
      galleryFiles.forEach((file) => formData.append("images", file));
      if (digitalFileGcs) formData.append("digitalFileGcs", JSON.stringify(digitalFileGcs));

      submitBtn.textContent = isEditMode ? "Updating..." : "Adding...";
      progressWrap?.classList.add("d-none");
      progressText?.classList.add("d-none");

      if (isEditMode) {
        await window.FabricNowAPI.updateProduct(editId, formData);
        showAlert("Product updated successfully.", "success");
      } else {
        await window.FabricNowAPI.createProduct(formData);
        showAlert("Product added successfully! It's now live on the storefront.", "success");
        form.reset();
      }
    } catch (err) {
      showAlert(err.message || "Something went wrong while saving the product.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isEditMode ? "Update Product" : "Add Product";
      progressWrap?.classList.add("d-none");
      progressText?.classList.add("d-none");
    }
  });
});