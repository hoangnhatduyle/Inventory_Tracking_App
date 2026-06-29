-- ============================================================================
-- Dashboard aggregate. Replaces the previous client-side N+1 pattern in
-- inventory-list.ts / dashboard.ts (audit Phase 7 / 9 finding).
--
-- Returns a single JSON document with everything the dashboard needs so the
-- client only makes one request and the DB does the joins once.
-- ============================================================================

create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
as $$
declare
  v_user uuid := auth.uid();
  v_today date := current_date;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'dashboard_summary requires an authenticated user' using errcode = '28000';
  end if;

  with items as (
    select * from public.inventory_items where user_id = v_user
  ),
  expiring as (
    select id, name, expiration_date, quantity, unit, category_id, location_id
    from items
    where expiration_date between v_today and (v_today + interval '7 days')::date
    order by expiration_date asc
    limit 50
  ),
  expired as (
    select count(*)::int as c
    from items
    where expiration_date < v_today
  ),
  low_stock as (
    select id, name, current_quantity, low_stock_threshold, unit, category_id
    from items
    where current_quantity is not null
      and low_stock_threshold is not null
      and current_quantity <= low_stock_threshold
    order by current_quantity asc
    limit 25
  ),
  totals as (
    select
      count(*)::int as total_items,
      coalesce(sum(price), 0)::numeric as total_value,
      count(*) filter (where expiration_date between v_today and (v_today + interval '7 days')::date)::int as expiring_count
    from items
  ),
  by_category as (
    select c.name as category, count(i.*)::int as count
    from public.categories c
    left join items i on i.category_id = c.id
    group by c.name
    having count(i.*) > 0
    order by count desc
  ),
  by_location as (
    select coalesce(l.name, '(unassigned)') as location, count(i.*)::int as count
    from items i
    left join public.locations l on l.id = i.location_id
    group by l.name
    order by count desc
  ),
  waste_30d as (
    select count(*)::int as c, coalesce(sum(price), 0)::numeric as v
    from public.wasted_items
    where user_id = v_user
      and wasted_date >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'totalItems',     (select total_items from totals),
    'totalValue',     (select total_value from totals),
    'expiringCount',  (select expiring_count from totals),
    'expiredCount',   (select c from expired),
    'expiringSoon',   coalesce((select jsonb_agg(to_jsonb(expiring)) from expiring), '[]'::jsonb),
    'lowStock',       coalesce((select jsonb_agg(to_jsonb(low_stock)) from low_stock), '[]'::jsonb),
    'byCategory',     coalesce((select jsonb_agg(to_jsonb(by_category)) from by_category), '[]'::jsonb),
    'byLocation',     coalesce((select jsonb_agg(to_jsonb(by_location)) from by_location), '[]'::jsonb),
    'waste30dCount',  (select c from waste_30d),
    'waste30dValue',  (select v from waste_30d)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.dashboard_summary() from public;
grant execute on function public.dashboard_summary() to authenticated;
