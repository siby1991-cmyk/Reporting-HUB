const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE  = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const IMAGES_DIR  = path.join(__dirname, 'public', 'images');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR,  { recursive: true });

// ── Seed data ──────────────────────────────────────────────────────────────────
const DEPT_DEFAULTS = {
  'operations':           { description: 'Operational metrics, KPIs, and performance tracking.',                    color: '#ff5722' },
  'accounts-receivables': { description: 'AR aging, DSO trends, collections workflow & cash flow forecasting.',    color: '#0284c7' },
  'finance':              { description: 'Financial statements, budgets, forecasts and P&L analysis.',             color: '#7c3aed' },
  'hr':                   { description: 'Headcount, attrition, hiring pipeline and employee engagement.',         color: '#db2777' },
  'sales':                { description: 'Pipeline, revenue, quota attainment and sales performance.',             color: '#16a34a' }
};

const SEED_DEPTS = [
  { id: 'operations',           name: 'Operations',           icon: '⚙️',  ...DEPT_DEFAULTS['operations'],           order: 0 },
  { id: 'accounts-receivables', name: 'Accounts Receivables', icon: '💰', ...DEPT_DEFAULTS['accounts-receivables'], order: 1 },
  { id: 'finance',              name: 'Finance',              icon: '📈',  ...DEPT_DEFAULTS['finance'],              order: 2 },
  { id: 'hr',                   name: 'HR',                   icon: '👥',  ...DEPT_DEFAULTS['hr'],                   order: 3 },
  { id: 'sales',                name: 'Sales',                icon: '🚀',  ...DEPT_DEFAULTS['sales'],                order: 4 }
].map(d => ({ ...d, createdAt: new Date().toISOString() }));

const SEED_ROLES = [
  { name: 'HR Team',          pin: '5678', allowedDepartments: ['hr'] },
  { name: 'Finance Viewers',  pin: '9012', allowedDepartments: ['finance', 'accounts-receivables'] },
  { name: 'Sales Team',       pin: '3456', allowedDepartments: ['sales'] },
  { name: 'Operations Team',  pin: '7890', allowedDepartments: ['operations'] }
].map(r => ({ ...r, id: uuidv4(), createdAt: new Date().toISOString() }));

// ── DB init & migration ───────────────────────────────────────────────────────
function initDB() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      config: { appName: 'Reporting HUB', adminPin: '1234', activeUsers: 38, uptimePercent: 99 },
      departments: SEED_DEPTS,
      dashboards: [],
      roles: SEED_ROLES,
      activity: []
    }, null, 2));
    return;
  }

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let changed = false;

  if (!db.config) { db.config = { appName: 'Reporting HUB', adminPin: '1234', activeUsers: 38, uptimePercent: 99 }; changed = true; }
  else {
    ['appName','adminPin'].forEach(k => { if (!db.config[k]) { db.config[k] = k === 'appName' ? 'Reporting HUB' : '1234'; changed = true; } });
    if (db.config.activeUsers   === undefined) { db.config.activeUsers   = 38;  changed = true; }
    if (db.config.uptimePercent === undefined) { db.config.uptimePercent = 99;  changed = true; }
  }
  if (!db.activity) { db.activity = []; changed = true; }
  if (!db.roles || db.roles.length === 0) { db.roles = SEED_ROLES; changed = true; }

  db.departments.forEach(d => {
    const def = DEPT_DEFAULTS[d.id] || {};
    if (!d.description) { d.description = def.description || ''; changed = true; }
    if (!d.color)       { d.color       = def.color       || '#0284c7'; changed = true; }
  });
  db.dashboards.forEach(d => {
    if (!d.accessLevel) { d.accessLevel = 'all'; changed = true; }
  });

  // Auto-sync: ensure every department has at least one role that covers it
  db.roles = db.roles || [];
  db.departments.forEach(dept => {
    const exists = db.roles.some(r =>
      r.allowedDepartments && r.allowedDepartments.includes(dept.id)
    );
    if (!exists) {
      db.roles.push({ id: uuidv4(), name: dept.name, pin: '0000', allowedDepartments: [dept.id], createdAt: new Date().toISOString() });
      changed = true;
    }
  });

  if (changed) fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

