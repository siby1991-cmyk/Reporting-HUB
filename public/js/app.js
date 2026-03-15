/* ── State ─────────────────────────────────────────────────────────────────── */
let departments   = [];
let dashboards    = {};      // deptId → dashboard[]
let appConfig     = {};
let allRoles      = [];      // custom roles (for Access Control page)
let currentDeptId    = null;
let currentDashboard = null;
let editingDeptId    = null;
let editingDashId    = null;
let editingRoleId    = null;
let deptModalMode    = 'add';
let roleModalMode    = 'add';
let searchQuery      = '';

/* ── API ───────────────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = { method, headers: {} };
  const pin = getPin();
  if (pin) opts.headers['X-Admin-PIN'] = pin;
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

/* ── Toast ─────────────────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('fadeout'); setTimeout(() => el.remove(), 350); }, 3000);
}

/* ── Role helpers ──────────────────────────────────────────────────────────── */
function getVisibleDepts() {
  const allowed = getAllowedDepts(); // null = all
  if (!allowed) return departments;
  return departments.filter(d => allowed.includes(d.id));
}

function getDeptColor(dept) {
  // Use theme-aware colors for known depts
  const isDark = (window.getTheme && window.getTheme() === 'dark');
  const darkMap  = { operations: '#ff7040', 'accounts-receivables': '#00d4ff', finance: '#8b6fff', hr: '#ff4d8f', sales: '#00e5a0' };
  const lightMap = { operations: '#ff5722', 'accounts-receivables': '#0284c7', finance: '#7c3aed', hr: '#db2777', sales: '#16a34a' };
  const map = isDark ? darkMap : lightMap;
  return map[dept.id] || dept.color || '#0284c7';
}

/* ── Router ────────────────────────────────────────────────────────────────── */
function navigate(hash) { window.location.hash = hash; }

function handleRoute() {
  const hash = window.location.hash || '#/';
  if (hash === '#/' || hash === '') {
    showView('home'); setActiveSidebarItem(null);
    renderHomeStats(); renderDeptCards(); loadActivity();
  } else if (hash === '#/manage') {
    showView('manage'); setActiveSidebarItem(null); renderManageList();
  } else if (hash === '#/access') {
    showView('access'); setActiveSidebarItem(null); renderAccessControl();
  } else if (hash.startsWith('#/dept/')) {
    const parts = hash.split('/');
    const deptId = parts[2], dashId = parts[4];
    if (dashId) openDashboardById(deptId, dashId);
    else        openDept(deptId);
  }
}
window.addEventListener('hashchange', handleRoute);

/* ── Views ─────────────────────────────────────────────────────────────────── */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (d < 1) return 'just now';
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d/60)}h ago`;
  return `${Math.floor(d/1440)}d ago`;
}

function typeBadge(type) {
  const L = { powerbi:'Power BI', excel:'Excel', looker:'Looker', tableau:'Tableau', url:'URL', file:'HTML' };
  return `<span class="dash-type-badge type-${esc(type)}">${L[type]||type}</span>`;
}

/* ── Banners ───────────────────────────────────────────────────────────────── */
function renderBanners() {
  const rType  = sessionStorage.getItem('rh_role_type');
  const banner = document.getElementById('role-banner');
  const dot    = document.getElementById('role-banner-dot');
  const text   = document.getElementById('role-banner-text');
  const lockBar = document.getElementById('viewer-lock-bar');

  banner.classList.remove('banner-admin', 'banner-custom', 'banner-viewer');

  if (rType === 'admin') {
    text.textContent = 'Admin Mode — Full edit access';
    banner.classList.add('banner-admin');
    banner.style.display = 'flex';
    lockBar.style.display = 'none';
  } else if (rType === 'custom') {
    const name      = getRoleName();
    const allowed   = getAllowedDepts() || [];
    const deptNames = departments.filter(d => allowed.includes(d.id)).map(d => d.name);
    text.textContent = `👁 ${name} — Viewing: ${deptNames.join(', ') || 'No departments assigned'}`;
    banner.classList.add('banner-custom');
    banner.style.display = 'flex';
    lockBar.style.display = 'block';
    document.getElementById('viewer-lock-text').textContent = `${name} — view-only access`;
  } else if (rType === 'viewer') {
    text.textContent = '👁 Viewer — read-only access';
    banner.classList.add('banner-viewer');
    banner.style.display = 'flex';
    lockBar.style.display = 'block';
    document.getElementById('viewer-lock-text').textContent = 'Viewer — view-only access';
  } else {
    banner.style.display = 'none';
    lockBar.style.display = 'none';
  }
}

/* ── Sidebar ───────────────────────────────────────────────────────────────── */
function renderSidebar() {
  const list    = document.getElementById('dept-list');
  const visible = getVisibleDepts();
  const filtered = searchQuery
    ? visible.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : visible;

  list.innerHTML = '';
  filtered.forEach(dept => {
    const all   = dashboards[dept.id] || [];
    const count = isAdmin() ? all.length : all.filter(d => d.accessLevel !== 'admin').length;
    const li    = document.createElement('li');
    li.dataset.id = dept.id;
    li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="dept-li-icon">${dept.icon}</span>
      <span class="dept-li-label">${esc(dept.name)}</span>
      <span class="dept-li-count">${count}</span>
    `;
    li.addEventListener('click', () => navigate(`#/dept/${dept.id}`));
    list.appendChild(li);
  });
  setActiveSidebarItem(currentDeptId);
  if (isAdmin()) initDragSort();
}

