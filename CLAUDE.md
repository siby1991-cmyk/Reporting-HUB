# Reporting HUB — Project Reference (CLAUDE.md)

## Project Overview

A self-contained web application for hosting and viewing reporting dashboards, organized by department.
The Admin (Siby) can upload HTML dashboards, paste Power BI/embed URLs, manage all departments, and create
custom roles with department-scoped access. Users access the hub via a shared cloud URL using a named role + PIN.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express |
| Frontend | Vanilla HTML / CSS / JS (no framework, no build step) |
| File Uploads | Multer (multipart middleware) |
| Metadata Storage | Flat JSON file (`data/db.json`) |
| File Storage (Local) | File system (`uploads/[dept-id]/`) |
| File Storage (Cloud) | Persistent Disk (Railway or Render volume mount at `/app/uploads`) |
| Containerization | Docker (`Dockerfile` included) |
| Auth / Role Gate | Frontend named-role + PIN selector (stored in `sessionStorage`) |
| Theme | CSS variable dual theme (Light default + Dark), toggled via topbar, stored in `localStorage` |

---

## File Structure

```
reporting-hub/
├── Dockerfile
├── .dockerignore
├── package.json
├── server.js                   # Express backend (API + static file serving)
├── CLAUDE.md                   # This file
├── DEPLOY.md                   # Step-by-step cloud deployment guide
├── data/
│   └── db.json                 # Departments, dashboards, roles, config, activity
├── uploads/
│   └── [dept-id]/
└── public/
    ├── index.html              # App shell (single page)
    ├── css/
    │   └── style.css           # All UI styles — light + dark themes via CSS variables
    └── js/
        ├── app.js              # All frontend logic (routing, API calls, UI rendering)
        ├── auth.js             # Role gate, PIN check, session management
        └── theme.js            # Theme toggle (light/dark, localStorage persistence)
```

---

## Role-Based Access System

### Role Types

| Role | Type | Access | Entry |
|---|---|---|---|
| **Admin** | System | Full CRUD — departments, dashboards, roles, settings | PIN (default: `1234`) |
| **Custom Role** | Admin-created | Scoped read-only — sees only assigned departments | Role name + PIN set by Admin |

### How It Works

1. Admin creates custom roles from the **Access Control** page (e.g. "HR Team", "Finance Viewers").
2. Each role gets a **name**, a **PIN**, and a list of **allowed departments**.
3. On the Role Gate, users select their role name from a dropdown + enter PIN.
4. On success: only allowed departments appear in sidebar and home grid.
5. Dashboards from non-allowed departments are completely hidden.

### Role Gate Behaviour
- Full-screen overlay on first load.
- Dropdown of all role names + PIN field.
- Role + allowed departments stored in `sessionStorage`.
- **"Switch Role"** always available in sidebar bottom.
- Fallback: if no custom roles exist, show two-card layout (Admin 👑 / Viewer 👁).

### Admin Capabilities (Exclusively)
- ✏️ Edit + 🗑 Delete on every department card
- ➕ Add Department (sidebar + empty grid card)
- ➕ Add Dashboard (section CTA)
- Drag-and-drop reorder departments in sidebar
- Access Control page — create/edit/delete custom roles
- Settings modal — app name, PIN, user count
- Lime green admin banner at top
- All embed buttons fully clickable

### Custom Role Capabilities
- Sees only assigned departments (others fully hidden)
- View and open dashboards (read-only)
- No add/edit/delete controls anywhere
- Cyan scope banner: "👁 [Role Name] — Viewing: [Dept1], [Dept2]..."
- Lock bar at bottom: "🔒 [Role Name] — view-only access"

### Viewer Fallback
- If no custom roles: Viewer card gives read-only access to all departments

---

## Access Control Page (Admin Only)

### Features
- List of all custom roles: name, masked PIN, department badges
- **+ Create Role** button in header
- Edit ✏️ and Delete 🗑 per role

### Create / Edit Role Modal
- Role Name, PIN (password input), Allowed Departments (multi-select checklist with color chips)

### Seed Roles

| Role Name | PIN | Allowed Departments |
|---|---|---|
| HR Team | 5678 | HR only |
| Finance Viewers | 9012 | Finance + Accounts Receivables |
| Sales Team | 3456 | Sales only |
| Operations Team | 7890 | Operations only |

---

## Features

### Department Management (Admin only)
- Add: name, emoji icon, description, URL slug, accent color
- Edit, reorder (drag-and-drop), delete with confirmation

