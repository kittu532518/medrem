# MedRem — Setup & Deployment Guide

Smart medicine reminder PWA with AI prescription scanning and dose photo verification.

---

## Quick Start (Local Development)

### 1. Prerequisites

- Node.js 20+
- An Anthropic API key → https://console.anthropic.com/

### 2. Install dependencies

```bash
cd medrem
npm install --workspace=packages/api
npm install --workspace=packages/web
```

### 3. Configure environment

```bash
cp packages/api/.env.example packages/api/.env
```

Edit `packages/api/.env` — at minimum set your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=any_long_random_string
ADMIN_PASSWORD=choose_a_strong_password
```

### 4. Start the API

```bash
npm run dev:api
# → http://localhost:3001
```

### 5. Start the frontend

```bash
npm run dev:web
# → http://localhost:5173
```

Open http://localhost:5173 in your browser (or phone browser on the same network).

### 6. Dev OTP

Use **123456** as the OTP for any phone number during development.

---

## Access on Local Network (Mobile Testing)

The API and Vite dev server both bind to `0.0.0.0`, so any device on your Wi-Fi can reach the app.

1. Find your machine's IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. On the phone, open: `http://YOUR_IP:5173`
3. Install as PWA: tap browser menu → "Add to Home Screen"

---

## SuperAdmin Panel

Access at: **http://localhost:5173/admin**

Default credentials (set in `.env`):
| Field    | Default              |
|----------|----------------------|
| Username | `admin`              |
| Password | `medrem_admin_2024`  |

**Change the default password** by setting `ADMIN_PASSWORD` in `.env` before first run.

### What the admin panel can do

- View all registered patients with real-time compliance stats
- See each user's medicine list and recent dose log history
- Enable / Disable a patient account (disabled users cannot log in)
- Delete a patient and all their data permanently
- Dashboard stats: total users, active users, new this week, doses taken vs missed

---

## Architecture Overview

```
medrem/
├── packages/
│   ├── api/                  Fastify backend (Node 20, ESM)
│   │   ├── src/
│   │   │   ├── index.js      Server entry, plugin registration
│   │   │   ├── auth.js       JWT helpers, authenticate middleware
│   │   │   ├── db.js         SQLite via @libsql/client, pg-compat wrapper
│   │   │   ├── routes/
│   │   │   │   ├── auth.js         POST send-otp / verify-otp
│   │   │   │   ├── users.js        GET/PUT /me, POST face-photo
│   │   │   │   ├── prescriptions.js upload, confirm, delete
│   │   │   │   ├── medicines.js    CRUD medicine list
│   │   │   │   ├── doses.js        submit-photo, partial-override
│   │   │   │   ├── schedule.js     today's session schedule
│   │   │   │   ├── adherence.js    history + stats
│   │   │   │   ├── push.js         Web Push subscriptions
│   │   │   │   └── admin.js        SuperAdmin endpoints
│   │   │   └── services/
│   │   │       ├── claude.js       Prescription OCR + dose validation
│   │   │       └── scheduler.js    node-cron reminder engine
│   │   └── medrem.db         SQLite database (auto-created)
│   │
│   └── web/                  React PWA (Vite)
│       ├── src/
│       │   ├── App.jsx             Routes: /onboarding, /, /rx, /admin …
│       │   ├── api/client.js       Axios API wrapper
│       │   ├── screens/
│       │   │   ├── Onboarding/     7-step new-user flow
│       │   │   │   └── StepPhone   OTP login — existing users skip to home
│       │   │   ├── Home/           Today's dose session cards
│       │   │   ├── Capture/        Camera + dose photo submission
│       │   │   ├── Rx/             Prescription upload + medicine editor
│       │   │   ├── History/        Adherence calendar
│       │   │   ├── Profile/        User settings
│       │   │   └── Admin/          SuperAdmin dashboard
│       │   └── components/
│       └── public/
│           ├── manifest.json       PWA manifest
│           ├── sw.js               Service worker
│           └── icons/              App icons (192px + 512px minimum)
└── docker-compose.yml
```

---

## Key Features

