# Deployment Guide

This document covers the runtime architecture, environment configuration, and
the launch / smoke-test checklist for the hosted (Vercel + Supabase) version of
the inventory tracker. For the source-code layout, see `README.md`; for the
API surface, see `api/README.md`.

---

## Runtime architecture

```
Browser ── Angular PWA (Vercel static) ── Vercel Serverless /api ── Supabase (Postgres + Auth + Storage)
                                                              └── OpenAI (gpt-5-mini)
```

- Frontend: Angular 20 standalone components, served as a static SPA from Vercel.
- Backend: Vercel Node serverless functions in `/api`.
- Database: Supabase Postgres with Row Level Security on every per-user table.
- Auth: Supabase Auth (email + password, bcrypt-hashed, JWT issued by Supabase).
- Storage: Supabase Storage bucket `inventory-images`, accessed via signed URLs.
- AI: OpenAI key lives only on the server; per-user monthly quota enforced
  atomically by the Postgres function `try_consume_ai_quota`.

---

## Environments

Recommended layout:

| Env | Vercel project | Supabase project | Notes |
|---|---|---|---|
| production | `inventory-tracker` | `inventory-prod` | Custom domain, email-confirmation enabled |
| staging | `inventory-tracker-preview` (or preview branch) | `inventory-staging` | Same schema, throwaway data |
| local | `vercel dev` | `supabase start` (local) | See `supabase/README.md` |

All three environments share the same migrations under `supabase/migrations/`
and the same `/api` code. They differ only in environment variables.

---

## Environment variables

See `.env.example` for the full list. The split between **public** (browser)
and **server-only** is enforced by Vercel.

### Public (browser - safe to ship)

| Var | Used by | Example |
|---|---|---|
| `NG_APP_SUPABASE_URL` | Angular | `https://<ref>.supabase.co` |
| `NG_APP_SUPABASE_ANON_KEY` | Angular | anon key from Supabase Settings -> API |
| `NG_APP_API_BASE_URL` | Angular | `""` in prod (same origin), `http://localhost:3000` locally |
| `NG_APP_SENTRY_DSN` | Angular | optional |
| `NG_APP_ENVIRONMENT_NAME` | Angular | `production`, `staging`, etc. |
| `NG_APP_VAPID_PUBLIC_KEY` | Angular | Web Push VAPID public key (safe to publish) |

> The Angular build does **not** auto-read `NG_APP_*` env vars; replace the
> placeholder values in `src/environments/environment.prod.ts` during the build,
> or wire a build-time script that templates them. (Vercel build step is the
> right place to do this.)

### Server-only (Vercel Project -> Settings -> Environment Variables)

| Var | Notes |
|---|---|
| `SUPABASE_URL` | Same as public URL |
| `SUPABASE_ANON_KEY` | Same as public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never expose**; used only for cross-user ops |
| `SUPABASE_JWT_SECRET` | From Supabase Settings -> API -> JWT secret |
| `OPENAI_API_KEY` | The proxy uses this; clients never see it |
| `OPENAI_MODEL` | Defaults to `gpt-5-mini` if unset |
| `AI_QUOTA_EXPIRATION_PER_MONTH` | Defaults applied if unset |
| `AI_QUOTA_RECEIPT_PER_MONTH` | Defaults applied if unset |
| `API_ALLOWED_ORIGINS` | Comma-separated allowlist of CORS origins |
| `OPENAI_MONTHLY_BUDGET_USD` | Soft ceiling for cost alerts |
| `VAPID_PUBLIC_KEY` | Same value as `NG_APP_VAPID_PUBLIC_KEY` |
| `VAPID_PRIVATE_KEY` | **Never expose**; used by `/api/push/*` and the cron job |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | Long random string; Vercel cron sends `Authorization: Bearer <CRON_SECRET>` |

Generate VAPID keys once:

```powershell
npx web-push generate-vapid-keys
```

Apply migrations `0007_push_subscriptions.sql`, `0008_inventory_notified_at.sql`,
and `0009_user_categories.sql` before enabling push or custom categories.

---

## Security headers

`vercel.json` ships these headers for **every** response:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy:` `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

CORS for `/api/*` is enforced server-side (`api/_lib/cors.ts`) using
`API_ALLOWED_ORIGINS`. Unlisted origins receive no `Access-Control-Allow-Origin`
header and the browser blocks the response.

---

## Auth hardening (Supabase dashboard)