function setActiveSidebarItem(deptId) {
  document.querySelectorAll('#dept-list li').forEach(li =>
    li.classList.toggle('active', li.dataset.id === deptId)
  );
}

/* ── Home Stats ────────────────────────────────────────────────────────────── */
function renderHomeStats() {
  const visible   = getVisibleDepts();
  const totalDash = visible.reduce((s, d) => s + (dashboards[d.id] || []).length, 0);
  document.getElementById('stat-dashboards').textContent = totalDash;
  document.getElementById('stat-depts').textContent      = visible.length;
  document.getElementById('stat-users').textContent      = appConfig.activeUsers ?? '—';

  // Show human-readable server uptime
  const secs = appConfig.serverUptimeSecs;
  let uptimeLabel = '—';
  if (secs != null) {
    if      (secs < 60)    uptimeLabel = secs + 's';
    else if (secs < 3600)  uptimeLabel = Math.floor(secs / 60) + 'm';
    else if (secs < 86400) uptimeLabel = Math.floor(secs / 3600) + 'h';
    else                   uptimeLabel = Math.floor(secs / 86400) + 'd';
  }
  document.getElementById('stat-uptime').textContent = uptimeLabel;
}

/* ── Dept Cards (Home) ─────────────────────────────────────────────────────── */
function renderDeptCards() {
  const grid    = document.getElementById('dept-cards');
  const visible = getVisibleDepts();
  const filtered = searchQuery
    ? visible.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : visible;

  grid.innerHTML = '';

  filtered.forEach((dept, i) => {
    const all   = dashboards[dept.id] || [];
    const count = isAdmin() ? all.length : all.filter(d => d.accessLevel !== 'admin').length;
    const color = getDeptColor(dept);
    const card  = document.createElement('div');
    card.className = 'dept-card';
    card.style.cssText = `border-color:${color}20; animation-delay:${i * 0.05}s`;
    card.innerHTML = `
      <div class="dept-card-orb" style="background:${esc(color)}"></div>
      <div class="dept-card-top">
        <div class="dept-card-icon-box" style="background:${color}18">${dept.icon}</div>
        <span class="dept-card-status">Active</span>
      </div>
      <div class="dept-card-name">${esc(dept.name)}</div>
      <div class="dept-card-desc">${esc(dept.description || '')}</div>
      <div class="dept-card-footer">
        <span class="dept-card-count" style="color:${color};font-weight:700">${count}</span>
        <span class="dept-card-count"> dashboard${count!==1?'s':''}</span>
        <div class="dept-card-actions">
          <button class="btn-edit-sm admin-only" data-action="edit" data-id="${dept.id}" style="display:none">✏️ Edit</button>
          <button class="btn-danger-sm admin-only" data-action="delete" data-id="${dept.id}" style="display:none">🗑</button>
          <button class="btn-view-sm" data-action="view" data-id="${dept.id}">Open →</button>
        </div>
      </div>
    `;
    if (isAdmin()) {
      card.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
    }
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.action === 'view')   navigate(`#/dept/${dept.id}`);
        if (btn.dataset.action === 'edit')   openEditDeptModal(dept.id);
        if (btn.dataset.action === 'delete') confirmDeleteDept(dept.id);
      });
    });
    card.addEventListener('click', () => navigate(`#/dept/${dept.id}`));
    grid.appendChild(card);
  });

  // "Add Department" card — admin only
  if (isAdmin()) {
    const addCard = document.createElement('div');
    addCard.className = 'dept-card dept-card-add';
    addCard.innerHTML = `<div class="dept-card-add-icon">+</div><div class="dept-card-add-label">New Department</div>`;
    addCard.addEventListener('click', openAddDeptModal);
    grid.appendChild(addCard);
  }
}

