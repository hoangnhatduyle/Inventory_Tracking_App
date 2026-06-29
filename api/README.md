# API (Vercel serverless functions)

All endpoints under `/api/*` are TypeScript serverless functions deployed by
Vercel. Each handler returns a JSON envelope:

```jsonc
// success
{ "data": <payload> }

// error
{ "error": { "code": "BAD_REQUEST", "message": "..." } }
```

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/health` | Public liveness probe |
| `GET`  | `/api/categories` | List global categories |
| `GET POST` | `/api/inventory` | List / create inventory items |
| `GET PATCH DELETE` | `/api/inventory/:id` | One item |
| `GET POST` | `/api/inventory/:id/batches` | Batches for an item |
| `GET POST` | `/api/shopping-list` | List / create |
| `PATCH DELETE` | `/api/shopping-list/:id` | |
| `GET POST` | `/api/locations` | |
| `PATCH DELETE` | `/api/locations/:id` | |
| `GET POST` | `/api/meal-plans` (query: `from`, `to`) | |
| `PATCH DELETE` | `/api/meal-plans/:id` | |
| `GET POST` | `/api/recipes` | |
| `PATCH DELETE` | `/api/recipes/:id` | |
| `GET POST` | `/api/waste` | List / create ad-hoc waste row |
| `POST` | `/api/waste/from-item` | Atomic delete+log (fixes audit H16) |
| `GET`  | `/api/statistics/dashboard` | Single-query dashboard aggregate |
| `POST` | `/api/ai/expiration-suggest` | OpenAI proxy (atomic quota) |
| `POST` | `/api/ai/receipt-scan` | OpenAI vision proxy (atomic quota) |
| `POST` | `/api/uploads/sign` | Get signed Supabase Storage upload URL |
| `GET`  | `/api/uploads/read` | Get signed Supabase Storage read URL |

All non-health routes require `Authorization: Bearer <supabase-jwt>`.

## Security posture

- Browser never holds the OpenAI key or the Supabase service-role key.
- Every request is parsed with [zod](https://zod.dev) before touching the DB.
- The Supabase client used per request is **bound to the user JWT**, so RLS
  policies still fire. The service-role client is reserved for cross-user work
  and is not exposed to any current endpoint.
- AI quota is enforced by an atomic Postgres function
  (`try_consume_ai_quota`); on DB error we **fail closed**.
- Errors return a consistent envelope and never leak stack traces or upstream
  bodies in production (`NODE_ENV=production`).
- CORS allow-list comes from `API_ALLOWED_ORIGINS` env (comma-separated).

## Local development

```bash
# Install API-only deps
cd api && npm install && cd ..

# Run locally with Vercel CLI (proxies Angular dev server on 4200)
npm i -g vercel
vercel dev --listen 3000
```

Set the env vars from `.env.example` in `.env.local` before running.
