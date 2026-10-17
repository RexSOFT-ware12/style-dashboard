import { Modal } from "bootstrap";
import { esc, fmtDate, fmtNum, showAlert, requireAdminPage, debounce } from "./admin-common.js";

const api = () => window.FabricNowAPI;
const TIER_LABEL = { starter: "API Starter", growth: "API Growth", enterprise: "API Enterprise" };
const state = { flash: null, users: { page: 1, q: "", status: "" }, companies: { page: 1, q: "" }, manageId: null, tiers: [] };
let manageModal;

// ---------------------------------------------------------------- overview
async function loadOverview() {
  const o = await api().adminOverview();
  document.getElementById("statUsers").textContent = fmtNum(o.users);
  document.getElementById("statCompanies").textContent = fmtNum(o.companies);
  document.getElementById("statBlocked").textContent = fmtNum(o.blocked);
  document.getElementById("statApi").textContent = fmtNum(o.apiActive);
  document.getElementById("statManual").textContent = fmtNum(o.apiManual);
}

// ------------------------------------------------------------------- users
function apiCell(a) {
  if (!a) return '<span class="text-secondary small">None</span>';
  const badge = a.hasAccess ? "success" : "secondary";
  const label = TIER_LABEL[a.tier] || a.tier;
  return `
    <div><span class="badge bg-${badge}-subtle text-${badge}-emphasis">${esc(label)}</span>
    ${a.source === "manual" ? '<span class="badge bg-info-subtle text-info-emphasis ms-1">paid directly</span>' : ""}
    ${!a.hasAccess ? `<span class="badge bg-warning-subtle text-warning-emphasis ms-1">${esc(a.status)}</span>` : ""}</div>
    <div class="small text-secondary">${a.allowance == null ? "Unlimited" : `${fmtNum(a.remaining)} of ${fmtNum(a.allowance)} images left`}</div>`;
}

function companiesCell(list) {
  if (!list.length) return '<span class="text-secondary small">—</span>';
  const shown = list.slice(0, 3).map((c) => `<span class="badge bg-light text-dark border me-1" title="${esc(c.role)}">${esc(c.name)}</span>`).join("");
  return shown + (list.length > 3 ? `<span class="small text-secondary">+${list.length - 3}</span>` : "");
}

async function loadUsers() {
  const body = document.getElementById("userRows");
  try {
    const s = state.users;
    const d = await api().adminListUsers({ page: s.page, q: s.q, status: s.status });
    document.getElementById("userCount").textContent = `${fmtNum(d.total)} user${d.total === 1 ? "" : "s"}`;
    document.getElementById("userPage").textContent = `Page ${d.page} of ${d.pages}`;
    document.getElementById("userPrev").disabled = d.page <= 1;
    document.getElementById("userNext").disabled = d.page >= d.pages;

    if (!d.users.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">No users match.</td></tr>';
      return;
    }
    body.innerHTML = d.users.map((u) => `
      <tr class="${u.isBlocked ? "table-danger" : ""}">
        <td>
          <div class="fw-medium">${esc(u.name)} ${u.isAdmin ? '<span class="badge bg-primary-subtle text-primary">admin</span>' : ""}</div>
          <div class="small text-secondary">${esc(u.email)}</div>
        </td>
        <td>${companiesCell(u.companies)}</td>
        <td>${apiCell(u.api)}</td>
        <td>${u.isBlocked
          ? `<span class="badge bg-danger">Blocked</span>${u.blockedReason ? `<div class="small text-secondary">${esc(u.blockedReason)}</div>` : ""}`
          : '<span class="badge bg-success-subtle text-success-emphasis">Active</span>'}</td>
        <td class="small text-secondary">${fmtDate(u.createdAt)}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-manage="${esc(u.id)}" type="button">Manage</button></td>
      </tr>`).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${esc(err.message)}</td></tr>`;
  }
}

async function loadCompanies() {
  const body = document.getElementById("companyRows");
  try {
    const s = state.companies;
    const d = await api().adminListCompanies({ page: s.page, q: s.q });
    document.getElementById("companyCount").textContent = `${fmtNum(d.total)} compan${d.total === 1 ? "y" : "ies"}`;
    document.getElementById("companyPage").textContent = `Page ${d.page} of ${d.pages}`;
    document.getElementById("companyPrev").disabled = d.page <= 1;
    document.getElementById("companyNext").disabled = d.page >= d.pages;
    if (!d.companies.length) {
      body.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">No companies match.</td></tr>';
      return;
    }
    body.innerHTML = d.companies.map((c) => `
      <tr>
        <td class="fw-medium">${esc(c.name)}<div class="small text-secondary">${esc(c.slug)}</div></td>
        <td>${c.owner
          ? `<a href="#!" data-manage="${esc(c.owner.id)}">${esc(c.owner.name)}</a> ${c.owner.isBlocked ? '<span class="badge bg-danger">Blocked</span>' : ""}<div class="small text-secondary">${esc(c.owner.email)}</div>`
          : '<span class="text-secondary">—</span>'}</td>
        <td>${fmtNum(c.members)}</td>
        <td class="small text-secondary">${fmtDate(c.createdAt)}</td>
      </tr>`).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">${esc(err.message)}</td></tr>`;
  }
}