/* ── Activity Feed ─────────────────────────────────────────────────────────── */
async function loadActivity() {
  if (!isAdmin()) return;
  try {
    const items = await fetch('/api/activity').then(r => r.json());
    const feed  = document.getElementById('activity-feed');
    if (!items || items.length === 0) {
      feed.innerHTML = '<div class="empty-state"><p>No activity yet.</p></div>';
      return;
    }
    feed.innerHTML = items.slice(0, 5).map(item => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div>
          <div class="activity-label">${esc(item.label)}</div>
          <div class="activity-time">${timeAgo(item.timestamp)}</div>
        </div>
      </div>
    `).join('');
  } catch { /* silent */ }
}

/* ── Dept View ─────────────────────────────────────────────────────────────── */
async function openDept(deptId) {
  const visible = getVisibleDepts();
  const dept    = visible.find(d => d.id === deptId);
  if (!dept) { navigate('#/'); return; }
  currentDeptId = deptId;
  setActiveSidebarItem(deptId);
  showView('dept');

  const color = getDeptColor(dept);
  document.getElementById('dept-view-icon').textContent = dept.icon;
  document.getElementById('dept-view-name').textContent = dept.name;
  document.getElementById('dept-view-desc').textContent = dept.description || '';
  document.getElementById('dept-view-name').style.color = color;

  if (!dashboards[deptId]) {
    dashboards[deptId] = await api('GET', `/api/departments/${deptId}/dashboards`);
  }
  renderDashboards(deptId);
}

function renderDashboards(deptId) {
  const all   = dashboards[deptId] || [];
  const list  = isAdmin() ? all : all.filter(d => d.accessLevel !== 'admin');
  const grid  = document.getElementById('dashboard-grid');
  const empty = document.getElementById('dashboard-empty');

  grid.innerHTML = '';
  if (list.length === 0) {
    empty.style.display = 'flex';
    const addBtn = document.getElementById('empty-add-btn');
    if (addBtn) addBtn.style.display = isAdmin() ? 'inline-flex' : 'none';
    return;
  }
  empty.style.display = 'none';

  list.forEach(dash => {
    const card = document.createElement('div');
    card.className = 'dash-card';
    const isAdminOnly = dash.accessLevel === 'admin';
    card.innerHTML = `
      <div class="dash-card-top">
        <span class="dash-card-name">${esc(dash.name)}</span>
        ${typeBadge(dash.type)}
      </div>
      ${dash.description ? `<div class="dash-card-desc">${esc(dash.description)}</div>` : ''}
      ${isAdminOnly ? '<span class="dash-access-badge">🔒 Admin Only</span>' : ''}
      <div class="dash-card-actions">
        <button class="btn-view-sm" data-action="view" data-id="${dash.id}">View</button>
        <button class="btn-edit-sm admin-only" data-action="edit" data-id="${dash.id}" style="display:none">Edit</button>
        <button class="btn-danger-sm admin-only" data-action="delete" data-id="${dash.id}" style="display:none">Delete</button>
      </div>
    `;
    if (isAdmin()) {
      card.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
    }
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.action === 'view')   navigate(`#/dept/${deptId}/dashboard/${dash.id}`);
        if (btn.dataset.action === 'edit')   openEditDashModal(dash);
        if (btn.dataset.action === 'delete') confirmDeleteDash(dash);
      });
    });
    grid.appendChild(card);
  });
}

/* ── Dashboard Viewer ──────────────────────────────────────────────────────── */
async function openDashboardById(deptId, dashId) {
  if (!dashboards[deptId]) {
    dashboards[deptId] = await api('GET', `/api/departments/${deptId}/dashboards`);
  }
  const dash = dashboards[deptId].find(d => d.id === dashId);
  if (!dash) { navigate(`#/dept/${deptId}`); return; }

  currentDashboard = dash; currentDeptId = deptId;
  setActiveSidebarItem(deptId);
  showView('dashboard');
  document.getElementById('viewer-dash-name').textContent = dash.name;

  const locked = !isAdmin() && dash.accessLevel === 'admin';
  document.getElementById('viewer-locked-overlay').style.display = locked ? 'flex' : 'none';
  if (!locked) {
    document.getElementById('dashboard-frame').src = dash.type === 'file'
      ? `/files/${deptId}/${dash.filename}` : dash.url;
  } else {
    document.getElementById('dashboard-frame').src = 'about:blank';
  }

  document.getElementById('open-tab-btn').onclick = () => {
    const src = dash.type === 'file' ? `/files/${deptId}/${dash.filename}` : dash.url;
    window.open(src, '_blank');
  };

  // Show/hide admin toolbar buttons
  ['edit-dash-btn','delete-dash-btn'].forEach(id => {
    document.getElementById(id).style.display = isAdmin() ? 'inline-flex' : 'none';
  });

  addToRecent({ id: dash.id, name: dash.name, deptId });
}