| Feature | Details |
|---------|---------|
| **Phone OTP login** | Unique phone per account. Existing users → home directly. New users → 7-step onboarding. Dev OTP: 123456 |
| **Prescription OCR** | Handwritten Indian prescription support. Recognises Morning/Afternoon/Night column tables, Tab/Cap prefixes, Indian brand names |
| **Dose verification** | Patient photographs their medicine + face each session. Claude Vision validates medicine visible + face matches reference selfie |
| **Session engine** | 4 sessions: Morning / Afternoon / Evening / Night. Reminders escalate without snooze until photo submitted |
| **SuperAdmin** | Full user management, compliance dashboard, disable/delete accounts |
| **Multi-user safe** | Phone numbers are UNIQUE in DB. Disabled users blocked at auth middleware |

---

## Production Deployment

### Option A — Docker Compose (recommended)

```bash
# 1. Copy and fill in secrets
cp packages/api/.env.example .env

# 2. Build and start
docker compose up --build -d

# App:   http://your-server:80
# Admin: http://your-server:80/admin
# API:   http://your-server:3001
```

### Option B — Manual (VPS / cloud VM)

**API:**
```bash
cd packages/api
NODE_ENV=production node src/index.js
# Use PM2: pm2 start src/index.js --name medrem-api
```

**Web (build static files, serve with nginx):**
```bash
cd packages/web
npm run build        # outputs to dist/
# Copy dist/ to nginx root, use nginx.conf from this repo
```

### Option C — Free cloud hosting

| Service | What to deploy |
|---------|---------------|
| **Railway** | Both packages as separate services |
| **Render** | API as Web Service, web as Static Site |
| **Fly.io** | Docker container (use docker-compose.yml) |
| **Vercel** | Web only (needs separate API hosting) |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | — | Claude API key for OCR + dose validation |
| `JWT_SECRET` | ✅ | `medrem_dev_secret` | Long random string — keep secret! |
| `ADMIN_USERNAME` | — | `admin` | SuperAdmin login username |
| `ADMIN_PASSWORD` | — | `medrem_admin_2024` | **Change this in production!** |
| `PORT` | — | `3001` | API server port |
| `NODE_ENV` | — | `development` | Set to `production` in prod |
| `DB_PATH` | — | `./medrem.db` | Path to SQLite database file |
| `VAPID_PUBLIC_KEY` | — | — | For Web Push notifications |
| `VAPID_PRIVATE_KEY` | — | — | For Web Push notifications |
| `TWILIO_ACCOUNT_SID` | — | — | Real OTP delivery (without = dev mock) |
| `TWILIO_AUTH_TOKEN` | — | — | Twilio credential |
| `TWILIO_PHONE_NUMBER` | — | — | Twilio sender number |

---

## Wiring up Real OTP (Twilio)

The OTP system is ready for Twilio — just add credentials to `.env` and update `packages/api/src/routes/auth.js`:

```js
// Replace the console.log stub in send-otp with:
import twilio from 'twilio';
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
await twilioClient.messages.create({
  body: `Your MedRem OTP is: ${otp}`,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: phone,
});
```

Then `npm install twilio --workspace=packages/api`.

---

## PWA Icons

Add icon files to `packages/web/public/icons/`:
- `icon-192.png` (minimum required)
- `icon-512.png` (minimum required)
- Additional sizes: 72, 96, 128, 144, 152, 384

Generate all sizes from one master image (1024×1024):
```bash
npx pwa-asset-generator logo.png packages/web/public/icons/
```

---

## Database

SQLite file at `packages/api/medrem.db` — auto-created on first run.

**Tables:** `users`, `prescriptions`, `medicines`, `dose_logs`, `push_subscriptions`, `admins`

**Backup:**
```bash
cp packages/api/medrem.db packages/api/medrem.db.backup
```

**Migrate to PostgreSQL** (for scale): replace `packages/api/src/db.js` with a `pg` Pool — all route code uses `pool.query(sql, params)` and stays unchanged.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ANTHROPIC_API_KEY` errors | Check key in `.env`, restart API |
| "No medicines today" | Add prescriptions in the Rx tab first |
| OCR returns 0 medicines | Check prescription image is clear; use JPEG/PNG/WEBP |
| Admin login fails | Check `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `.env`, restart API |
| Phone OTP not arriving | Dev mode: always use `123456`; for real OTP add Twilio keys |
| Camera not working | Must use HTTPS or `localhost` — not plain HTTP over network |
