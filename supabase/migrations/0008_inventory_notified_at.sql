-- Track when an item last triggered an expiration push so the cron job does
-- not spam the user daily for the same item.
alter table public.inventory_items
  add column if not exists last_notified_at timestamptz;

create index if not exists idx_inventory_expiring
  on public.inventory_items (user_id, expiration_date)
  where expiration_date is not null;