document.getElementById('back-btn').addEventListener('click', () => navigate(`#/dept/${currentDeptId}`));
document.getElementById('edit-dash-btn').addEventListener('click',   () => { if (currentDashboard) openEditDashModal(currentDashboard); });
document.getElementById('delete-dash-btn').addEventListener('click', () => { if (currentDashboard) confirmDeleteDash(currentDashboard); });

/* ── Manage View ───────────────────────────────────────────────────────────── */
function renderManageList() {
  const list      = document.getElementById('manage-list');
  const admin     = isAdmin();
  const visible   = getVisibleDepts(); // filtered by role
  list.innerHTML  = '';

  // Hide Add Department button for non-admins
  const addDeptBtn = document.getElementById('manage-add-dept-btn');
  if (addDeptBtn) addDeptBtn.style.display = admin ? '' : 'none';

  if (visible.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏢</div><p>No departments assigned to your role.</p></div>';
    return;
  }

  visible.forEach((dept, idx) => {
    const count = (dashboards[dept.id] || []).length;
    const color = getDeptColor(dept);
    const item  = document.createElement('div');
    item.className = 'manage-item';
    item.innerHTML = `
      ${admin ? `
      <div class="reorder-btns">
        <button class="reorder-btn" data-dir="up"   data-id="${dept.id}" ${idx===0?'disabled':''}>▲</button>
        <button class="reorder-btn" data-dir="down" data-id="${dept.id}" ${idx===visible.length-1?'disabled':''}>▼</button>
      </div>` : '<div style="width:28px"></div>'}
      <div class="manage-item-color" style="background:${esc(color)}"></div>
      <div class="manage-item-icon">${dept.icon}</div>
      <div class="manage-item-info">
        <div class="manage-item-name">${esc(dept.name)}</div>
        <div class="manage-item-meta">${count} dashboard${count!==1?'s':''} · ${esc(dept.description||'No description')}</div>
      </div>
      <div class="manage-item-actions">
        ${admin ? `
        <button class="btn-edit-sm" data-action="edit"   data-id="${dept.id}">Edit</button>
        <button class="btn-danger-sm" data-action="delete" data-id="${dept.id}">Delete</button>
        ` : `<span style="font-size:12px;color:var(--muted)">Open dept to manage reports →</span>`}
      </div>
    `;
    if (admin) {
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.action === 'edit')   openEditDeptModal(btn.dataset.id);
          if (btn.dataset.action === 'delete') confirmDeleteDept(btn.dataset.id);
        });
      });
      item.querySelectorAll('.reorder-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id, dir = btn.dataset.dir;
          const i  = departments.findIndex(d => d.id === id);
          if (dir === 'up'   && i > 0)                      [departments[i-1], departments[i]] = [departments[i], departments[i-1]];
          if (dir === 'down' && i < departments.length - 1) [departments[i], departments[i+1]] = [departments[i+1], departments[i]];
          departments.forEach((d, n) => d.order = n);
          try { await api('PATCH', '/api/departments/reorder', { order: departments.map(d => d.id) }); renderManageList(); renderSidebar(); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    } else {
      // For custom roles: clicking the row navigates to their dept
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => navigate(`#/dept/${dept.id}`));
    }
    list.appendChild(item);
  });
}

/* ── Access Control View ───────────────────────────────────────────────────── */
async function renderAccessControl() {
  allRoles = await api('GET', '/api/roles');
  const list = document.getElementById('roles-list');
  list.innerHTML = '';

  if (allRoles.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No custom roles yet.</p></div>';
    return;
  }

  allRoles.forEach(role => {
    const deptNames = role.allowedDepartments
      .map(id => departments.find(d => d.id === id))
      .filter(Boolean)
      .map(d => `<span class="dept-chip" style="border-left:3px solid ${getDeptColor(d)}">${d.icon} ${esc(d.name)}</span>`)
      .join('');

    const item = document.createElement('div');
    item.className = 'role-item';
    item.innerHTML = `
      <div class="role-item-icon">👤</div>
      <div class="role-item-info">
        <div class="role-item-name">${esc(role.name)}</div>
        <div class="role-item-pin">PIN: ••••</div>
        <div class="role-item-depts">${deptNames || '<span style="color:var(--muted);font-size:11px">No departments</span>'}</div>
      </div>
      <div class="role-item-actions">
        <button class="btn-edit-sm" data-action="edit" data-id="${role.id}">Edit</button>
        <button class="btn-danger-sm" data-action="delete" data-id="${role.id}">Delete</button>
      </div>
    `;
    item.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'edit')   openEditRoleModal(btn.dataset.id);
        if (btn.dataset.action === 'delete') confirmDeleteRole(btn.dataset.id, role.name);
      });
    });
    list.appendChild(item);
  });
}

