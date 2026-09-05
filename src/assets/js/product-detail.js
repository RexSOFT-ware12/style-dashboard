// Drives product-detail.html — fetches one product from the FabricNow API
// (GET /api/products/:id) and renders it, with links to edit and a button
// to delete it (DELETE /api/products/:id, same as the inventory table).

function formatPrice(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = document.getElementById("detailLoading");
  const errorEl = document.getElementById("detailError");
  const contentEl = document.getElementById("detailContent");
  if (!loadingEl || !contentEl) return; // not on the product detail page

  const id = getProductId();
  if (!id) {
    loadingEl.classList.add("d-none");
    errorEl.textContent = "No product specified.";
    errorEl.classList.remove("d-none");
    return;
  }

  try {
    const { data: product } = await window.FabricNowAPI.getProduct(id);

    document.getElementById("detailImage").src = product.image || "./assets/images/product-1.png";
    document.getElementById("detailName").textContent = product.name;
    document.getElementById("detailSku").textContent = product.sku ? `SKU: ${product.sku}` : "";
    document.getElementById("detailPrice").textContent = formatPrice(product.price);
    document.getElementById("detailCategory").textContent = product.category || "—";
    document.getElementById("detailBrand").textContent = product.brand || "—";
    document.getElementById("detailStyle").textContent = product.style || "—";
    document.getElementById("detailFabric").textContent = product.fabric || "—";
    document.getElementById("detailColor").textContent = product.color || "—";
    document.getElementById("detailCreatedAt").textContent = formatDate(product.createdAt);
    document.getElementById("detailUpdatedAt").textContent = formatDate(product.updatedAt);
    document.getElementById("detailDescription").textContent = product.description || "No description provided.";

    const digitalBadge = document.getElementById("detailDigitalFileBadge");
    if (digitalBadge) {
      digitalBadge.textContent = product.hasDigitalFile
        ? `📦 Digital file attached${product.digitalFile?.originalName ? `: ${product.digitalFile.originalName}` : ""}`
        : "⚠️ No digital file attached yet";
    }

    const editHref = `create-product.html?id=${encodeURIComponent(product.id)}`;
    document.getElementById("editProductLink").href = editHref;
    document.getElementById("editProductLinkBottom").href = editHref;

    document.getElementById("deleteProductBtn").addEventListener("click", async () => {
      if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
      try {
        await window.FabricNowAPI.deleteProduct(product.id);
        window.location.href = "inventory.html";
      } catch (err) {
        alert(err.message || "Could not delete product. Are you signed in?");
      }
    });

    loadingEl.classList.add("d-none");
    contentEl.classList.remove("d-none");
  } catch (err) {
    loadingEl.classList.add("d-none");
    errorEl.textContent = err.message || "Could not load this product.";
    errorEl.classList.remove("d-none");
  }
});
