function showTaxonomyAlert(message, type = "danger") {
  const box = document.getElementById("taxonomyAlert");
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = message;
  box.classList.remove("d-none");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function typeLabel(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function render(items) {
  for (const type of ["category", "style", "fabric"]) {
    const list = document.getElementById(`${type}List`);
    const count = document.getElementById(`${type}Count`);
    const values = items.filter((item) => item.type === type);
    if (count) count.textContent = values.filter((item) => item.active).length;
    if (!list) continue;

    if (!values.length) {
      list.innerHTML = '<div class="text-secondary small py-2">No values yet.</div>';
      continue;
    }

    list.innerHTML = values.map((item) => `
      <div class="border rounded-2 p-2 d-flex align-items-center gap-2 ${item.active ? "" : "opacity-50"}" data-id="${escapeHtml(item.id)}">
        <div class="flex-grow-1 min-w-0">
          <div class="fw-medium text-truncate">${escapeHtml(item.name)}</div>
          <div class="small text-secondary">${item.active ? "Active" : "Hidden from new products"}</div>
        </div>
        <button type="button" class="btn btn-sm btn-light edit-taxonomy" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" title="Rename">Edit</button>
        <button type="button" class="btn btn-sm ${item.active ? "btn-outline-danger" : "btn-outline-success"} toggle-taxonomy" data-id="${escapeHtml(item.id)}" data-active="${item.active}">
          ${item.active ? "Hide" : "Restore"}
        </button>
      </div>
    `).join("");
  }
}

async function load() {
  const { data } = await window.FabricNowAPI.getTaxonomiesManage();
  render(data || []);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.FabricNowAPI?.authToken()) {
    window.location.href = `./signin.html?next=${encodeURIComponent("taxonomies.html")}`;
    return;
  }

  try {
    await load();
  } catch (err) {
    showTaxonomyAlert(err.message || "Could not load catalog options.");
  }

  document.querySelectorAll(".taxonomy-add-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const type = form.dataset.type;
      const input = form.querySelector("[name=name]");
      const button = form.querySelector("button[type=submit]");
      const name = input.value.trim();
      if (!name) return;
      button.disabled = true;
      try {
        await window.FabricNowAPI.createTaxonomy({ type, name });
        input.value = "";
        showTaxonomyAlert(`${typeLabel(type)} added successfully.`, "success");
        await load();
      } catch (err) {
        showTaxonomyAlert(err.message || `Could not add ${type}.`);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.addEventListener("click", async (event) => {
    const edit = event.target.closest?.(".edit-taxonomy");
    const toggle = event.target.closest?.(".toggle-taxonomy");
    if (!edit && !toggle) return;

    if (edit) {
      const id = edit.dataset.id;
      const current = edit.dataset.name || "";
      const name = window.prompt("Rename this catalog value:", current);
      if (name === null || !name.trim() || name.trim() === current) return;
      try {
        await window.FabricNowAPI.updateTaxonomy(id, { name: name.trim() });
        showTaxonomyAlert("Catalog value renamed successfully. Existing products were updated.", "success");
        await load();
      } catch (err) {
        showTaxonomyAlert(err.message || "Could not rename this value.");
      }
      return;
    }

    if (toggle) {
      const id = toggle.dataset.id;
      const active = toggle.dataset.active === "true";
      const action = active ? "hide" : "restore";
      if (!window.confirm(`Are you sure you want to ${action} this value?`)) return;
      try {
        await window.FabricNowAPI.updateTaxonomy(id, { active: !active });
        showTaxonomyAlert(`Catalog value ${action}d successfully.`, "success");
        await load();
      } catch (err) {
        showTaxonomyAlert(err.message || `Could not ${action} this value.`);
      }
    }
  });
});
