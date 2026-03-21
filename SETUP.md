# Reporting HUB — Setup Guide

Complete step-by-step instructions to install and run the app from scratch on any Windows machine.

---

## Prerequisites

You need two things installed before starting:

### 1. Node.js (v18 or higher)
- Download from: **https://nodejs.org** → click **"LTS"** (the recommended version)
- Run the installer — keep all default options, click Next through everything
- When done, open **Command Prompt** and verify:
  ```
  node --version
  ```
  You should see something like `v20.x.x`

### 2. Git
- Download from: **https://git-scm.com/download/win**
- Run the installer — keep all defaults, click Next through everything
- When done, verify in Command Prompt:
  ```
  git --version
  ```
  You should see something like `git version 2.x.x`

---

## First-Time Setup (New Machine)

### Step 1 — Clone the repository

Open **Command Prompt** and run:

```bash
cd C:\
git clone https://github.com/siby1991-cmyk/Reporting-HUB.git reporting-hub
cd reporting-hub
```

This downloads all the project files into `C:\reporting-hub`.

### Step 2 — Install dependencies

Still in Command Prompt (inside the `reporting-hub` folder):

```bash
npm install
```

This installs Express, Multer, and UUID — the three packages the app needs. Takes about 30 seconds.

### Step 3 — Start the server

```bash
node server.js
```

You should see:
```
Reporting HUB running at http://localhost:3000
```

### Step 4 — Open the app

Open any browser and go to:
```
http://localhost:3000
```

The Role Gate (login screen) will appear. You're up and running.

---

## Daily Use (Returning to Office / Pulling Updates)

If the app is already set up on the machine and you just need the latest changes:

```bash
cd C:\reporting-hub
git pull origin master
node server.js
```

Then open `http://localhost:3000`.

> **Note:** You don't need to run `npm install` again unless `package.json` changed (you'll be told if it does).

---

## Logging In

### As Admin
- Go to `http://localhost:3000/admin`
- Default PIN: **`1234`**
- You get full access — add departments, dashboards, manage roles, settings

### As a Team Member
At `http://localhost:3000`, select your role from the dropdown:

| Role | PIN | Access |
|---|---|---|
| HR Team | `5678` | HR department only |
| Finance Viewers | `9012` | Finance only |
| Sales Team | `3456` | Sales only |
| Operations Team | `7890` | Operations only |
| Accounts Receivables | `4567` | Accounts Receivables only |
| Accounts Payable | `6789` | Accounts Payable only |

---

## Folder Structure (What's What)

```
reporting-hub/
├── server.js          ← The backend server (run this to start the app)
├── package.json       ← Lists the dependencies
├── data/
│   └── db.json        ← All your data: departments, dashboards, roles (auto-managed)
├── uploads/           ← Uploaded HTML dashboard files (auto-created)
├── public/
│   ├── index.html     ← Main app page
│   ├── admin.html     ← Admin login page
│   ├── css/style.css  ← All styling
│   └── js/            ← App logic (app.js, auth.js, theme.js, shaders)
└── Components/        ← UI design references (not used by the app directly)
```

---

## Changing the Admin PIN

1. Log in as Admin → click ⚙️ Settings in the topbar
2. Change the PIN in the Settings modal
3. Save — takes effect immediately

Or edit `data/db.json` directly:
```json
"config": {
  "adminPin": "your-new-pin"
}
```

---

## Adding a Logo / Brand Colors (White-Label)

1. Log in as Admin → ⚙️ Settings → **Branding** section
2. Upload a **light logo** (shown on light background / role gate)
3. Upload a **dark logo** (shown on dark background / admin login)
4. Pick an **accent color** — the whole app updates live
5. Click **Save Branding**

Logos are stored in `public/images/` and persist across restarts.

---

## Uploading Dashboards

1. Log in as Admin
2. Open a department → click **+ Add Dashboard**
3. Choose type:
   - **File** — upload an `.html` file
   - **Power BI / Looker / Tableau / Excel** — paste the embed URL
4. Set access level: **All roles** or **Admin only**
5. Save — dashboard appears immediately

---

## Stopping the Server

In the Command Prompt window running the server, press:
```
Ctrl + C
```

---

## Troubleshooting

**"node is not recognized"**
→ Node.js not installed or not in PATH. Reinstall from nodejs.org and restart Command Prompt.

**"npm install" fails**
→ Try running Command Prompt as Administrator (right-click → Run as administrator).

**Port 3000 already in use**
→ Another process is using port 3000. Either stop it, or change the port in `server.js`:
```js
const PORT = 3001; // change this line
```
Then access the app at `http://localhost:3001`.

**Changes not showing after git pull**
→ Hard-refresh the browser: `Ctrl + Shift + R`

**Logo not showing**
→ Make sure the `public/images/` folder exists. The server creates it automatically on first start.

---

## Quick Reference Card

```
INSTALL (once):
  1. Install Node.js from nodejs.org
  2. Install Git from git-scm.com
  3. git clone https://github.com/siby1991-cmyk/Reporting-HUB.git reporting-hub
  4. cd reporting-hub
  5. npm install

RUN (daily):
  cd C:\reporting-hub
  git pull origin master
  node server.js
  → Open http://localhost:3000

ADMIN LOGIN:
  → http://localhost:3000/admin   PIN: 1234
```

---

## Owner & Contact

- **Admin:** Siby
- **Repository:** https://github.com/siby1991-cmyk/Reporting-HUB
- **Project folder:** `C:\reporting-hub` (or wherever you cloned it)
