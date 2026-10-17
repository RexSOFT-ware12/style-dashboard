// Drives design-patterns.html: the "Add Design Pattern" form (create + edit,
// in one page — clicking "Edit" in the table below loads that item into the
// same form instead of navigating anywhere) and the list of existing Design
// Patterns. Uses FabricNowAPI.createDesignPattern/updateDesignPattern
// (style-backend routes/products.js -> POST|PUT /products/design-patterns)
// which trace an uploaded PNG into an SVG server-side, plus the same
// listProducts/deleteProduct/uploadDigitalFile helpers every other product
// page already uses.

const DESIGN_PATTERN_CATEGORY = "Design Patterns";

function formatPrice(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function renderRow(product) {
  const digitalNote = product.hasDigitalFile
    ? escapeHtml(product.digitalFile?.originalName || "attached")
    : '<span class="text-secondary">None</span>';

  return `
    <tr class="align-middle" data-id="${product.id}">
      <td>
        <img src="${escapeHtml(product.image)}" alt=""
          style="width:48px; height:48px; object-fit:contain; background:#f5f5f5;"
          class="rounded border" onerror="this.style.opacity=0.3" />
      </td>
      <td>${escapeHtml(product.name)}</td>
      <td>${formatPrice(product.price)}</td>
      <td>${digitalNote}</td>
      <td class="text-end">
        <a href="../product-detail.html?id=${encodeURIComponent(product.id)}" class="link-secondary" title="View details">
          <i class="ti ti-eye"></i>
        </a>
        <a href="#" class="link-primary ms-2 edit-pattern" data-id="${product.id}" title="Edit">
          <i class="ti ti-edit"></i>
        </a>
        <a href="#" class="link-danger ms-2 delete-pattern" data-id="${product.id}" title="Delete">
          <i class="ti ti-trash"></i>
        </a>
      </td>
    </tr>
  `;
}

async function loadPatterns() {
  const tbody = document.getElementById("patternsTableBody");
  const countEl = document.getElementById("patternCount");
  tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-4">Loading design patterns…</td></tr>`;

  try {
    const { data, pagination } = await window.FabricNowAPI.listProducts({
      category: DESIGN_PATTERN_CATEGORY,
      limit: 100,
    });

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-4">No design patterns yet — add one above.</td></tr>`;
    } else {
      tbody.innerHTML = data.map(renderRow).join("");
    }
    if (countEl) countEl.textContent = pagination ? `(${pagination.total})` : "";
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${escapeHtml(err.message || "Could not load design patterns.")}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // This page only ever does authenticated writes — send anyone who isn't
  // signed in straight to sign-in instead of letting them fill out a form
  // that will just 401 on submit.
  if (window.FabricNowAPI && !window.FabricNowAPI.authToken()) {
    window.location.href = `./signin.html?next=${encodeURIComponent("design-patterns.html")}`;
    return;
  }

  const form = document.getElementById("addDesignPatternForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  let editId = null; // non-null while editing an existing design pattern

  function resetToCreateMode() {
    editId = null;
    form.reset();
    pageTitle.textContent = "Add Design Pattern";
    pageSubtitle.textContent =
      "Upload artwork and it's automatically traced into a clean SVG for the storefront — same price/description/.zip-download flow as a regular product.";
    submitBtn.textContent = "Add Design Pattern";
    cancelEditBtn.hidden = true;
    document.getElementById("currentImagePreview").classList.add("d-none");
    document.getElementById("currentDigitalFileNote").classList.add("d-none");    document.getElementById("imageHelpText").textContent =
      "Upload the source PNG. It's traced into an SVG automatically (deterministic bitmap tracing, not AI) and that SVG is what's shown as the product card image and on the product detail page. Works best on flat-color / line-art artwork; photographic images will come out posterized.";
    document.getElementById("digitalFileHelpText").textContent =
      "Leave this blank — the .zip customers download is built automatically from the artwork you upload above (the original image + the traced SVG). Only attach a file here if you want to override that with your own custom .zip.";
  }

  function enterEditMode(product) {
    editId = product.id;
    document.getElementById("patternName").value = product.name || "";
    document.getElementById("patternPrice").value = product.price ?? "";
    document.getElementById("patternDescription").value = product.description || "";
    document.getElementById("patternPinterestUrl").value = product.pinterestUrl || "";

    if (product.image) {
      const preview = document.getElementById("currentImagePreview");
      const thumb = document.getElementById("currentImageThumb");
      thumb.src = product.image;
      preview.classList.remove("d-none");
    }
    document.getElementById("imageHelpText").textContent =
      "Optional — leave blank to keep the current SVG, or choose a new PNG to re-trace and replace it.";

    const digitalNote = document.getElementById("currentDigitalFileNote");
    digitalNote.textContent = product.hasDigitalFile
      ? `Current file: ${product.digitalFile?.originalName || "attached"}. Leave blank to keep it.`
      : "No digital file attached yet.";
    digitalNote.classList.remove("d-none");
    document.getElementById("digitalFileHelpText").textContent =
      "Leave blank to keep the current file. Uploading a new image and no .zip here re-bundles it automatically; uploading your own .zip overrides that.";

    pageTitle.textContent = "Edit Design Pattern";
    pageSubtitle.textContent = `Editing "${product.name}"`;
    submitBtn.textContent = "Update Design Pattern";
    cancelEditBtn.hidden = false;
    hideAlert();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  cancelEditBtn.addEventListener("click", () => {
    resetToCreateMode();
    hideAlert();
  });

  // Row actions (delegated — rows are re-rendered on every load).
  document.getElementById("patternsTableBody").addEventListener("click", async (e) => {
    const editLink = e.target.closest(".edit-pattern");
    const deleteLink = e.target.closest(".delete-pattern");

    if (editLink) {
      e.preventDefault();
      const id = editLink.dataset.id;
      try {
        const { data: product } = await window.FabricNowAPI.getProduct(id);
        enterEditMode(product);
      } catch (err) {
        showAlert(err.message || "Could not load this design pattern for editing.");
      }
      return;
    }

    if (deleteLink) {
      e.preventDefault();
      const id = deleteLink.dataset.id;
      if (!window.confirm("Delete this design pattern? This can't be undone.")) return;
      try {
        await window.FabricNowAPI.deleteProduct(id);
        if (editId === id) resetToCreateMode();
        await loadPatterns();
      } catch (err) {
        showAlert(err.message || "Could not delete this design pattern.");
      }
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const isEditMode = Boolean(editId);
    const imageInput = document.getElementById("patternImage");
    const hasImage = imageInput.files && imageInput.files.length > 0;

    const digitalFileInput = document.getElementById("patternDigitalFile");
    const hasDigitalFile = digitalFileInput.files && digitalFileInput.files.length > 0;

    const name = document.getElementById("patternName").value.trim();
    const price = document.getElementById("patternPrice").value;
    const description = document.getElementById("patternDescription").value.trim();
    const pinterestUrl = document.getElementById("patternPinterestUrl").value.trim();

    if (!name || !price) {
      showAlert("Please fill in the name and price.");
      return;
    }
    if (!isEditMode && !hasImage) {
      showAlert("Please upload the PNG artwork to trace into an SVG.");
      return;
    }

    submitBtn.disabled = true;
    const convertingNote = document.getElementById("convertingNote");
    const progressWrap = document.getElementById("digitalFileProgressWrap");
    const progressBar = document.getElementById("digitalFileProgressBar");
    const progressText = document.getElementById("digitalFileProgressText");

    try {
      if (!window.FabricNowAPI.authToken()) {
        showAlert("You're not signed in. Sign in first, or the request will be rejected by the API.", "warning");
      }

      // Large .zip bundles go straight to cloud storage first, same as the
      // regular "Add Product" flow — this request never carries the zip's
      // bytes.
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
      formData.append("name", name);
      formData.append("price", price);
      formData.append("description", description);
      formData.append("pinterestUrl", pinterestUrl);
      if (hasImage) formData.append("image", imageInput.files[0]);
      if (digitalFileGcs) formData.append("digitalFileGcs", JSON.stringify(digitalFileGcs));

      progressWrap?.classList.add("d-none");
      progressText?.classList.add("d-none");
      if (hasImage) convertingNote?.classList.remove("d-none");
      submitBtn.textContent = isEditMode ? "Updating..." : "Tracing & adding...";

      if (isEditMode) {
        await window.FabricNowAPI.updateDesignPattern(editId, formData);
        showAlert("Design pattern updated successfully.", "success");
      } else {
        await window.FabricNowAPI.createDesignPattern(formData);
        showAlert("Design pattern added successfully! It's now live on the storefront.", "success");
      }

      resetToCreateMode();
      await loadPatterns();
    } catch (err) {
      showAlert(err.message || "Something went wrong while saving the design pattern.");
    } finally {
      convertingNote?.classList.add("d-none");
      submitBtn.disabled = false;
      submitBtn.textContent = editId ? "Update Design Pattern" : "Add Design Pattern";
      progressWrap?.classList.add("d-none");
      progressText?.classList.add("d-none");
    }
  });

  loadPatterns();
});