/* ── Dept Modal ────────────────────────────────────────────────────────────── */
function openAddDeptModal() {
  deptModalMode = 'add'; editingDeptId = null;
  document.getElementById('modal-dept-heading').textContent = 'Add Department';
  document.getElementById('dept-name-input').value  = '';
  document.getElementById('dept-icon-input').value  = '';
  document.getElementById('dept-desc-input').value  = '';
  document.getElementById('dept-color-input').value = '#0284c7';
  openModal('modal-dept');
  document.getElementById('dept-name-input').focus();
}
function openEditDeptModal(deptId) {
  const dept = departments.find(d => d.id === deptId); if (!dept) return;
  deptModalMode = 'edit'; editingDeptId = deptId;
  document.getElementById('modal-dept-heading').textContent = 'Edit Department';
  document.getElementById('dept-name-input').value  = dept.name;
  document.getElementById('dept-icon-input').value  = dept.icon;
  document.getElementById('dept-desc-input').value  = dept.description || '';
  document.getElementById('dept-color-input').value = dept.color || '#0284c7';
  openModal('modal-dept');
}

document.getElementById('modal-dept-save').addEventListener('click', async () => {
  const name  = document.getElementById('dept-name-input').value.trim();
  const icon  = document.getElementById('dept-icon-input').value.trim() || '📁';
  const desc  = document.getElementById('dept-desc-input').value.trim();
  const color = document.getElementById('dept-color-input').value;
  if (!name) { toast('Department name is required.', 'error'); return; }
  try {
    if (deptModalMode === 'add') {
      const d = await api('POST', '/api/departments', { name, icon, description: desc, color });
      departments.push(d); dashboards[d.id] = [];
      toast(`"${name}" created.`);
    } else {
      const d = await api('PUT', `/api/departments/${editingDeptId}`, { name, icon, description: desc, color });
      const i = departments.findIndex(x => x.id === editingDeptId);
      if (i !== -1) departments[i] = { ...departments[i], ...d };
      toast(`Department updated.`);
    }
    closeModal('modal-dept');
    renderSidebar(); renderDeptCards();
    if (window.location.hash === '#/manage') renderManageList();
  } catch (e) { toast(e.message, 'error'); }
});

/* ── Dept Delete ───────────────────────────────────────────────────────────── */
function confirmDeleteDept(deptId) {
  const dept = departments.find(d => d.id === deptId);
  openConfirm(`Delete "${dept.name}"?`, 'All dashboards inside will be permanently deleted.', async () => {
    await api('DELETE', `/api/departments/${deptId}`);
    departments = departments.filter(d => d.id !== deptId);
    delete dashboards[deptId];
    toast(`"${dept.name}" deleted.`);
    renderSidebar(); renderDeptCards();
    if (window.location.hash === '#/manage') renderManageList();
    if (currentDeptId === deptId) navigate('#/');
  });
}

/* ── Dashboard Modals ──────────────────────────────────────────────────────── */
function openAddDashboardModal() {
  document.getElementById('dash-name-input').value   = '';
  document.getElementById('dash-desc-input').value   = '';
  document.getElementById('dash-url-input').value    = '';
  document.getElementById('dash-file-input').value   = '';
  document.getElementById('dash-type-select').value  = 'powerbi';
  document.getElementById('dash-access-select').value = 'all';
  toggleDashTypeFields('powerbi');
  openModal('modal-dashboard');
  document.getElementById('dash-name-input').focus();
}

document.getElementById('dash-type-select').addEventListener('change', e => toggleDashTypeFields(e.target.value));
function toggleDashTypeFields(t) {
  document.getElementById('dash-url-field').style.display  = t === 'file' ? 'none'  : 'block';
  document.getElementById('dash-file-field').style.display = t === 'file' ? 'block' : 'none';
}

document.getElementById('modal-dashboard-save').addEventListener('click', async () => {
  const name = document.getElementById('dash-name-input').value.trim();
  const desc = document.getElementById('dash-desc-input').value.trim();
  const type = document.getElementById('dash-type-select').value;
  const acc  = document.getElementById('dash-access-select').value;
  if (!name) { toast('Name is required.', 'error'); return; }
  try {
    let dash;
    if (type === 'file') {
      const fi = document.getElementById('dash-file-input');
      if (!fi.files.length) { toast('Select an HTML file.', 'error'); return; }
      const form = new FormData();
      form.append('name', name); form.append('description', desc);
      form.append('type', 'file'); form.append('accessLevel', acc); form.append('file', fi.files[0]);
      dash = await api('POST', `/api/departments/${currentDeptId}/dashboards`, form);
    } else {
      const url = document.getElementById('dash-url-input').value.trim();
      if (!url) { toast('Embed URL is required.', 'error'); return; }
      dash = await api('POST', `/api/departments/${currentDeptId}/dashboards`, { name, description: desc, type, url, accessLevel: acc });
    }
    dashboards[currentDeptId] = dashboards[currentDeptId] || [];
    dashboards[currentDeptId].push(dash);
    closeModal('modal-dashboard');
    renderDashboards(currentDeptId); renderSidebar();
    toast(`"${name}" added.`);
  } catch (e) { toast(e.message, 'error'); }
});

