-- ============================================================================
-- Remove inventory batches.
-- Stock is now tracked solely on inventory_items (quantity / current_quantity /
-- initial_quantity / expiration_date). The batch table and the FIFO function
-- are dropped. Before dropping, each item's quantity and expiration date are
-- synced from its remaining batches so no stock information is lost.
-- ============================================================================

update public.inventory_items i
set quantity         = b.total,
    current_quantity = b.total,
    initial_quantity = greatest(coalesce(i.initial_quantity, 0), b.total),
    expiration_date  = coalesce(b.earliest, i.expiration_date)
from (
  select item_id,
         sum(quantity)        as total,
         min(expiration_date) as earliest
  from public.inventory_batches
  group by item_id
) b
where i.id = b.item_id
  and b.total > 0;

drop function if exists public.deduct_batches_fifo(bigint, numeric);
drop table if exists public.inventory_batches;
