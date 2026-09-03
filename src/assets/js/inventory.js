// Drives the inventory table on inventory.html — fetches from the same
// backend the storefront reads, so anything added/edited/deleted here
// shows up on the storefront too (and vice versa for reads).

function formatPrice(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRow(product) {
  const lowStock = Number(product.stock) <= 15;
  return `
    <tr class="align-middle" data-id="${product.id}">
      <td>
        <img src="${escapeHtml(product.image || "./assets/images/product-1.png")}" alt=""
          class="avatar avatar-md rounded" onerror="this.src='./assets/images/product-1.png'" />
        <span class="ms-3">${escapeHtml(product.name)}</span>
      </td>
      <td>${escapeHtml(product.sku || "—")}</td>
      <td>${escapeHtml(product.category || "—")}</td>
      <td><span class="badge bg-primary-subtle text-primary">${escapeHtml(product.style || "—")}</span></td>
      <td><span class="badge bg-info-subtle text-info">${escapeHtml(product.fabric || "—")}</span></td>
      <td>${escapeHtml(product.brand || "—")}</td>
      <td>${formatPrice(product.price)}</td>
      <td>
        ${product.stock}
        ${lowStock ? '<span class="badge bg-danger-subtle text-danger ms-1">Low</span>' : ""}
      </td>
      <td>
        <a href="#" class="link-danger delete-product" data-id="${product.id}" title="Delete">
          <i class="ti ti-trash ms-2"></i>
        </a>
      </td>
    </tr>
  `;
}

async function loadInventory(search = "") {
  const tbody = document.getElementById("inventoryTableBody");
  const countEl = document.getElementById("inventoryCount");
  tbody.innerHTML = `<tr><td colspan="9" class="text-center text-secondary py-4">Loading products…</td></tr>`;

  try {
    const { data, pagination } = await window.FabricNowAPI.listProducts({
      search,
      limit: 100,
    });

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-secondary py-4">No products found.</td></tr>`;
    } else {
      tbody.innerHTML = data.map(renderRow).join("");
    }

    countEl.textContent = `Showing ${data.length} of ${pagination.total} products`;

    document.querySelectorAll(".delete-product").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        if (!confirm("Delete this product? This cannot be undone.")) return;

        try {
          await window.FabricNowAPI.deleteProduct(id);
          loadInventory(search);
        } catch (err) {
          alert(err.message || "Could not delete product. Are you signed in?");
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">
      Couldn't reach the FabricNow API. Is the backend running on http://localhost:4000? (${escapeHtml(err.message)})
    </td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadInventory();

  const searchInput = document.getElementById("inventorySearch");
  let debounce;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => loadInventory(e.target.value), 300);
  });
});
