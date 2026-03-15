/* ── auth.js — Role gate, PIN validation, session management ────────────────── */

const ROLE_TYPE_KEY   = 'rh_role_type';    // 'admin' | 'custom' | 'viewer'
const ROLE_NAME_KEY   = 'rh_role_name';    // display name
const ROLE_PIN_KEY    = 'rh_pin';          // stored PIN (admin only)
const ROLE_ALLOWED_KEY = 'rh_allowed';     // JSON array of dept IDs (custom only)
const ROLE_ID_KEY     = 'rh_role_id';      // role uuid (custom only)

let _onRoleSet = null;

/* ── Public API ────────────────────────────────────────────────────────────── */
function initAuth(onRoleSet) {
  _onRoleSet = onRoleSet;
  const roleType = sessionStorage.getItem(ROLE_TYPE_KEY);
  if (roleType === 'admin' || roleType === 'custom' || roleType === 'viewer') {
    _applyRole(roleType);
  } else {
    _showGate();
  }
}

function isAdmin()        { return sessionStorage.getItem(ROLE_TYPE_KEY) === 'admin'; }
function isCustomRole()   { return sessionStorage.getItem(ROLE_TYPE_KEY) === 'custom'; }
function getPin()         { return sessionStorage.getItem(ROLE_PIN_KEY) || ''; }
function getRoleName()    { return sessionStorage.getItem(ROLE_NAME_KEY) || ''; }
function getAllowedDepts() {
  const type = sessionStorage.getItem(ROLE_TYPE_KEY);
  if (type === 'admin' || type === 'viewer') return null; // null = all depts
  try { return JSON.parse(sessionStorage.getItem(ROLE_ALLOWED_KEY) || '[]'); } catch { return []; }
}

function switchRole() {
  sessionStorage.clear();
  document.getElementById('app').classList.add('hidden');
  _showGate();
}

/* ── Gate ──────────────────────────────────────────────────────────────────── */
async function _showGate() {
  const gate = document.getElementById('role-gate');
  gate.style.display = 'flex';
  gate.classList.remove('fade-out');

  // Reset state
  document.getElementById('gate-pin-input').value = '';
  document.getElementById('gate-error').textContent = '';
  document.getElementById('gate-login-btn').textContent = 'Enter →';
  document.getElementById('gate-login-btn').disabled = false;

  // Fetch role names from server
  try {
    const roles = await fetch('/api/roles').then(r => r.json());
    _populateRoleDropdown(roles);
    document.getElementById('role-gate-form').style.display  = roles.length > 0 ? 'flex' : 'none';
    document.getElementById('role-gate-cards').style.display = roles.length === 0 ? 'flex' : 'none';
  } catch {
    // Server unreachable — show fallback two-card layout
    document.getElementById('role-gate-form').style.display  = 'none';
    document.getElementById('role-gate-cards').style.display = 'flex';
  }

  // Update gate app name
  try {
    const cfg = await fetch('/api/config/public').then(r => r.json());
    if (cfg.appName) document.getElementById('role-gate-appname').textContent = cfg.appName;
  } catch {}

  _bindGateEvents();
}

function _populateRoleDropdown(roles) {
  const select = document.getElementById('role-select');
  // Keep only the default "Select role…" option — no admin on main gate
  while (select.options.length > 1) select.remove(1);
  roles.forEach(r => {
    const opt = new Option(r.name, r.name);
    select.add(opt);
  });
}

function _bindGateEvents() {
  // Dropdown form submit
  const loginBtn = document.getElementById('gate-login-btn');
  const newBtn = loginBtn.cloneNode(true);
  loginBtn.parentNode.replaceChild(newBtn, loginBtn);
  newBtn.addEventListener('click', _attemptLogin);

  document.getElementById('gate-pin-input').onkeydown = e => { if (e.key === 'Enter') _attemptLogin(); };

  // Fallback cards
  const fbSubmit = document.getElementById('fallback-pin-submit');
  if (fbSubmit) {
    fbSubmit.onclick = _attemptFallbackAdmin;
    document.getElementById('fallback-pin-input').onkeydown = e => { if (e.key === 'Enter') _attemptFallbackAdmin(); };
  }
  const viewerBtn = document.getElementById('viewer-enter-btn');
  if (viewerBtn) viewerBtn.onclick = () => _setRole('viewer', 'Viewer', null, null);
}

