# Supabase

This directory holds the Supabase project for the web/Vercel deployment.

## Layout

- `config.toml` - local dev config (Supabase CLI)
- `migrations/` - versioned SQL migrations
  - `0001_initial_schema.sql` - all tables, indexes, RLS policies, category seed
  - `0002_ai_quota_function.sql` - atomic per-user monthly OpenAI quota
  - `0003_storage_bucket.sql` - private `inventory-images` bucket + RLS

## Local development

```bash
# One-time
npm install -g supabase
supabase login

# Start the local Supabase stack (Postgres + Auth + Storage + Studio)
supabase start

# Apply migrations (auto-applied on start; use this to re-apply)
supabase db reset

# Generate TypeScript types from the schema for the Angular app
supabase gen types typescript --local > ../src/app/core/database.types.ts

# Stop the stack
supabase stop
```

After `supabase start`, the local dashboard is at <http://localhost:54323>.

## Linking to a cloud project

```bash
supabase link --project-ref <your-project-ref>

# Push local migrations to the linked cloud project
supabase db push

# Pull cloud schema into a new local migration
supabase db pull
```

## RLS model

Every per-user table has four owner-only policies (select / insert / update / delete)
matching `auth.uid() = user_id`. The `categories` table is read-only for any
authenticated user; writes happen only via migrations.

The `try_consume_ai_quota` function is `SECURITY INVOKER`, so it always runs
under the calling user's JWT and inherits their RLS.

## Backups

For production: enable daily PITR backups in the Supabase dashboard. Do not
build a JSON export endpoint - the previous SQLite version leaked password
hashes via the in-app backup feature (audit finding C4); that feature has been
removed entirely in the web version.
