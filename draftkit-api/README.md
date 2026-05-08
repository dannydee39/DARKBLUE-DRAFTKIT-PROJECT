# draftkit-api

Express backend for Draft Kit accounts, cloud draft persistence, per-draft league notes, and server-side valuation proxying.

## Start Here

- `server.js` creates the Express app, CORS policy, rate limiter, health endpoint, and route mounts.
- `routes/auth.js` owns signup, login, logout, password reset, and current-user session checks.
- `routes/drafts.js` owns cloud drafts, open markers, per-draft league notes, and note SSE streams.
- `routes/valuation-proxy.js` proxies valuation API calls while keeping `VALUATION_API_KEY` server-side.
- `lib/db.js` initializes SQLite tables and contains persistence helpers.
- `middleware/session.js` attaches and requires session users.

## Data Ownership

- Draft Kit account state and cloud drafts live in SQLite.
- Per-draft commissioner notes live in `draft_notes` and are scoped by both `draft_id` and `user_id`.
- Global MLB/player news remains owned by `valuation-api`.

## Commands

```powershell
npm install
npm start
npm run test:auth
npm run test:proxy
```

## Environment

Use `.env.example` as the template. Important values:

- `PORT`
- `ALLOWED_ORIGINS`
- `VALUATION_API_BASE`
- `VALUATION_API_KEY`
- `AUTH_DB_PATH`
- `PASSWORD_RESET_BASE_URL`
- `PASSWORD_RESET_TTL_MINUTES`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Password reset is intentionally SMTP-backed in production. If SMTP is not
configured, reset requests return `503 MAIL_NOT_CONFIGURED` instead of exposing
tokens or pretending an email was sent. Tests use `MAIL_TRANSPORT=json` and
`PASSWORD_RESET_EXPOSE_TOKEN=true` to verify the reset flow without real mail.
