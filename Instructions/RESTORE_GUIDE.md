# Restore Guide — Reporting HUB

---

## Restore Points (Tags)

| Tag | Description | Date |
|-----|-------------|------|
| `v1.0` | Stable — role-scoped access, favorites, admin logout fix | 2026-03-15 |

---

## Option 1 — Restore from Local Folder (Fastest)

Use this if your files are still in `F:\Claude\reporting-hub`.

**Step 1** — Open terminal and go to project folder:
```
cd F:\Claude\reporting-hub
```

**Step 2** — Restore to v1.0:
```
git checkout v1.0
```

**Step 3** — Start the server:
```
node server.js
```

Done. All files are back to the v1.0 state.

---

## Option 2 — Restore from GitHub (If Local Files Are Lost)

Use this if the local folder is missing, corrupted, or on a new machine.

**Step 1** — Clone the repo into a new folder:
```
git clone https://github.com/siby1991-cmyk/Reporting-HUB.git
```

**Step 2** — Go into the folder:
```
cd Reporting-HUB
```

**Step 3** — Switch to the restore point:
```
git checkout v1.0
```

**Step 4** — Install dependencies:
```
npm install
```

**Step 5** — Start the server:
```
node server.js
```

Open browser at `http://localhost:3000`

---

## After Restoring — Go Back to Latest Version

If you restored to v1.0 but want the latest version again:
```
git checkout master
```

---

## Check What Restore Points Are Available
```
git tag
```

## Check Full Version History
```
git log --oneline
```

---

## Important Notes

> - The restore point is saved both **locally** (`.git` folder in `F:\Claude\reporting-hub`) and on **GitHub**.
> - Restoring does **not** delete your `data\db.json` (your departments, dashboards, roles stay intact).
> - If you want to also restore the data, manually copy `data\db.json` from a backup.
> - After restoring, always run `node server.js` to start the app.

---

## Project Location
```
F:\Claude\reporting-hub\
```

## GitHub Repo
```
https://github.com/siby1991-cmyk/Reporting-HUB
```
