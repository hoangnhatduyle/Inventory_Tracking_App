-- Per-user custom categories (Phase C). System seeds keep user_id null and
-- is_system = true; user-created rows carry auth.uid() and is_system = false.
alter table public.categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists is_system boolean not null default false;

update public.categories set is_system = true where user_id is null;

alter table public.categories drop constraint if exists categories_name_key;

create unique index if not exists uniq_user_category_name
  on public.categories (coalesce(user_id::text, 'system'), lower(name));

drop policy if exists "categories_read_authenticated" on public.categories;

create policy "categories_read"
  on public.categories for select
  to authenticated
  using (is_system = true or auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (auth.uid() = user_id and is_system = false);

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (auth.uid() = user_id and is_system = false)
  with check (auth.uid() = user_id and is_system = false);

create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (auth.uid() = user_id and is_system = false);
