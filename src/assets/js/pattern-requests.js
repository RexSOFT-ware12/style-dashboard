import { esc, fmtDate, requireAdminPage } from './admin-common.js';
const api = () => window.FabricNowAPI;
let rows = [], selected = null;
const $ = (id) => document.getElementById(id);
const API_BASE = `${(window.FABRICNOW_API_BASE || import.meta.env.FABRICNOW_API_BASE || 'http://localhost:4000').replace(/\/+$/, '').replace(/\/api$/i, '')}/api`;
const token = () => localStorage.getItem('fabricnow_token');
const statusText = (s) => ({ submitted: 'New request', processing: 'Processing', completed: 'Completed', revision_requested: 'Revision requested' }[s] || s);
const badge = (s) => `<span class="badge ${s === 'completed' ? 'bg-success-subtle text-success' : s === 'processing' ? 'bg-primary-subtle text-primary' : s === 'revision_requested' ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'}">${esc(statusText(s))}</span>`;
async function load() {
  $('requestsTable').innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Loading requests…</td></tr>';
  const data = await api().patternRequests.list($('requestFilter').value); rows = data.requests || [];
  const all = $('requestFilter').value === 'all' ? rows : (await api().patternRequests.list('all')).requests || [];
  $('newCount').textContent = all.filter(x => x.status === 'submitted').length;
  $('processingCount').textContent = all.filter(x => x.status === 'processing').length;
  $('completedCount').textContent = all.filter(x => x.status === 'completed').length;
  $('requestsTable').innerHTML = rows.length ? rows.map(r => `<tr><td><div class="fw-semibold">${esc(r.title || r.garment)}</div><div class="small text-secondary">${esc(r.customer?.name || 'Customer')} · ${esc(r.customer?.email || '')}</div></td><td>${esc(fmtDate(r.createdAt) || '—')}</td><td>${badge(r.status)}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-open="${esc(r.id)}">View request</button></td></tr>`).join('') : '<tr><td colspan="4" class="text-center text-secondary py-5">No pattern requests in this view.</td></tr>';
}
async function authedImage(url, img) { const r = await fetch(`${API_BASE}${url}`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} }); if (!r.ok) throw new Error('Could not load customer image.'); const blob = await r.blob(); img.src = URL.createObjectURL(blob); }
async function openRequest(id) {
  selected = rows.find(r => r.id === id) || (await api().patternRequests.list('all')).requests.find(r => r.id === id);
  if (!selected) return;
  $('requestDetail').classList.remove('d-none'); $('detailTitle').textContent = selected.title || selected.garment;
  $('detailCustomer').textContent = `${selected.customer?.name || 'Customer'} · ${selected.customer?.email || ''} · ${selected.id}`;
  $('detailGarment').textContent = selected.garment || 'Not specified'; $('detailLining').textContent = selected.lining || 'None'; $('detailNotes').textContent = selected.notes || 'No additional instructions.';
  $('detailFormats').textContent = Array.isArray(selected.formats) && selected.formats.length ? selected.formats.join(', ') : 'No extra formats selected';
  $('adminNote').value = selected.adminNote || ''; $('resultZip').value = ''; $('resultPreviews').value = ''; $('uploadFeedback').textContent = '';
  await authedImage(`/pattern-requests/admin/${id}/source`, $('detailImage'));
  if (selected.swatchImageUrl) { $('swatchWrap').classList.remove('d-none'); await authedImage(`/pattern-requests/admin/${id}/swatch`, $('detailSwatch')); } else $('swatchWrap').classList.add('d-none');
  $('requestDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function setStatus(status) { if (!selected) return; await api().patternRequests.setStatus(selected.id, status, $('adminNote').value); await load(); selected.status = status; selected.adminNote = $('adminNote').value; $('uploadFeedback').textContent = `Request updated: ${statusText(status)}.`; }
async function complete() {
  if (!selected) return; const file = $('resultZip').files[0]; if (!file || !/\.zip$/i.test(file.name)) { $('uploadFeedback').textContent = 'Choose a valid .zip file first.'; return; }
  const button = $('completeRequest'); button.disabled = true; $('uploadFeedback').textContent = 'Uploading and validating ZIP…';
  try { const fd = new FormData(); fd.append('file', file); fd.append('adminNote', $('adminNote').value); Array.from($('resultPreviews').files || []).slice(0, 20).forEach(image => fd.append('previews', image)); await api().patternRequests.uploadResult(selected.id, fd); $('uploadFeedback').textContent = 'ZIP uploaded. Request marked completed.'; await load(); selected.status = 'completed'; }
  catch (e) { $('uploadFeedback').textContent = e.message || 'Upload failed.'; }
  finally { button.disabled = false; }
}
$('requestsTable').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openRequest(b.dataset.open).catch(err => alert(err.message)); });
$('requestFilter').addEventListener('change', () => load().catch(e => alert(e.message)));
$('refreshRequests').addEventListener('click', () => load().catch(e => alert(e.message)));
$('closeDetail').addEventListener('click', () => { $('requestDetail').classList.add('d-none'); selected = null; });
$('markProcessing').addEventListener('click', () => setStatus('processing').catch(e => alert(e.message)));
$('requestRevision').addEventListener('click', () => setStatus('revision_requested').catch(e => alert(e.message)));
$('completeRequest').addEventListener('click', () => complete());
(async () => { if (await requireAdminPage()) await load(); })().catch(e => { $('requestsTable').innerHTML = `<tr><td colspan="4" class="text-danger p-4">${esc(e.message)}</td></tr>`; });