### Dashboard Management
- Types: `file`, `powerbi`, `excel`, `looker`, `tableau`, `url`
- View (iframe), open new tab, edit, delete
- Access level: `"all"` or `"admin"`

### Search
- Topbar search — real-time client-side filter, role-scoped

### Theme
- **Light** (default) and **Dark**
- Toggle 🌙 / ☀️ in topbar, persisted in `localStorage`
- CSS variable swap on `<body data-theme="dark">`
- All transitions: `transition: background 0.2s, color 0.2s, border-color 0.2s`

### Recent Activity Feed
- Last 5 on home overview, max 20 in `db.json`

### Stats Bar
- Total Dashboards, Departments, Active Users, Uptime %

### Favorites & Recently Viewed
- `localStorage` — shown in sidebar Quick Links

---

## ═══════════════════════════════════════
## UI DESIGN SPEC — LIGHT THEME (Default)
## ═══════════════════════════════════════

### Inspiration
Reference: Image 1 — WORKSPACE dashboard.
Clean white workspace, lime-green accent, rounded pill buttons, soft drop shadows,
generous white space, card-based layout with subtle borders. Professional and airy.

### Fonts
- Display / Logo: **Plus Jakarta Sans** (800) — Google Fonts
- Body / UI: **Plus Jakarta Sans** (400, 500, 600) — same family, different weights
- Numbers / Stats: **Instrument Serif** (italic) for large stat values — adds character

### Light Theme CSS Variables
```css
[data-theme="light"], :root {
  --bg:          #f4f5f7;       /* page background — very light grey */
  --bg2:         #ffffff;       /* sidebar, cards — pure white */
  --bg3:         #f0f1f5;       /* input backgrounds, inner surfaces */
  --bg4:         #e8eaef;       /* hover states */
  --sidebar-bg:  #ffffff;       /* sidebar always white */
  --topbar-bg:   #ffffff;       /* topbar always white */
  --border:      rgba(0,0,0,0.07);
  --borderB:     rgba(0,0,0,0.13);
  --text:        #0d1117;       /* PRIMARY — near black, always readable */
  --text2:       #374151;       /* secondary text */
  --muted:       #6b7280;       /* meta, timestamps */
  --muted2:      #4b5563;       /* section labels */
  --accent:      #aaeb3d;       /* LIME GREEN — signature accent (Image 1) */
  --accent-text: #3d6b00;       /* dark green for text ON lime backgrounds */
  --accent2:     #1a1a1a;       /* near-black pill buttons */
  --surface:     rgba(0,0,0,0.03);
  --shadow:      0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-lg:   0 8px 32px rgba(0,0,0,0.10);
  --shadow-card: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05);
  --radius:      18px;          /* main cards */
  --radius-sm:   10px;          /* buttons, inputs, badges */
  --radius-pill: 999px;         /* pill buttons */

  /* Department accent colors — saturated for light bg */
  --ops:   #ff5722;
  --ar:    #0284c7;
  --fin:   #7c3aed;
  --hr:    #db2777;
  --sales: #16a34a;
  --gold:  #d97706;             /* admin accent */
}
```

### Light Theme Design Rules

**Sidebar**
- Background: `var(--sidebar-bg)` = white
- Right border: `1px solid var(--border)`
- Logo: "REPORTING HUB" in **Plus Jakarta Sans 800**, `var(--text)` black
- Logo accent dot or icon: lime `var(--accent)` filled circle
- Nav item text: `var(--text)` — fully black, weight 600
- Active nav item: lime `var(--accent)` left border (3px) + `rgba(170,235,61,0.12)` background tint
- Section labels (DEPARTMENTS, QUICK LINKS): 10px uppercase, `var(--muted2)`, letter-spacing 0.12em
- Dashboard count badges: rounded pill, `var(--bg3)` bg, `var(--muted2)` text
- Active badge: lime bg `var(--accent)`, `var(--accent-text)` text
- "+ Add Department" button: dashed border, `var(--muted)` text, hover → lime tint
- Bottom area: "Switch Role" link, subtle `var(--muted)` text

**Topbar**
- Background: white `var(--topbar-bg)`, bottom border `var(--border)`
- Search bar: `var(--bg3)` background, `var(--border)` border, `var(--radius-sm)` radius
- Search focus: border-color `var(--accent)`, box-shadow `0 0 0 3px rgba(170,235,61,0.2)`
- Theme toggle button: rounded pill, `var(--bg3)` bg, black icon
- Avatar: lime gradient or black circle with white initial
- Admin badge in topbar: black pill "👑 Admin" with white text (like Image 1 top-right avatar)