// ------------------------------------------------------------ manage modal
function creditsPanel(e) {
  if (!e || e.status === "none") return '<p class="text-secondary mb-0">No API plan yet.</p>';
  const pct = e.allowance ? Math.min(100, Math.round((e.used / e.allowance) * 100)) : 0;
  const badge = e.hasAccess ? "success" : "warning";
  return `
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <span class="badge bg-${badge}-subtle text-${badge}-emphasis fs-6">${esc(TIER_LABEL[e.tier] || e.tier)} · ${esc(e.status)}</span>
      <span class="badge ${e.source === "manual" ? "bg-info-subtle text-info-emphasis" : "bg-secondary-subtle text-secondary-emphasis"}">${e.source === "manual" ? "Paid directly (manual)" : "Billed by Stripe"}</span>
      <span class="small text-secondary">${e.source === "manual" ? "Paid through" : "Renews"} ${fmtDate(e.currentPeriodEnd)}</span>
    </div>
    <div class="row g-2 text-center mb-2">
      <div class="col-6 col-md"><div class="border rounded-2 p-2"><div class="small text-secondary">Monthly credits</div><div class="fw-semibold">${fmtNum(e.quota)}</div></div></div>
      <div class="col-6 col-md"><div class="border rounded-2 p-2"><div class="small text-secondary">Carried over</div><div class="fw-semibold">${fmtNum(e.rolloverCredits)}</div></div></div>
      <div class="col-6 col-md"><div class="border rounded-2 p-2"><div class="small text-secondary">Total available</div><div class="fw-semibold">${fmtNum(e.allowance)}</div></div></div>
      <div class="col-6 col-md"><div class="border rounded-2 p-2"><div class="small text-secondary">Used</div><div class="fw-semibold">${fmtNum(e.used)}</div></div></div>
      <div class="col-12 col-md"><div class="border rounded-2 p-2 bg-light"><div class="small text-secondary">Remaining</div><div class="fw-semibold">${fmtNum(e.remaining)}</div></div></div>
    </div>
    ${e.allowance ? `<div class="progress mb-1" style="height:8px"><div class="progress-bar" style="width:${pct}%"></div></div>` : ""}
    <p class="small text-secondary mb-0">Unused credits never expire — at each renewal they're kept and the new month's credits are added on top.</p>`;
}

