-- ============================================================================
-- Atomic "mark inventory item as wasted": delete the item AND insert the
-- corresponding wasted_items row in a single transaction.
-- Fixes audit finding H16 (markAsWasted in inventory.service.ts deletes the
-- item first and only then inserts the waste record; a crash between the two
-- silently loses the wasted record).
--
-- SECURITY INVOKER: respects RLS, so the function cannot waste another user's
-- items.
-- ============================================================================

create or replace function public.mark_item_wasted(
  p_item_id   bigint,
  p_quantity  numeric default null,   -- defaults to the item's current_quantity / quantity
  p_unit      text    default null
)
returns public.wasted_items
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_item public.inventory_items;
  v_row  public.wasted_items;
  v_qty  numeric;
  v_unit text;
begin
  if v_user is null then
    raise exception 'mark_item_wasted requires an authenticated user' using errcode = '28000';
  end if;

  -- RLS will already filter this; the explicit check is belt-and-braces.
  select * into v_item
  from public.inventory_items
  where id = p_item_id and user_id = v_user
  for update;

  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  v_qty  := coalesce(p_quantity, v_item.current_quantity, v_item.quantity);
  v_unit := coalesce(p_unit, v_item.unit);

  insert into public.wasted_items (user_id, item_name, category_id, quantity, unit, price, wasted_date)
  values (v_user, v_item.name, v_item.category_id, v_qty, v_unit, v_item.price, now())
  returning * into v_row;

  delete from public.inventory_items where id = p_item_id and user_id = v_user;

  return v_row;
end;
$$;

revoke all on function public.mark_item_wasted(bigint, numeric, text) from public;
grant execute on function public.mark_item_wasted(bigint, numeric, text) to authenticated;
