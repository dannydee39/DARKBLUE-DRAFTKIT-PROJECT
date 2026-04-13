# Deployment Guide

This project has three independently deployable units. Each runs on its own server/service.

---

## Architecture Overview

```
darkblueapi.anythingavenue.com   ← VPS (your server)
  ├── /                          ← api-site  (static HTML/CSS/JS marketing site)
  └── /v1/...                    ← NOT this server — see API below

api.darkblue.io  (or subdomain)  ← VPS (Express.js API — mvpfinal/api/)
  └── /v1/valuate                ← core valuation endpoint

dbdraftkit.onrender.com          ← Render.com (React frontend — mvpfinal/draftkit/)
```

> The API site and the draft kit are completely decoupled. They share no server-side state.
> The draft kit calls the Express API directly; the api-site is a static marketing/licensing portal.

---

## 1. API Marketing Site — `darkblueapi.anythingavenue.com`

**Source:** `mvpfinal/api-site/`
**Target server:** Your VPS at `darkblueapi.anythingavenue.com`
**Type:** Pure static files — no Node, no build step

### What it is
Single-page application (SPA) with hash-based routing. Home page, pricing, fake-auth license
claim flow, dashboard, and full API documentation with a live Try It panel.

### Deploy steps (VPS)

```bash
# 1. Copy the static files to your web root (nginx example)
scp -r mvpfinal/api-site/* user@yourserver:/var/www/darkblueapi/

# 2. nginx config — serve as static, redirect all routes to index.html
server {
    listen 80;
    server_name darkblueapi.anythingavenue.com;

    root /var/www/darkblueapi;
    index index.html;

    # SPA fallback — all paths serve index.html (hash routing handles the rest)
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# 3. Add SSL (strongly recommended)
sudo certbot --nginx -d darkblueapi.anythingavenue.com
```

### Environment note
`DB.API_BASE` in `js/state.js` auto-detects dev vs. production:
- **localhost** → routes Try It requests to `http://localhost:3001`
- **any other host** → routes to `https://draftapi.anythingavenue.com`

Update the production URL in `js/state.js` if your API lives on a different subdomain.

---

## 2. Express Valuation API — `mvpfinal/api/`

**Source:** `mvpfinal/api/`
**Target server:** Your VPS (same machine as api-site is fine, different port/subdomain)
**Type:** Node.js / Express, port 3001

### Deploy steps (VPS, with PM2)

```bash
# 1. SSH into your VPS and pull the repo
git pull origin main
cd mvpfinal/api

# 2. Install dependencies
npm install

# 3. Start with PM2 (keeps it alive on reboot)
pm2 start server.js --name darkblue-api
pm2 save
pm2 startup

# 4. nginx reverse proxy (so it's reachable at a clean subdomain)
server {
    listen 80;
    server_name api.darkblueapi.anythingavenue.com;  # or whatever subdomain you choose

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 5. SSL
sudo certbot --nginx -d api.darkblueapi.anythingavenue.com
```

### CORS
The API must allow requests from:
- `https://dbdraftkit.onrender.com` (draft kit)
- `https://darkblueapi.anythingavenue.com` (api-site Try It panel)

Check `mvpfinal/api/server.js` for the CORS `origin` whitelist and add both domains.

---

## 3. Draft Kit Frontend — `dbdraftkit.onrender.com`

**Source:** `mvpfinal/draftkit/`
**Target service:** [Render.com](https://render.com) (static site)
**Live URL:** `https://dbdraftkit.onrender.com/`
**Type:** React + Vite — requires a build step

### Render.com settings

| Setting | Value |
|---------|-------|
| Root directory | `mvpfinal/draftkit` |
| Build command | `npm install && npm run build` |
| Publish directory | `dist` |
| Environment | Static Site |

### API URL
The draft kit points at the Express API for valuations. Make sure the API base URL
in `mvpfinal/draftkit/src/` matches wherever your VPS API is deployed.

---

## Cross-Origin Checklist

Before going live, confirm all three talk to each other:

- [ ] `darkblueapi.anythingavenue.com` loads and `#docs` Try It panel can reach the API
- [ ] `dbdraftkit.onrender.com` can call `POST /v1/valuate` on the VPS API
- [ ] VPS API CORS whitelist includes both frontend origins
- [ ] SSL certs issued for both VPS subdomains
- [ ] `DB.API_BASE` production fallback in `js/state.js` matches your actual API subdomain

---

## Local Development

```bash
# Terminal 1 — Express API (port 3001)
cd mvpfinal/api && node server.js

# Terminal 2 — React draft kit (port 5173)
cd mvpfinal/draftkit && npm run dev

# Terminal 3 — API marketing site (port 4000)
cd mvpfinal/api-site && python -m http.server 4000
# or: npx serve . --port 4000
```

Demo license key for local testing: `DB-2026-DEMO-0001`