**Admin Banner** (lime, below topbar)
- Background: `var(--accent)` lime green
- Text: `var(--accent-text)` dark green — "Admin Mode — Full edit access"
- Pulsing dot: dark green
- "Switch to Viewer →" right-aligned, dark green text

**Stats Cards** (4-column row)
- Background: white `var(--bg2)`
- Border: `var(--border)`
- Shadow: `var(--shadow-card)`
- Border-radius: `var(--radius)`
- Top accent line: 2px, per-stat gradient
- Value: **Instrument Serif italic**, 32px, `var(--text)`
- Label: Plus Jakarta Sans 500, 12px, `var(--muted2)`
- Icon: emoji or SVG, top-right, 20px

**Department Cards** (3-column grid)
- Background: white `var(--bg2)`
- Border: `1px solid var(--border)`
- Shadow: `var(--shadow-card)`
- Border-radius: `var(--radius)`
- Hover: shadow lifts to `var(--shadow-lg)`, border-color → dept accent color, translate -2px
- Dept icon: 48px rounded square, `rgba(accent, 0.12)` background, emoji inside
- Status pill: small rounded pill, `rgba(accent, 0.1)` bg, accent-colored dot + "Active" text
- Dept name: Plus Jakarta Sans 700, 17px, `var(--text)`
- Description: 13px, `var(--muted2)`, line-height 1.6
- Dashboard count: accent-colored bold number + " dashboards" in muted
- Edit/Delete buttons: only visible to Admin — small rounded buttons, subtle on idle, colored on hover
- Arrow button: rounded square, `var(--bg3)` bg → dept accent on card hover

**"Add Department" card** (last in grid, Admin only)
- Dashed border `var(--border)`, transparent bg
- Hover: dashed border goes lime, `rgba(170,235,61,0.05)` tint
- "+" icon 28px grey, "New Department" label below in muted

**Modals**
- Background: white, `var(--radius)` border-radius
- Shadow: `var(--shadow-lg)`
- Backdrop: `rgba(0,0,0,0.4)` blur(8px)
- Primary button: black `var(--accent2)` bg, white text, pill shape
- Accent button: lime `var(--accent)` bg, `var(--accent-text)` text, pill shape
- Cancel: `var(--bg3)` bg, `var(--muted2)` text
- Input focus: lime border + lime glow

**Buttons (general)**
- Primary CTA: black pill `var(--accent2)`, white text — like "+ New Task" in Image 1
- Secondary CTA: lime pill `var(--accent)`, dark green text
- Ghost: `var(--bg3)` bg, `var(--text2)` text, `var(--border)` border

**Toast**
- White card, `var(--shadow-lg)`, colored left border (3px) — green success, red error

**Viewer Lock Bar**
- White pill with border, bottom-center, shadow, lock icon + muted text

---

## ════════════════════════════════════
## UI DESIGN SPEC — DARK THEME
## ════════════════════════════════════

### Inspiration
Reference: Image 2 — Book tracker app.
Deep cool-grey background, frosted glass cards, colorful stat tiles (amber, purple, green),
glassmorphism sidebar, soft blurred ambient light behind elements. Rich and immersive.

### Dark Theme CSS Variables
```css
[data-theme="dark"] {
  --bg:          #1c1f26;       /* page background — deep cool grey (Image 2) */
  --bg2:         #252932;       /* cards, sidebar — slightly lighter */
  --bg3:         #2e3340;       /* inputs, inner surfaces */
  --bg4:         #363c4a;       /* hover states */
  --sidebar-bg:  rgba(37,41,50,0.85);  /* frosted glass sidebar */
  --topbar-bg:   rgba(28,31,38,0.90);  /* frosted topbar */
  --border:      rgba(255,255,255,0.07);
  --borderB:     rgba(255,255,255,0.14);
  --text:        #ffffff;       /* PRIMARY — full white */
  --text2:       #e2e8f0;       /* secondary */
  --muted:       #94a3b8;       /* meta, timestamps — readable */
  --muted2:      #cbd5e1;       /* section labels — clearly visible */
  --accent:      #a8e63d;       /* keep lime for consistency with light */
  --accent-text: #1a1a1a;       /* dark text on lime */
  --accent2:     #ffffff;
  --surface:     rgba(255,255,255,0.05);
  --shadow:      0 2px 12px rgba(0,0,0,0.3);
  --shadow-lg:   0 8px 40px rgba(0,0,0,0.45);
  --shadow-card: 0 2px 8px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.2);
  --radius:      18px;
  --radius-sm:   10px;
  --radius-pill: 999px;
  --blur:        backdrop-filter: blur(16px) saturate(1.4);

  /* Colorful stat tile colors — Image 2 style */
  --tile-amber:  #f59e0b;
  --tile-purple: #8b5cf6;
  --tile-green:  #10b981;
  --tile-pink:   #ec4899;

  /* Department colors — vivid for dark bg */
  --ops:   #ff7040;
  --ar:    #00d4ff;
  --fin:   #8b6fff;
  --hr:    #ff4d8f;
  --sales: #00e5a0;
  --gold:  #fbbf24;             /* admin accent */
}
```

