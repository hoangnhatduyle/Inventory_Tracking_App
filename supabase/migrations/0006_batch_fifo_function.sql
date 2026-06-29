-- ============================================================================
-- FIFO batch consumption.
-- Replaces the client-side loop in InventoryService.deductFromBatchesFIFO
-- (the SQLite version made one DB call per batch and was not transactional).
--
-- The function locks the item's batches by oldest expiration first, walks
-- them in order subtracting the requested quantity, and either updates or
-- deletes each batch as needed. The whole operation runs inside a single
-- transaction so a partial deduction is impossible.
-- Returns true on success, false if the requested amount exceeds available
-- stock (the function aborts cleanly with the transaction rolled back).
-- ============================================================================

create or replace function public.deduct_batches_fifo(
  p_item_id bigint,
  p_amount  numeric
)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_remaining numeric := p_amount;
  v_total numeric;
  v_batch record;
begin
  if v_user is null then
    raise exception 'deduct_batches_fifo requires an authenticated user' using errcode = '28000';
  end if;
  if p_amount <= 0 then
    return true;
  end if;

  -- Check total stock first (read uses RLS, so only own batches are visible).
  select coalesce(sum(quantity), 0) into v_total
  from public.inventory_batches
  where item_id = p_item_id and user_id = v_user;

  if v_total < p_amount then
    return false;
  end if;

  for v_batch in
    select id, quantity
    from public.inventory_batches
    where item_id = p_item_id and user_id = v_user
    order by expiration_date asc nulls last, id asc
    for update
  loop
    exit when v_remaining <= 0;

    if v_batch.quantity <= v_remaining then
      delete from public.inventory_batches where id = v_batch.id;
      v_remaining := v_remaining - v_batch.quantity;
    else
      update public.inventory_batches
      set quantity = quantity - v_remaining
      where id = v_batch.id;
      v_remaining := 0;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.deduct_batches_fifo(bigint, numeric) from public;
grant execute on function public.deduct_batches_fifo(bigint, numeric) to authenticated;