function renderManage(d) {
  const u = d.user;
  const e = d.api.entitlement;
  const hasPlan = e && e.status !== "none";
  const isManual = e?.source === "manual";
  const stripeLive = hasPlan && !isManual && ["active", "trialing", "past_due"].includes(e.status);
  const defaultTier = e?.tier || "growth";
  state.tiers = d.tiers;

  document.getElementById("manageTitle").textContent = u.name;
  const flash = state.flash;
  state.flash = null;
  document.getElementById("manageBody").innerHTML = `
    ${flash ? `<div class="alert alert-${flash.type} py-2" role="alert">${esc(flash.msg)}</div>` : ""}
    <div class="d-flex flex-wrap align-items-center gap-2 mb-4">
      <div class="me-auto"><div class="text-secondary">${esc(u.email)}</div>
        <div class="small text-secondary">Joined ${fmtDate(u.createdAt)} · Consumer plan: ${esc(d.premium.plan)}</div></div>
      ${u.isAdmin ? '<span class="badge bg-primary-subtle text-primary">admin</span>' : ""}
      ${u.isBlocked ? '<span class="badge bg-danger">Blocked</span>' : '<span class="badge bg-success-subtle text-success-emphasis">Active</span>'}
    </div>

    <h3 class="h6">Access</h3>
    ${u.isBlocked ? `
      <div class="alert alert-danger d-flex justify-content-between align-items-center gap-3">
        <div><strong>This account is blocked.</strong>${u.blockedReason ? ` Reason: ${esc(u.blockedReason)}` : ""}<div class="small">They can't sign in, and their open sessions and API keys have stopped working.</div></div>
        <button class="btn btn-success btn-sm text-nowrap" data-act="unblock" type="button">Unblock</button>
      </div>` : u.isAdmin ? '<p class="text-secondary small">Admins can\'t be blocked.</p>' : `
      <div class="input-group mb-1">
        <input id="blockReason" class="form-control" maxlength="300" placeholder="Reason (optional, only admins see this)">
        <button class="btn btn-outline-danger" data-act="block" type="button">Block user</button>
      </div>
      <p class="small text-secondary">Blocking signs them out everywhere within seconds and disables their API keys. Nothing is deleted.</p>`}

    <hr>
    <h3 class="h6">Companies</h3>
    ${d.companies.length ? `<ul class="list-group mb-3">${d.companies.map((c) => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${esc(c.name)} ${c.isOwner ? '<span class="badge bg-light text-dark border">owner</span>' : ""}</span>
        <span class="small text-secondary">${esc(c.role)}${c.status !== "active" ? ` · ${esc(c.status)}` : ""}</span>
      </li>`).join("")}</ul>` : '<p class="text-secondary">Not part of any company.</p>'}

    <hr>
    <h3 class="h6">API plan &amp; image credits</h3>
    ${creditsPanel(e)}

    <div class="card mt-3"><div class="card-body">
      <h4 class="h6 mb-1">${isManual && e.hasAccess ? "Record another direct payment" : "Mark as paid (customer paid you directly)"}</h4>
      ${stripeLive ? `<div class="alert alert-warning small mb-0">This customer has a live <strong>Stripe</strong> API subscription. Cancel it in Stripe first — otherwise they'd be charged twice. After that you can record direct payments here.</div>` : `
      <p class="small text-secondary">Turns the plan on for one month${isManual && e.hasAccess ? " (added after the current month if they paid early)" : ""}. Anything unused from before is kept and the new month's credits are added on top.</p>
      <div class="row g-2">
        <div class="col-md-4"><label class="form-label small mb-1">Plan</label>
          <select id="payTier" class="form-select">${d.tiers.map((t) => `<option value="${esc(t.id)}" ${t.id === defaultTier ? "selected" : ""}>${esc(t.label)}${t.quota != null ? ` — ${fmtNum(t.quota)} img/mo` : ""}</option>`).join("")}</select></div>
        <div class="col-md-4"><label class="form-label small mb-1">Images per month <span id="payQuotaReq" class="text-danger d-none">*</span></label>
          <input id="payQuota" class="form-control" type="number" min="0" step="1" placeholder="Plan default"></div>
        <div class="col-md-4"><label class="form-label small mb-1">Amount received (USD)</label>
          <input id="payAmount" class="form-control" type="number" min="0" step="0.01" placeholder="e.g. 2900"></div>
        <div class="col-12"><label class="form-label small mb-1">Note (bank transfer ref, invoice #…)</label>
          <input id="payNote" class="form-control" maxlength="500"></div>
        <div class="col-12"><button class="btn btn-primary" data-act="pay" type="button">${isManual && e.hasAccess ? "Record payment (+1 month)" : "Mark as paid (start 1 month)"}</button>
        ${isManual && e.status === "active" ? '<button class="btn btn-outline-danger ms-2" data-act="cancelPlan" type="button">Cancel plan</button>' : ""}</div>
      </div>`}
    </div></div>

    ${hasPlan ? `
    <div class="card mt-3"><div class="card-body">
      <h4 class="h6 mb-1">Add or remove credits</h4>
      <p class="small text-secondary">One-off adjustment (e.g. goodwill credits). Use a negative number to remove. Added credits never expire.</p>
      <div class="input-group">
        <input id="creditAmount" class="form-control" type="number" step="1" placeholder="e.g. 50 or -20">
        <input id="creditNote" class="form-control" maxlength="300" placeholder="Note (optional)">
        <button class="btn btn-outline-primary" data-act="credits" type="button">Apply</button>
      </div>
    </div></div>` : ""}

    <hr>
    <h3 class="h6">API keys</h3>
    ${d.api.keys.length ? `<div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Label</th><th>Key</th><th>Last used</th><th></th></tr></thead><tbody>
      ${d.api.keys.map((k) => `<tr><td>${esc(k.label)}</td><td><code>${esc(k.keyPrefix)}…</code></td><td class="small text-secondary">${fmtDate(k.lastUsedAt)}</td><td>${k.revokedAt ? '<span class="badge bg-secondary">revoked</span>' : '<span class="badge bg-success-subtle text-success-emphasis">active</span>'}</td></tr>`).join("")}
    </tbody></table></div>` : '<p class="text-secondary">No API keys created.</p>'}
  `;

  syncQuotaRequirement();
}

function syncQuotaRequirement() {
  const tier = document.getElementById("payTier");
  const quota = document.getElementById("payQuota");
  const req = document.getElementById("payQuotaReq");
  if (!tier || !quota) return;
  const t = state.tiers.find((x) => x.id === tier.value);
  const isEnt = tier.value === "enterprise";
  req?.classList.toggle("d-none", !isEnt);
  quota.placeholder = isEnt ? "Required" : t?.quota != null ? `${t.quota} (default)` : "Plan default";
}

async function openManage(id) {
  state.manageId = id;
  document.getElementById("manageBody").innerHTML = '<div class="text-center text-secondary py-5">Loading…</div>';
  manageModal.show();
  await refreshManage();
}

async function refreshManage() {
  try {
    renderManage(await api().adminGetUser(state.manageId));
  } catch (err) {
    document.getElementById("manageBody").innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
  }
}

async function refreshLists() {
  await Promise.all([loadOverview(), loadUsers(), document.getElementById("tabCompanies").classList.contains("d-none") ? null : loadCompanies()]);
}

async function onManageClick(ev) {
  const btn = ev.target.closest("[data-act]");
  if (!btn) return;
  const id = state.manageId;
  const val = (sel) => document.getElementById(sel)?.value ?? "";
  const act = btn.dataset.act;
  btn.disabled = true;

  try {
    if (act === "block") {
      if (!window.confirm("Block this user? They'll be signed out and their API keys will stop working.")) return;
      await api().adminBlockUser(id, val("blockReason").trim());
      state.flash = { msg: "User blocked.", type: "success" };
    } else if (act === "unblock") {
      await api().adminUnblockUser(id);
      state.flash = { msg: "User unblocked.", type: "success" };
    } else if (act === "pay") {
      const tier = val("payTier");
      const payload = { tier, note: val("payNote").trim() };
      if (val("payQuota") !== "") payload.quota = Number(val("payQuota"));
      if (val("payAmount") !== "") payload.amountUsd = Number(val("payAmount"));
      const label = state.tiers.find((t) => t.id === tier)?.label || tier;
      if (!window.confirm(`Record a direct payment for ${label}? This activates / extends their plan by one month.`)) return;
      const r = await api().adminMarkApiPaid(id, payload);
      const e = r.entitlement;
      state.flash = { type: "success", msg: `Plan active until ${fmtDate(e.currentPeriodEnd)} — ${fmtNum(e.remaining)} images available (${fmtNum(e.rolloverCredits)} carried over).` };
    } else if (act === "credits") {
      const amount = Number(val("creditAmount"));
      if (!Number.isInteger(amount) || amount === 0) { state.flash = { msg: "Enter a whole number, e.g. 50 or -20.", type: "warning" }; await refreshManage(); return; }
      await api().adminAdjustApiCredits(id, { amount, note: val("creditNote").trim() });
      state.flash = { msg: `Credits ${amount > 0 ? "added" : "removed"}.`, type: "success" };
    } else if (act === "cancelPlan") {
      if (!window.confirm("Cancel this directly-paid plan now? Their API access stops; unused credits are kept in case they return.")) return;
      await api().adminCancelApiPlan(id);
      state.flash = { msg: "Plan canceled.", type: "success" };
    }
    await Promise.all([refreshManage(), refreshLists()]);
  } catch (err) {
    state.flash = { msg: err.message || "Something went wrong.", type: "danger" };
    await refreshManage();
  } finally {
    btn.disabled = false;
  }
}

// -------------------------------------------------------------------- init
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await requireAdminPage("users.html"))) return;
  manageModal = new Modal(document.getElementById("manageModal"));

  document.getElementById("manageBody").addEventListener("click", onManageClick);
  document.getElementById("manageBody").addEventListener("change", (e) => { if (e.target.id === "payTier") syncQuotaRequirement(); });
  document.addEventListener("click", (e) => {
    const m = e.target.closest("[data-manage]");
    if (m) { e.preventDefault(); openManage(m.dataset.manage); }
  });

  document.getElementById("adminTabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    document.querySelectorAll("#adminTabs .nav-link").forEach((b) => b.classList.toggle("active", b === t));
    const companies = t.dataset.tab === "companies";
    document.getElementById("tabUsers").classList.toggle("d-none", companies);
    document.getElementById("tabCompanies").classList.toggle("d-none", !companies);
    if (companies) loadCompanies();
  });

  document.getElementById("userSearch").addEventListener("input", debounce((e) => { state.users.q = e.target.value.trim(); state.users.page = 1; loadUsers(); }));
  document.getElementById("userStatus").addEventListener("change", (e) => { state.users.status = e.target.value; state.users.page = 1; loadUsers(); });
  document.getElementById("userPrev").addEventListener("click", () => { state.users.page = Math.max(1, state.users.page - 1); loadUsers(); });
  document.getElementById("userNext").addEventListener("click", () => { state.users.page += 1; loadUsers(); });
  document.getElementById("companySearch").addEventListener("input", debounce((e) => { state.companies.q = e.target.value.trim(); state.companies.page = 1; loadCompanies(); }));
  document.getElementById("companyPrev").addEventListener("click", () => { state.companies.page = Math.max(1, state.companies.page - 1); loadCompanies(); });
  document.getElementById("companyNext").addEventListener("click", () => { state.companies.page += 1; loadCompanies(); });

  try { await Promise.all([loadOverview(), loadUsers()]); } catch (err) { showAlert(err.message); }
});
