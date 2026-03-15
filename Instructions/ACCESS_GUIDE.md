# Reporting HUB — Access Guide

---

## URLs

| Who | URL | Notes |
|-----|-----|-------|
| **All team members** | `http://localhost:3000/` | Role selector — pick your team, enter PIN |
| **Admin only** | `http://localhost:3000/admin` | Dedicated admin PIN page — **keep this URL private, do not share with team** |

> When deployed to the cloud, replace `localhost:3000` with your public URL (e.g. `https://reporting-hub.up.railway.app`).

---

## Login Credentials

### 👑 Admin
| URL | PIN |
|-----|-----|
| `http://localhost:3000/admin` | `1234` |

> Admin has full access: add/edit/delete departments, dashboards, roles, and settings.

---

### 👥 Team Roles (via `http://localhost:3000/`)

| Role | PIN | Access |
|------|-----|--------|
| Accounts Receivables | `0000` ⚠️ | Accounts Receivables dept only |
| Finance Viewers | `9012` | Finance dept only |
| HR Team | `5678` | HR dept only |
| Sales Team | `3456` | Sales dept only |
| Operations Team | `7890` | Operations dept only |
| Accounts Payable | `0000` ⚠️ | Accounts Payable dept only |

> ⚠️ Roles marked with `0000` are auto-created defaults. **Change their PINs before sharing.**
> To reset a PIN: log in as Admin → click ⚙️ Settings → "Reset a Role PIN" section.

---

## How to Change a Role PIN (Admin)

1. Go to `http://localhost:3000/admin` → enter Admin PIN
2. Click the **⚙️ gear icon** (top-right)
3. Scroll to **"Reset a Role PIN"**
4. Select the role → enter new PIN → click **Reset Role PIN →**

---

## How to Add a New Department + Auto-create its Role

1. Log in as Admin
2. Sidebar → **Manage** → **+ Add Department**
3. Fill in name, icon, description → Save
4. The department role is **auto-created on next server restart** with PIN `0000`
5. Reset its PIN via Settings before sharing

---

## Running the Server

```
cd F:\Claude\reporting-hub
node server.js
```

Server runs on port `3000` by default. Keep the terminal open while in use.

---

## Project Location

```
F:\Claude\reporting-hub\
├── server.js           Backend (Node.js + Express)
├── data\db.json        All data (departments, roles, dashboards)
├── uploads\            Uploaded HTML dashboard files
├── public\
│   ├── index.html      Main app (team role gate)
│   ├── admin.html      Admin-only login page
│   ├── css\style.css   All styles
│   └── js\
│       ├── app.js      Frontend logic
│       ├── auth.js     Role gate & session
│       └── theme.js    Light/dark toggle
└── Instructions\       This folder
```