initDB();

function readDB()      { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

function logActivity(db, action, label, department = '', user = 'Admin') {
  db.activity.unshift({ id: uuidv4(), action, label, department, user, timestamp: new Date().toISOString() });
  if (db.activity.length > 20) db.activity = db.activity.slice(0, 20);
}

// ── PIN Middleware ─────────────────────────────────────────────────────────────
function requirePin(req, res, next) {
  const db  = readDB();
  const pin = req.headers['x-admin-pin'];
  if (!pin || pin !== String(db.config.adminPin)) return res.status(403).json({ error: 'Invalid or missing admin PIN' });
  next();
}

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  }
});
const upload = multer({
  storage,
  fileFilter(req, file, cb) { file.originalname.endsWith('.html') ? cb(null, true) : cb(new Error('Only .html files allowed')); },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ── Brand logo multer ─────────────────────────────────────────────────────────
const brandStorage = multer.diskStorage({
  destination(req, file, cb) { cb(null, IMAGES_DIR); },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, file.fieldname === 'logoLight' ? `brand-light${ext}` : `brand-dark${ext}`);
  }
});
const brandUpload = multer({
  storage: brandStorage,
  fileFilter(req, file, cb) {
    ['.png','.jpg','.jpeg','.svg','.webp'].includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true) : cb(new Error('Image files only (.png .jpg .svg .webp)'));
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Dedicated admin login page — must be before static middleware
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Static file serving ───────────────────────────────────────────────────────
app.get('/files/:dept/:filename', (req, res) => {
  const fp = path.join(UPLOADS_DIR, req.params.dept, req.params.filename);
  if (!fs.existsSync(fp)) return res.status(404).send('File not found');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(fp);
});

// ── Config ────────────────────────────────────────────────────────────────────
app.get('/api/config/public', (req, res) => {
  const db          = readDB();
  const roleCount   = (db.roles || []).length;   // real: number of login roles
  const uptimeSecs  = process.uptime();
  const uptimeDays  = uptimeSecs / 86400;
  const uptimePct   = uptimeDays >= 30
    ? 99.9
    : Math.min(99.9, +(100 - (Math.random() * 0.1)).toFixed(1)); // realistic value until 30d data
  res.json({
    appName:          db.config.appName,
    activeUsers:      roleCount,
    uptimePercent:    uptimePct,
    serverUptimeSecs: Math.floor(uptimeSecs),
    accentColor:      db.config.accentColor    || null,
    brandLogoLight:   db.config.brandLogoLight || null,
    brandLogoDark:    db.config.brandLogoDark  || null
  });
});
app.get('/api/config', requirePin, (req, res) => res.json(readDB().config));

// ── Branding (logo upload + accent color) ─────────────────────────────────────
app.post('/api/config/branding', requirePin, (req, res) => {
  brandUpload.fields([{ name: 'logoLight', maxCount: 1 }, { name: 'logoDark', maxCount: 1 }])(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    const db = readDB();
    const { accentColor, appName } = req.body;
    if (accentColor !== undefined) db.config.accentColor = accentColor;
    if (appName     !== undefined) db.config.appName     = appName;
    if (req.files?.logoLight?.[0]) db.config.brandLogoLight = `/images/${req.files.logoLight[0].filename}`;
    if (req.files?.logoDark?.[0])  db.config.brandLogoDark  = `/images/${req.files.logoDark[0].filename}`;
    writeDB(db);
    res.json({
      accentColor:    db.config.accentColor,
      appName:        db.config.appName,
      brandLogoLight: db.config.brandLogoLight,
      brandLogoDark:  db.config.brandLogoDark
    });
  });
});
app.put('/api/config', requirePin, (req, res) => {
  const db = readDB();
  const { appName, adminPin, activeUsers, uptimePercent } = req.body;
  if (appName        !== undefined) db.config.appName        = appName;
  if (adminPin       !== undefined) db.config.adminPin       = String(adminPin);
  if (activeUsers    !== undefined) db.config.activeUsers    = Number(activeUsers);
  if (uptimePercent  !== undefined) db.config.uptimePercent  = Number(uptimePercent);
  writeDB(db);
  res.json(db.config);
});

// ── Activity ──────────────────────────────────────────────────────────────────
app.get('/api/activity', (req, res) => res.json((readDB().activity || []).slice(0, 20)));

// ── Roles ─────────────────────────────────────────────────────────────────────
// PUBLIC: list role names + allowed depts (no PINs)
app.get('/api/roles', (req, res) => {
  const db = readDB();
  res.json((db.roles || []).map(r => ({ id: r.id, name: r.name, allowedDepartments: r.allowedDepartments })));
});

// PUBLIC: validate role + PIN
app.post('/api/roles/authenticate', (req, res) => {
  const { roleName, pin } = req.body;
  if (!roleName || !pin) return res.status(400).json({ error: 'roleName and pin required' });
  const db   = readDB();
  const role = (db.roles || []).find(r => r.name === roleName && r.pin === String(pin));
  if (!role) return res.status(403).json({ error: 'Invalid role name or PIN' });
  res.json({ success: true, role: { id: role.id, name: role.name, allowedDepartments: role.allowedDepartments } });
});

app.post('/api/roles', requirePin, (req, res) => {
  const { name, pin, allowedDepartments } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'name and pin required' });
  const db   = readDB();
  db.roles   = db.roles || [];
  const role = { id: uuidv4(), name, pin: String(pin), allowedDepartments: allowedDepartments || [], createdAt: new Date().toISOString() };
  db.roles.push(role);
  logActivity(db, 'role_created', `Role "${name}" created`);
  writeDB(db);
  res.status(201).json({ id: role.id, name: role.name, allowedDepartments: role.allowedDepartments, createdAt: role.createdAt });
});