function openEditDashModal(dash) {
  editingDashId = dash.id;
  document.getElementById('edit-dash-name-input').value    = dash.name;
  document.getElementById('edit-dash-desc-input').value    = dash.description || '';
  document.getElementById('edit-dash-access-select').value = dash.accessLevel || 'all';
  const uf = document.getElementById('edit-dash-url-field');
  if (dash.type !== 'file') { uf.style.display = 'block'; document.getElementById('edit-dash-url-input').value = dash.url || ''; }
  else uf.style.display = 'none';
  openModal('modal-edit-dashboard');
}

document.getElementById('modal-edit-dashboard-save').addEventListener('click', async () => {
  const name = document.getElementById('edit-dash-name-input').value.trim();
  const desc = document.getElementById('edit-dash-desc-input').value.trim();
  const url  = document.getElementById('edit-dash-url-input').value.trim();
  const acc  = document.getElementById('edit-dash-access-select').value;
  if (!name) { toast('Name is required.', 'error'); return; }
  try {
    const updated = await api('PUT', `/api/dashboards/${editingDashId}`, { name, description: desc, url, accessLevel: acc });
    for (const id of Object.keys(dashboards)) {
      const i = dashboards[id].findIndex(d => d.id === editingDashId);
      if (i !== -1) { dashboards[id][i] = { ...dashboards[id][i], ...updated }; break; }
    }
    if (currentDashboard?.id === editingDashId) {
      currentDashboard = { ...currentDashboard, ...updated };
      document.getElementById('viewer-dash-name').textContent = updated.name;
    }
    closeModal('modal-edit-dashboard');
    if (currentDeptId) renderDashboards(currentDeptId);
    toast('Dashboard updated.');
  } catch (e) { toast(e.message, 'error'); }
});

function confirmDeleteDash(dash) {
  openConfirm(`Delete "${dash.name}"?`, 'This dashboard will be permanently removed.', async () => {
    await api('DELETE', `/api/dashboards/${dash.id}`);
    if (dashboards[currentDeptId]) dashboards[currentDeptId] = dashboards[currentDeptId].filter(d => d.id !== dash.id);
    toast(`"${dash.name}" deleted.`);
    if (window.location.hash.includes('/dashboard/')) navigate(`#/dept/${currentDeptId}`);
    else renderDashboards(currentDeptId);
    renderSidebar();
  });
}

/* ── Role Modals (Access Control) ──────────────────────────────────────────── */
async function openCreateRoleModal() {
  roleModalMode = 'add'; editingRoleId = null;
  document.getElementById('modal-role-heading').textContent = 'Create Role';
  document.getElementById('role-name-input').value = '';
  document.getElementById('role-pin-input').value  = '';
  // Refresh departments so checklist always reflects current Manage state
  try { departments = await api('GET', '/api/departments'); } catch {}
  _buildDeptChecklist([]);
  openModal('modal-role');
  document.getElementById('role-name-input').focus();
}

async function openEditRoleModal(roleId) {
  const role = allRoles.find(r => r.id === roleId); if (!role) return;
  roleModalMode = 'edit'; editingRoleId = roleId;
  document.getElementById('modal-role-heading').textContent = 'Edit Role';
  document.getElementById('role-name-input').value = role.name;
  document.getElementById('role-pin-input').value  = '';
  // Refresh departments so checklist always reflects current Manage state
  try { departments = await api('GET', '/api/departments'); } catch {};
  _buildDeptChecklist(role.allowedDepartments || []);
  openModal('modal-role');
}

function _buildDeptChecklist(checked) {
  const wrap = document.getElementById('role-dept-checklist');
  wrap.innerHTML = '';
  departments.forEach(dept => {
    const color = getDeptColor(dept);
    const isChecked = checked.includes(dept.id);
    const item = document.createElement('label');
    item.className = 'dept-check-item';
    item.innerHTML = `
      <input type="checkbox" value="${dept.id}" ${isChecked ? 'checked' : ''} />
      <span class="dept-check-dot" style="background:${esc(color)}"></span>
      <span class="dept-check-label">${dept.icon} ${esc(dept.name)}</span>
    `;
    wrap.appendChild(item);
  });
}