In the Supabase Dashboard for the production project:

1. **Authentication -> Providers -> Email**: enable "Confirm email".
2. **Authentication -> URL Configuration**: set the site URL to your production
   domain (this is the redirect target for password-reset emails).
3. **Authentication -> Rate limits**: keep the default (or tighten) limits on
   sign-in and OTP attempts.
4. **Settings -> API -> JWT expiry**: keep the default 1 hour; refresh tokens
   are rotated automatically by `supabase-js`.

---

## Cost guardrails

- Set a hard cap on the OpenAI account dashboard (the env var `OPENAI_MONTHLY_BUDGET_USD`
  is informational; the binding cap lives in OpenAI billing).
- Per-user quotas are enforced atomically by `try_consume_ai_quota`; configure
  `AI_QUOTA_EXPIRATION_PER_MONTH` and `AI_QUOTA_RECEIPT_PER_MONTH` to fit your
  expected fleet.
- Vercel: enable spend alerts on function invocations and bandwidth.
- Supabase: monitor the free-tier database storage and egress quotas.

---

## Observability

- **Vercel**: enable Web Analytics + Logs in the project dashboard.
- **Supabase**: enable Postgres slow-query logging.
- **Sentry** (optional): set `NG_APP_SENTRY_DSN`. Initialise in `app.config.ts`
  if you decide to add the SDK; left as a follow-up because it adds bundle
  weight.

---

## Pre-launch smoke test

Run end-to-end against the **staging** environment before promoting to prod:

1. Sign up with a fresh email -> confirm via the email link.
2. Add a manual inventory item with quantity, expiration date and a location.
3. Upload an image to the item; confirm it renders via a signed URL.
4. Run "AI suggest expiration" once and confirm the response is rendered.
5. Scan (or upload) a receipt; confirm at least one item is parsed and added.
6. Add the item to the meal plan; toggle the meal as cooked and watch the
   inventory get decremented.
7. Move an item to the shopping list and back; verify quantity math.
8. Mark an item as wasted; verify it disappears from inventory and shows up
   in the waste log.
9. Sign out, then sign back in - state should round-trip cleanly.
10. Toggle the device offline and reload - cached reads should still render and
    a banner should warn that you're offline.
11. Settings -> Enable push notifications -> Send test notification.
12. Add an item expiring tomorrow; trigger the cron manually:
    ```bash
    curl -H "Authorization: Bearer <CRON_SECRET>" https://<staging-domain>/api/cron/check-expirations
    ```
13. Settings -> add a custom category; confirm it appears in the item form.
14. Scan a barcode for an item that already has a photo; confirm the image
    pre-fills in the item form.

Track each step in a launch checklist issue so regressions are obvious in
post-launch retros.

---

## Fire Tablet device smoke test (Phase D)

Run on a real Fire Tablet before production cutover:

1. Install Chrome (not Silk) and open the deployed HTTPS URL.
2. Chrome menu -> **Add to Home screen** to install the PWA.
3. Sign up a fresh account and add a location.
4. Add an item using the device camera (`Take Photo` flow).
5. Scan a real barcode at the kitchen counter.
6. Settings -> Enable push notifications; send a test notification.
7. Toggle Wi-Fi off; confirm cached inventory still renders and the offline
   banner appears.
8. Toggle Wi-Fi on; add an item and confirm it saves.

---

## Production cutover (Phase E)

1. All v2 regression fixes verified on staging (receipt scan, images, dashboard).
2. Push notifications verified end-to-end with a real expiring item.
3. `npx ng test --watch=false --browsers=ChromeHeadless` green (46+ specs).
4. `npm run typecheck` in `/api` green.
5. `npx ng build --configuration production` with `strictTemplates: true` green.
6. Staging smoke test (steps 1-14 above) completed.
7. Custom domain configured; `API_ALLOWED_ORIGINS` updated; Supabase Site URL
   updated to match.
8. OpenAI hard monthly cap set in OpenAI billing dashboard.
9. Vercel spend alerts enabled.
10. Recent Supabase backup verified.
11. Push to `main`; Vercel auto-deploys; repeat smoke test once in production.

---

## Rollback

Vercel: use the "Promote" feature on the previous deployment.

Supabase: any breaking migration must be paired with a `DOWN` migration in
`supabase/migrations/`. If a release introduces an irreversible change, take a
manual `pg_dump` first and document the recovery path in the release notes.
