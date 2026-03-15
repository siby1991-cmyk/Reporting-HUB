# Deploying Reporting HUB to the Cloud

## Option A — Railway (Recommended)

### 1. Push to GitHub
```bash
cd F:\Claude\reporting-hub
git init
git add .
git commit -m "Initial commit"
# Create a new PRIVATE repo on github.com, then:
git remote add origin https://github.com/<you>/reporting-hub.git
git push -u origin main
```

### 2. Create a Railway project
1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Select your `reporting-hub` repo
3. Railway will auto-detect the Dockerfile and build it

### 3. Add a Persistent Volume
1. In the Railway project → click **Add Volume**
2. Mount path: `/app/uploads`
3. Also mount `/app/data` (or use the same volume and a sub-path)

> Without a persistent volume, `uploads/` and `data/db.json` are wiped on every redeploy.

### 4. Set Environment Variables
| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | (Railway sets this automatically) |

### 5. Deploy & Share
- Railway gives you a public URL like `https://reporting-hub-production.up.railway.app`
- Share that URL with your peers — no login required

---

## Option B — Render

### 1. Push to GitHub (same as above)

### 2. Create a Render Web Service
1. https://render.com → New → Web Service → Connect your repo
2. Runtime: **Docker**
3. Instance type: Free

### 3. Add a Persistent Disk
1. Service → Disks → Add Disk
2. Mount path: `/app/uploads`
3. Size: 1 GB (free tier)

> Note: `data/db.json` lives outside the disk on Render free tier.
> To persist it too, either store `data/` on the same disk or symlink it.

### 4. Set Environment Variables
| Key | Value |
|---|---|
| `NODE_ENV` | `production` |

### 5. Deploy
- Render gives you `https://reporting-hub.onrender.com`

---

## Local Development

```bash
cd F:\Claude\reporting-hub
npm install
node server.js
# Open http://localhost:3000
```

---

## Docker (local test)

```bash
cd F:\Claude\reporting-hub
docker build -t reporting-hub .
docker run -p 3000:3000 -v "%cd%/uploads:/app/uploads" -v "%cd%/data:/app/data" reporting-hub
```