### Dark Theme Design Rules

**Page Background**
- `var(--bg)` = `#1c1f26` deep cool grey
- Ambient blurred orbs (CSS only, `pointer-events:none`, `z-index:0`):
  - Top-left: `radial-gradient(circle, rgba(168,230,61,0.04), transparent 60%)` — lime tint
  - Bottom-right: `radial-gradient(circle, rgba(139,92,246,0.06), transparent 60%)` — violet
  - Center: `radial-gradient(circle, rgba(16,185,129,0.03), transparent 50%)` — green

**Sidebar**
- Background: `var(--sidebar-bg)` with `backdrop-filter: blur(16px)`
- Right border: `1px solid var(--border)`
- Logo: white text, lime accent mark
- Nav text: `var(--text)` = white, weight 600 — always fully visible
- Active item: lime left border + `rgba(168,230,61,0.08)` bg tint
- Section labels: `var(--muted2)` = `#cbd5e1` — clearly readable, small caps
- Badge pills: `var(--bg3)` bg, `var(--muted2)` text; active → lime bg, dark text

**Topbar**
- Background: `var(--topbar-bg)` with blur
- Search: `var(--bg3)` bg, `var(--border)` border; focus → lime border + glow
- Theme toggle: `var(--bg3)` pill, white icon

**Admin Banner** (dark mode — amber/gold)
- Background: `rgba(251,191,36,0.1)` — amber tint
- Border-bottom: `1px solid rgba(251,191,36,0.2)`
- Text: `var(--gold)` = `#fbbf24`
- Pulsing dot: amber, animated

**Stats Cards** — Image 2 colorful tile style
- Each stat card gets a bold background COLOR (not just a top line):
  - Total Dashboards: amber `#f59e0b` card, black text
  - Departments: purple `#8b5cf6` card, white text
  - Active Users: green `#10b981` card, white text
  - Uptime: dark card `var(--bg2)` with lime top border
- Large stat value: **Instrument Serif italic**, 32px — white or black depending on bg
- Label: Plus Jakarta Sans 500, 12px, semi-transparent white/black
- These colored tiles are the signature of the dark theme — bold, expressive, like Image 2

**Department Cards**
- Background: `var(--bg2)` = `#252932`
- Border: `var(--border)`
- Shadow: `var(--shadow-card)`
- Border-radius: `var(--radius)`
- Hover: dept-color border + dept-color glow shadow + translate -3px
- Glow orb (top-right corner): radial gradient in dept color, opacity 0.07 → 0.15 on hover
- Dept name: white, Plus Jakarta Sans 700
- Description: `var(--muted2)` = `#cbd5e1` — readable grey-blue
- Count: dept-colored bold number

**Modals**
- Background: `var(--bg2)`, border `var(--borderB)`
- Backdrop: `rgba(0,0,0,0.7)` blur(10px)
- Primary button: lime `var(--accent)` bg, dark text, pill
- Cancel: `var(--bg3)` bg, `var(--muted2)` text

**Toast**
- `var(--bg2)` bg, `var(--borderB)` border, dept-colored left border, shadow

---

## SHARED DESIGN RULES (both themes)