document.getElementById('modal-role-save').addEventListener('click', async () => {
  const name = document.getElementById('role-name-input').value.trim();
  const pin  = document.getElementById('role-pin-input').value.trim();
  const allowed = [...document.querySelectorAll('#role-dept-checklist input:checked')].map(cb => cb.value);
  if (!name) { toast('Role name is required.', 'error'); return; }
  if (roleModalMode === 'add' && !pin) { toast('PIN is required.', 'error'); return; }
  try {
    const payload = { name, allowedDepartments: allowed };
    if (pin) payload.pin = pin;
    if (roleModalMode === 'add') {
      await api('POST', '/api/roles', payload);
      toast(`Role "${name}" created.`);
    } else {
      await api('PUT', `/api/roles/${editingRoleId}`, payload);
      toast(`Role "${name}" updated.`);
    }
    closeModal('modal-role');
    renderAccessControl();
  } catch (e) { toast(e.message, 'error'); }
});

function confirmDeleteRole(roleId, roleName) {
  openConfirm(`Delete role "${roleName}"?`, 'Users with this role will lose access.', async () => {
    await api('DELETE', `/api/roles/${roleId}`);
    toast(`Role "${roleName}" deleted.`);
    renderAccessControl();
  });
}

/* ── Settings Modal ────────────────────────────────────────────────────────── */
async function openSettingsModal() {
  try {
    const [config, roles] = await Promise.all([
      api('GET', '/api/config'),
      api('GET', '/api/roles')
    ]);
    document.getElementById('settings-appname-input').value = config.appName || '';
    document.getElementById('settings-uptime-input').value  = config.uptimePercent ?? '';
    document.getElementById('settings-pin-input').value     = '';
    document.getElementById('settings-pin-confirm-input').value = '';
    document.getElementById('settings-role-reset-pin').value = '';

    // Populate role reset dropdown
    const sel = document.getElementById('settings-role-reset-select');
    sel.innerHTML = '<option value="">Select role…</option>';
    roles.forEach(r => sel.add(new Option(r.name, r.id)));

    openModal('modal-settings');
  } catch (e) { toast(e.message, 'error'); }
}

document.getElementById('settings-role-reset-btn').addEventListener('click', async () => {
  const roleId = document.getElementById('settings-role-reset-select').value;
  const newPin = document.getElementById('settings-role-reset-pin').value.trim();
  if (!roleId) { toast('Select a role first.', 'error'); return; }
  if (!newPin) { toast('Enter a new PIN.', 'error'); return; }
  try {
    await api('PUT', `/api/roles/${roleId}`, { pin: newPin });
    document.getElementById('settings-role-reset-pin').value = '';
    document.getElementById('settings-role-reset-select').value = '';
    toast('Role PIN updated successfully.');
  } catch (e) { toast(e.message, 'error'); }
});

document.getElementById('modal-settings-save').addEventListener('click', async () => {
  const appName  = document.getElementById('settings-appname-input').value.trim();
  const uptime   = document.getElementById('settings-uptime-input').value;
  const newPin   = document.getElementById('settings-pin-input').value;
  const confPin  = document.getElementById('settings-pin-confirm-input').value;
  if (newPin && newPin !== confPin) { toast('PINs do not match.', 'error'); return; }
  const payload  = { appName, uptimePercent: uptime };
  if (newPin) payload.adminPin = newPin;
  try {
    const config = await api('PUT', '/api/config', payload);
    appConfig = config;
    if (newPin) sessionStorage.setItem('rh_pin', newPin);
    document.getElementById('topbar-appname').textContent = config.appName || 'Reporting HUB';
    renderHomeStats();
    closeModal('modal-settings');
    toast('Settings saved.');
  } catch (e) { toast(e.message, 'error'); }
});

/* ── Confirm Modal ─────────────────────────────────────────────────────────── */
let _confirmCb = null;
function openConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = msg;
  _confirmCb = cb;
  openModal('modal-confirm');
}
document.getElementById('confirm-ok').addEventListener('click', async () => {
  closeModal('modal-confirm');
  if (_confirmCb) { try { await _confirmCb(); } catch (e) { toast(e.message, 'error'); } _confirmCb = null; }
});

/* ── Modal helpers ─────────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-cancel').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.modal)));
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); });

/* ── Favorites ─────────────────────────────────────────────────────────────── */
function getFavs() { try { return JSON.parse(localStorage.getItem('rh_favorites')) || []; } catch { return []; } }
function renderFavorites() {
  const favs = getFavs(), list = document.getElementById('favorites-list');
  list.innerHTML = '';
  if (!favs.length) { list.innerHTML = '<li class="ql-empty">No favorites yet</li>'; return; }
  favs.slice(0, 5).forEach(f => {
    const li = document.createElement('li');
    li.textContent = `⭐ ${f.name}`;
    li.addEventListener('click', () => navigate(`#/dept/${f.deptId}/dashboard/${f.id}`));
    list.appendChild(li);
  });
}