async function _attemptLogin() {
  const roleName = document.getElementById('role-select').value;
  const pin      = document.getElementById('gate-pin-input').value.trim();
  const errEl    = document.getElementById('gate-error');
  const btn      = document.getElementById('gate-login-btn');

  if (!roleName) { errEl.textContent = 'Please select a role.'; return; }
  if (!pin)      { errEl.textContent = 'Enter your PIN.'; return; }

  btn.textContent = '…';
  btn.disabled    = true;
  errEl.textContent = '';

  try {
    if (roleName === '__admin__') {
      // Validate admin PIN
      const res = await fetch('/api/config', { headers: { 'X-Admin-PIN': pin } });
      if (res.ok) {
        sessionStorage.setItem(ROLE_PIN_KEY, pin);
        _setRole('admin', 'Admin', null, null);
      } else {
        errEl.textContent = 'Incorrect PIN.';
        document.getElementById('gate-pin-input').value = '';
      }
    } else {
      // Validate custom role
      const res = await fetch('/api/roles/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName, pin })
      });
      if (res.ok) {
        const data = await res.json();
        _setRole('custom', data.role.name, data.role.allowedDepartments, data.role.id);
      } else {
        errEl.textContent = 'Incorrect PIN.';
        document.getElementById('gate-pin-input').value = '';
      }
    }
  } catch {
    errEl.textContent = 'Connection error. Try again.';
  } finally {
    const b = document.getElementById('gate-login-btn');
    if (b) { b.textContent = 'Enter →'; b.disabled = false; }
  }
}

async function _attemptFallbackAdmin() {
  const pin   = document.getElementById('fallback-pin-input').value.trim();
  const errEl = document.getElementById('fallback-error');
  const btn   = document.getElementById('fallback-pin-submit');
  if (!pin) { errEl.textContent = 'Enter your PIN.'; return; }
  btn.textContent = '…'; btn.disabled = true; errEl.textContent = '';
  try {
    const res = await fetch('/api/config', { headers: { 'X-Admin-PIN': pin } });
    if (res.ok) {
      sessionStorage.setItem(ROLE_PIN_KEY, pin);
      _setRole('admin', 'Admin', null, null);
    } else {
      errEl.textContent = 'Incorrect PIN.';
      document.getElementById('fallback-pin-input').value = '';
    }
  } catch { errEl.textContent = 'Connection error.'; }
  finally { const b = document.getElementById('fallback-pin-submit'); if (b) { b.textContent = 'Enter →'; b.disabled = false; } }
}

function _setRole(type, name, allowedDepts, roleId) {
  sessionStorage.setItem(ROLE_TYPE_KEY, type);
  sessionStorage.setItem(ROLE_NAME_KEY, name);
  if (allowedDepts) sessionStorage.setItem(ROLE_ALLOWED_KEY, JSON.stringify(allowedDepts));
  else sessionStorage.removeItem(ROLE_ALLOWED_KEY);
  if (roleId) sessionStorage.setItem(ROLE_ID_KEY, roleId);
  else sessionStorage.removeItem(ROLE_ID_KEY);
  _applyRole(type);
}

function _applyRole(type) {
  // Hide gate with animation
  const gate = document.getElementById('role-gate');
  gate.classList.add('fade-out');
  setTimeout(() => { gate.style.display = 'none'; }, 350);

  // Set body class for CSS role-gating (always clear old role classes first)
  document.body.classList.remove('is-admin', 'is-custom', 'is-viewer');
  if      (type === 'admin')  document.body.classList.add('is-admin');
  else if (type === 'custom') document.body.classList.add('is-custom');
  else                        document.body.classList.add('is-viewer');

  // Role badge
  const badge = document.getElementById('role-badge');
  const name  = getRoleName();
  if (type === 'admin') {
    badge.textContent = '👑 Admin';
    badge.className   = 'badge-admin';
  } else if (type === 'custom') {
    badge.textContent = `👁 ${name}`;
    badge.className   = 'badge-custom';
  } else {
    badge.textContent = '👁 Viewer';
    badge.className   = 'badge-viewer';
  }

  // Show app
  document.getElementById('app').classList.remove('hidden');

  if (_onRoleSet) _onRoleSet(type);
}
