import { esc, fmtDateTime, showAlert, requireAdminPage } from "./admin-common.js";

const api = () => window.FabricNowAPI;
const SOURCE = {
  dashboard: ['success', "Set from dashboard"],
  server: ['secondary', "Using server default"],
  unset: ['danger', "Not set"],
};

function fieldRow(f) {
  const [color, label] = SOURCE[f.source];
  const current = f.secret
    ? f.isSet ? `<code>••••••••${esc(f.last4)}</code>` : '<span class="text-secondary">—</span>'
    : f.isSet ? `<code>${esc(f.value)}</code>` : '<span class="text-secondary">—</span>';
  return `
    <div class="border rounded-2 p-3 mb-3" data-name="${esc(f.name)}">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div class="fw-medium">${esc(f.label)}</div>
        <code class="small text-secondary">${esc(f.name)}</code>
        <span class="badge bg-${color}-subtle text-${color}-emphasis">${label}</span>
        ${f.needsRestart ? '<span class="badge bg-warning-subtle text-warning-emphasis">restart needed</span>' : ""}
        ${f.sharedWithGarmentService ? '<span class="badge bg-info-subtle text-info-emphasis">also used by garment-service</span>' : ""}
        <span class="ms-auto small text-secondary">Current: ${current}</span>
      </div>
      <div class="input-group">
        <input class="form-control key-input" type="${f.secret ? "password" : "text"}" autocomplete="new-password" spellcheck="false"
               placeholder="${f.secret ? "Paste a new key to replace the current one" : esc(f.placeholder || "New value")}">
        <button class="btn btn-primary" data-act="save" type="button">Save</button>
        ${f.testable ? '<button class="btn btn-outline-secondary" data-act="test" type="button">Test</button>' : ""}
        ${f.source === "dashboard" ? '<button class="btn btn-outline-danger" data-act="clear" type="button" title="Go back to the server default">Remove</button>' : ""}
      </div>
      <div class="small mt-1 key-result"></div>
      ${f.updatedAt ? `<div class="small text-secondary mt-1">Last changed ${esc(fmtDateTime(f.updatedAt))}</div>` : ""}
    </div>`;
}

async function load() {
  const { groups } = await api().adminListProviderKeys();
  document.getElementById("keyGroups").innerHTML = groups.map((g) => `
    <div class="col-xl-6">
      <div class="card h-100">
        <div class="card-header"><h2 class="h5 mb-1">${esc(g.label)}</h2><p class="small text-secondary mb-0">${esc(g.description)}</p></div>
        <div class="card-body">${g.fields.map(fieldRow).join("")}</div>
      </div>
    </div>`).join("");
}

async function loadAudit() {
  const body = document.getElementById("auditRows");
  try {
    const { entries } = await api().adminAudit(25);
    body.innerHTML = entries.length
      ? entries.map((e) => `<tr><td class="small text-secondary text-nowrap">${esc(fmtDateTime(e.createdAt))}</td><td class="small">${esc(e.actor || "")}</td><td><code>${esc(e.action)}</code></td><td class="small">${esc(e.target || "")}</td></tr>`).join("")
      : '<tr><td colspan="4" class="text-center text-secondary py-3">Nothing yet.</td></tr>';
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="text-danger py-3 text-center">${esc(err.message)}</td></tr>`;
  }
}

function setResult(row, ok, msg) {
  const el = row.querySelector(".key-result");
  el.className = `small mt-1 key-result text-${ok ? "success" : "danger"}`;
  el.textContent = msg;
}

document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-act]");
  const row = btn?.closest("[data-name]");
  if (!btn || !row) return;
  const name = row.dataset.name;
  const input = row.querySelector(".key-input");
  const value = input.value.trim();
  btn.disabled = true;

  try {
    if (btn.dataset.act === "save") {
      if (!value) { setResult(row, false, "Paste or type a value first."); return; }
      await api().adminSetProviderKey(name, value);
      showAlert(`${name} updated.`, "success");
      await Promise.all([load(), loadAudit()]);
    } else if (btn.dataset.act === "test") {
      setResult(row, true, "Testing…");
      const r = await api().adminTestProviderKey(name, value || undefined);
      setResult(row, r.ok, (value ? "Typed value: " : "Current key: ") + r.message);
    } else if (btn.dataset.act === "clear") {
      if (!window.confirm(`Remove the dashboard value for ${name} and go back to the server default?`)) return;
      await api().adminClearProviderKey(name);
      showAlert(`${name} reset to the server default.`, "success");
      await Promise.all([load(), loadAudit()]);
    }
  } catch (err) {
    setResult(row, false, err.message || "Failed.");
  } finally {
    btn.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await requireAdminPage("provider-keys.html"))) return;
  try { await Promise.all([load(), loadAudit()]); } catch (err) { showAlert(err.message); }
});