/* ── Recently Viewed ───────────────────────────────────────────────────────── */
function addToRecent(item) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('rh_recent')) || []; } catch {}
  list = list.filter(r => r.id !== item.id);
  list.unshift(item); list = list.slice(0, 5);
  localStorage.setItem('rh_recent', JSON.stringify(list));
  renderRecent();
}
function renderRecent() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('rh_recent')) || []; } catch {}
  const el = document.getElementById('recent-list');
  el.innerHTML = '';
  if (!list.length) { el.innerHTML = '<li class="ql-empty">Nothing viewed yet</li>'; return; }
  list.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `🕒 ${r.name}`;
    li.addEventListener('click', () => navigate(`#/dept/${r.deptId}/dashboard/${r.id}`));
    el.appendChild(li);
  });
}

/* ── Search ────────────────────────────────────────────────────────────────── */
document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderSidebar();
  if (!window.location.hash || window.location.hash === '#/') renderDeptCards();
});

/* ── Drag-sort sidebar ─────────────────────────────────────────────────────── */
function initDragSort() {
  const list = document.getElementById('dept-list');
  let dragging = null;
  list.querySelectorAll('li').forEach(li => {
    li.draggable = true;
    li.addEventListener('dragstart', () => { dragging = li; setTimeout(() => li.classList.add('dragging'), 0); });
    li.addEventListener('dragend', async () => {
      li.classList.remove('dragging');
      list.querySelectorAll('li').forEach(el => el.classList.remove('drag-over-indicator'));
      const newOrder = [...list.querySelectorAll('li')].map(el => el.dataset.id);
      newOrder.forEach((id, i) => { const d = departments.find(x => x.id === id); if (d) d.order = i; });
      departments.sort((a, b) => a.order - b.order);
      try { await api('PATCH', '/api/departments/reorder', { order: newOrder }); }
      catch (e) { toast(e.message, 'error'); }
    });
    li.addEventListener('dragover', e => {
      e.preventDefault(); if (!dragging || dragging === li) return;
      list.querySelectorAll('li').forEach(el => el.classList.remove('drag-over-indicator'));
      const rect = li.getBoundingClientRect();
      list.insertBefore(dragging, e.clientY < rect.top + rect.height / 2 ? li : li.nextSibling);
      li.classList.add('drag-over-indicator');
    });
  });
}

/* ── Button wiring ─────────────────────────────────────────────────────────── */
document.getElementById('sidebar-toggle').addEventListener('click',    () => document.getElementById('sidebar').classList.toggle('collapsed'));
document.getElementById('manage-btn').addEventListener('click',        () => navigate('#/manage'));
document.getElementById('access-control-btn').addEventListener('click',() => navigate('#/access'));
document.getElementById('create-role-btn').addEventListener('click',   openCreateRoleModal);
document.getElementById('sync-roles-btn').addEventListener('click', async () => {
  try {
    const res = await api('POST', '/api/roles/sync-departments');
    if (res.created.length === 0) {
      toast('All departments already have roles.', 'info');
    } else {
      toast(`Created roles: ${res.created.join(', ')}. Default PIN is 0000 — update each role's PIN.`, 'success');
      await renderAccessControl();
    }
  } catch (e) { toast(e.message, 'error'); }
});
document.getElementById('manage-add-dept-btn').addEventListener('click', openAddDeptModal);
document.getElementById('add-dept-sidebar-btn').addEventListener('click', openAddDeptModal);
document.getElementById('home-add-dept-btn').addEventListener('click', openAddDeptModal);
document.getElementById('add-dashboard-btn').addEventListener('click', openAddDashboardModal);
document.getElementById('empty-add-btn').addEventListener('click',     openAddDashboardModal);
document.getElementById('settings-btn').addEventListener('click',      openSettingsModal);
document.getElementById('logout-btn').addEventListener('click',        switchRole);
document.getElementById('banner-switch-btn').addEventListener('click', switchRole);
document.getElementById('switch-role-btn').addEventListener('click',   switchRole);

/* ── Init ──────────────────────────────────────────────────────────────────── */
async function init() {
  try { appConfig = await fetch('/api/config/public').then(r => r.json()); } catch { appConfig = {}; }
  departments = await api('GET', '/api/departments');
  await Promise.all(departments.map(async d => { dashboards[d.id] = await api('GET', `/api/departments/${d.id}/dashboards`); }));
  if (appConfig.appName) {
    document.getElementById('topbar-appname').textContent = appConfig.appName;
    document.title = appConfig.appName;
  }
  renderBanners();
  renderSidebar();
  renderFavorites();
  renderRecent();
  handleRoute();
}

/* Entry point */
initAuth(role => init());