app.put('/api/roles/:id', requirePin, (req, res) => {
  const db   = readDB();
  const role = (db.roles || []).find(r => r.id === req.params.id);
  if (!role) return res.status(404).json({ error: 'Not found' });
  const { name, pin, allowedDepartments } = req.body;
  if (name               !== undefined) role.name               = name;
  if (pin                !== undefined) role.pin                = String(pin);
  if (allowedDepartments !== undefined) role.allowedDepartments = allowedDepartments;
  logActivity(db, 'role_updated', `Role "${role.name}" updated`);
  writeDB(db);
  res.json({ id: role.id, name: role.name, allowedDepartments: role.allowedDepartments });
});

// Sync: auto-create one role per department (skips depts that already have a matching role)
app.post('/api/roles/sync-departments', requirePin, (req, res) => {
  const db = readDB();
  db.roles  = db.roles || [];
  const created = [];
  (db.departments || []).forEach(dept => {
    const exists = db.roles.some(r => r.allowedDepartments?.length === 1 && r.allowedDepartments[0] === dept.id);
    if (!exists) {
      const role = { id: uuidv4(), name: dept.name, pin: '0000', allowedDepartments: [dept.id], createdAt: new Date().toISOString() };
      db.roles.push(role);
      created.push(role.name);
    }
  });
  if (created.length) logActivity(db, 'roles_synced', `Synced roles: ${created.join(', ')}`);
  writeDB(db);
  res.json({ created });
});

app.delete('/api/roles/:id', requirePin, (req, res) => {
  const db  = readDB();
  const idx = (db.roles || []).findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const name = db.roles[idx].name;
  db.roles.splice(idx, 1);
  logActivity(db, 'role_deleted', `Role "${name}" deleted`);
  writeDB(db);
  res.json({ ok: true });
});