### Typography
- All headings: **Plus Jakarta Sans** 700–800
- All body: **Plus Jakarta Sans** 400–600
- Large stat numbers: **Instrument Serif** italic — gives warmth and character
- Google Fonts import:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  ```

### Border Radius
- Main cards, modals, sidebar panels: `18px`
- Buttons, inputs, badges, small elements: `10px`
- Pill buttons and tags: `999px`

### Spacing
- Sidebar width: `256px`
- Main content padding: `32px 28px`
- Card padding: `22px 24px`
- Grid gap (dept cards): `18px`
- Stats grid gap: `14px`

### Transitions
```css
transition: background 0.2s ease, color 0.2s ease,
            border-color 0.2s ease, box-shadow 0.2s ease,
            transform 0.2s ease;
```

### Sidebar Nav — CRITICAL TEXT RULE
- **Both themes: nav labels use `var(--text)` — never `var(--muted)`**
- Light: `var(--text)` = `#0d1117` (black)
- Dark: `var(--text)` = `#ffffff` (white)
- Weight: 600
- Section labels (DEPARTMENTS, QUICK LINKS): `var(--muted2)`, 10px, uppercase, letter-spacing 0.12em

### Theme Toggle
- Default theme: **Light**
- Light mode button shows: ☀️ (currently light — click for dark)
- Dark mode button shows: 🌙 (currently dark — click for light)
- Applies `data-theme="dark"` to `<body>` element
- Saves to `localStorage` as `theme: "dark"` or `theme: "light"`

### Animations
- Page load: `fadeUp` — `opacity 0→1, translateY 16px→0`, 0.4s ease
- Cards stagger: `animation-delay: 0.05s` per card
- Modal open: scale `0.97→1` + opacity `0→1`, 0.22s ease
- Ambient orbs (dark only): static, no animation — performance-safe
- Admin pulsing dot: `opacity 1→0.4→1`, 2s infinite

---

## Dashboard Types & Compatibility

| Source | Type | Embed Method | Works? |
|---|---|---|---|
| Custom HTML file | `file` | `/files/` route | ✅ Yes |
| Power BI Publish to Web | `powerbi` | iframe src | ✅ Yes |
| Power BI Org Share | `powerbi` | iframe src | ✅ Yes (must be logged in) |
| Excel Online | `excel` | iframe src | ✅ Yes |
| Looker Studio | `looker` | iframe src | ✅ Yes |
| Tableau Public | `tableau` | iframe src | ✅ Yes |
| Grafana Public | `url` | iframe src | ✅ Yes |
| Any URL | `url` | iframe src | ✅ If iframe-compatible |

---

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/departments` | None | List all departments |
| POST | `/api/departments` | Admin PIN | Create department |
| PUT | `/api/departments/:id` | Admin PIN | Edit department |
| PATCH | `/api/departments/reorder` | Admin PIN | Reorder |
| DELETE | `/api/departments/:id` | Admin PIN | Delete dept + dashboards |
| GET | `/api/departments/:id/dashboards` | None | List dashboards |
| POST | `/api/departments/:id/dashboards` | Admin PIN | Add dashboard |
| PUT | `/api/dashboards/:id` | Admin PIN | Edit dashboard |
| DELETE | `/api/dashboards/:id` | Admin PIN | Delete dashboard |
| GET | `/api/roles` | None | List roles (names only) |
| POST | `/api/roles` | Admin PIN | Create role |
| PUT | `/api/roles/:id` | Admin PIN | Edit role |
| DELETE | `/api/roles/:id` | Admin PIN | Delete role |
| POST | `/api/roles/authenticate` | None | Validate role + PIN |
| GET | `/api/activity` | None | Recent activity |
| GET | `/api/config` | Admin PIN | Get config |
| PUT | `/api/config` | Admin PIN | Update config |
| GET | `/files/:dept/:filename` | None | Serve HTML file |

### Auth Header
```
X-Admin-PIN: <pin>
```

### Role Auth Body
```json
{ "roleName": "HR Team", "pin": "5678" }
```
Returns: `{ "success": true, "role": { "id": "uuid", "name": "HR Team", "allowedDepartments": ["hr"] } }`

---

## Data Schema (`data/db.json`)

```json
{
  "config": {
    "appName": "Reporting HUB",
    "adminPin": "1234",
    "activeUsers": 38,
    "uptimePercent": 99
  },
  "departments": [
    {
      "id": "accounts-receivables",
      "name": "Accounts Receivables",
      "icon": "💰",
      "description": "AR aging, DSO trends, collections workflow & cash flow forecasting.",
      "color": "#0284c7",
      "order": 1,
      "createdAt": "ISO-date-string"
    }
  ],
  "dashboards": [
    {
      "id": "uuid",
      "departmentId": "accounts-receivables",
      "name": "AR CFO Dashboard",
      "description": "Live AR metrics for CFO review",
      "type": "file",
      "filename": "uuid-ar-cfo-dashboard.html",
      "accessLevel": "all",
      "uploadedAt": "ISO-date-string"
    }
  ],
  "roles": [
    {
      "id": "uuid",
      "name": "HR Team",
      "pin": "5678",
      "allowedDepartments": ["hr"],
      "createdAt": "ISO-date-string"
    },
    {
      "id": "uuid",
      "name": "Finance Viewers",
      "pin": "9012",
      "allowedDepartments": ["finance", "accounts-receivables"],
      "createdAt": "ISO-date-string"
    },
    {
      "id": "uuid",
      "name": "Sales Team",
      "pin": "3456",
      "allowedDepartments": ["sales"],
      "createdAt": "ISO-date-string"
    },
    {
      "id": "uuid",
      "name": "Operations Team",
      "pin": "7890",
      "allowedDepartments": ["operations"],
      "createdAt": "ISO-date-string"
    }
  ],
  "activity": [
    {
      "id": "uuid",
      "action": "dashboard_updated",
      "label": "AR CFO Dashboard updated",
      "department": "Accounts Receivables",
      "user": "Siby",
      "timestamp": "ISO-date-string"
    }
  ]
}
```

---

## Pre-loaded Departments (Seed Data)

1. Operations ⚙️ — light: `#ff5722` / dark: `#ff7040`
2. Accounts Receivables 💰 — light: `#0284c7` / dark: `#00d4ff`
3. Finance 📈 — light: `#7c3aed` / dark: `#8b6fff`
4. HR 👥 — light: `#db2777` / dark: `#ff4d8f`
5. Sales 🚀 — light: `#16a34a` / dark: `#00e5a0`