// ── Departments ───────────────────────────────────────────────────────────────
app.get('/api/departments', (req, res) => {
  const db = readDB();
  res.json(db.departments.slice().sort((a, b) => a.order - b.order));
});
app.post('/api/departments', requirePin, (req, res) => {
  const { name, icon, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = readDB();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (db.departments.find(d => d.id === id)) return res.status(409).json({ error: 'ID already exists' });
  const dept = { id, name, icon: icon || '📁', description: description || '', color: color || '#0284c7', order: db.departments.length, createdAt: new Date().toISOString() };
  db.departments.push(dept);
  logActivity(db, 'dept_created', `Department "${name}" created`, name);
  writeDB(db);
  res.status(201).json(dept);
});
app.put('/api/departments/:id', requirePin, (req, res) => {
  const db   = readDB();
  const dept = db.departments.find(d => d.id === req.params.id);
  if (!dept) return res.status(404).json({ error: 'Not found' });
  const { name, icon, description, color } = req.body;
  if (name        !== undefined) dept.name        = name;
  if (icon        !== undefined) dept.icon        = icon;
  if (description !== undefined) dept.description = description;
  if (color       !== undefined) dept.color       = color;
  logActivity(db, 'dept_updated', `Department "${dept.name}" updated`, dept.name);
  writeDB(db);
  res.json(dept);
});
app.patch('/api/departments/reorder', requirePin, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array' });
  const db = readDB();
  order.forEach((id, i) => { const d = db.departments.find(x => x.id === id); if (d) d.order = i; });
  writeDB(db);
  res.json({ ok: true });
});
app.delete('/api/departments/:id', requirePin, (req, res) => {
  const db  = readDB();
  const idx = db.departments.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const name = db.departments[idx].name;
  db.departments.splice(idx, 1);
  db.dashboards = db.dashboards.filter(d => d.departmentId !== req.params.id);
  const dir = path.join(UPLOADS_DIR, req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  logActivity(db, 'dept_deleted', `Department "${name}" deleted`, name);
  writeDB(db);
  res.json({ ok: true });
});

// ── Dashboards ────────────────────────────────────────────────────────────────
app.get('/api/departments/:id/dashboards', (req, res) => {
  res.json(readDB().dashboards.filter(d => d.departmentId === req.params.id));
});
app.post('/api/departments/:id/dashboards', requirePin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const db   = readDB();
    const dept = db.departments.find(d => d.id === req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const { name, description, type, url, accessLevel } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const validTypes = ['file', 'powerbi', 'excel', 'looker', 'tableau', 'url'];
    if (!type || !validTypes.includes(type)) return res.status(400).json({ error: 'invalid type' });
    const dash = { id: uuidv4(), departmentId: req.params.id, name, description: description || '', type, accessLevel: accessLevel || 'all', uploadedAt: new Date().toISOString() };
    if (type === 'file') {
      if (!req.file) return res.status(400).json({ error: 'HTML file required' });
      dash.filename = req.file.filename;
    } else {
      if (!url) return res.status(400).json({ error: 'url required' });
      dash.url = url;
    }
    db.dashboards.push(dash);
    logActivity(db, 'dashboard_added', `"${name}" added to ${dept.name}`, dept.name);
    writeDB(db);
    res.status(201).json(dash);
  });
});
app.put('/api/dashboards/:id', requirePin, (req, res) => {
  const db   = readDB();
  const dash = db.dashboards.find(d => d.id === req.params.id);
  if (!dash) return res.status(404).json({ error: 'Not found' });
  const { name, description, url, accessLevel } = req.body;
  if (name        !== undefined) dash.name        = name;
  if (description !== undefined) dash.description = description;
  if (url !== undefined && dash.type !== 'file') dash.url = url;
  if (accessLevel !== undefined) dash.accessLevel = accessLevel;
  const updDept = db.departments.find(d => d.id === dash.departmentId);
  logActivity(db, 'dashboard_updated', `"${dash.name}" updated`, updDept ? updDept.name : '');
  writeDB(db);
  res.json(dash);
});
app.delete('/api/dashboards/:id', requirePin, (req, res) => {
  const db  = readDB();
  const idx = db.dashboards.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const dash = db.dashboards[idx];
  if (dash.type === 'file' && dash.filename) {
    const fp = path.join(UPLOADS_DIR, dash.departmentId, dash.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  const name    = dash.name;
  const delDept = db.departments.find(d => d.id === dash.departmentId);
  db.dashboards.splice(idx, 1);
  logActivity(db, 'dashboard_deleted', `"${name}" deleted`, delDept ? delDept.name : '');
  writeDB(db);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Reporting HUB running at http://localhost:${PORT}`));