---

## Running Locally

```bash
cd F:\Claude\reporting-hub
npm install
node server.js
# Open http://localhost:3000
```

---

## Cloud Deployment Strategy

```
Local (F:\Claude\reporting-hub)
     │  node server.js → localhost:3000
     ▼
GitHub (private repo)
     ▼
Railway or Render (free tier)
     │  Persistent disk at /app/uploads
     │  NODE_ENV=production
     ▼
Public URL → share with all teams
     │
     ├── Admin          → select Admin → PIN 1234 → full access
     ├── HR Team        → select "HR Team" → PIN 5678 → HR only
     ├── Finance        → select "Finance Viewers" → PIN 9012 → Finance + AR
     ├── Sales          → select "Sales Team" → PIN 3456 → Sales only
     └── Operations     → select "Operations Team" → PIN 7890 → Ops only
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| SPA routing | Hash-based (`#/dept/operations`) | No server-side routing needed |
| iframe sandboxing | `sandbox="allow-scripts allow-same-origin"` | Security for uploaded HTML |
| File naming | `[uuid]-[sanitized-name].html` | No collisions |
| Department IDs | URL-safe slugs | Clean paths and API URLs |
| Role gate | Named role + PIN + `sessionStorage` | Scoped auth without OAuth complexity |
| Write auth | `X-Admin-PIN` header server-side | Prevents non-admins calling write APIs |
| Default theme | Light | More universally accessible; dark available via toggle |
| Theme swap | CSS variables on `<body data-theme>` | Zero-JS, instant, no flash |
| Text contrast | `--text: #0d1117` (light) / `#ffffff` (dark) enforced globally | All labels readable in both themes |
| Stat tiles | Colored backgrounds in dark mode (Image 2 style) | Visual richness, easy scanning |
| Search | Client-side, role-scoped | Instant UX |
| Activity log | Append-only array, max 20 FIFO | Lightweight audit trail |
| Favorites/Recent | `localStorage` | Personal, no server needed |

---

## Future Enhancements

- Microsoft SSO / Azure AD (replace PIN with org email)
- Dashboard thumbnails / auto-preview screenshots
- Dashboard version history
- S3 / Cloudflare R2 for file storage at scale
- Per-dashboard view count analytics
- Email notification on new dashboard publish
- Mobile-responsive collapsible sidebar
- Role expiry dates

---

## Owner

Admin: Siby
Team: Nancy, Sandi, Todd, Chandru
Project Folder: `F:\Claude\reporting-hub`
Environment: Local (Windows 11) → Cloud (Railway or Render)
Started: 2026-03-14
Last Updated: 2026-03-15
