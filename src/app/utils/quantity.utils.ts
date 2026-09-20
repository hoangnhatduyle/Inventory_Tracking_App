import { InventoryItem } from '../models/inventory.model';

/**
 * Amount of the item still left. Usage tracking writes to `currentQuantity`;
 * `quantity` is the amount entered at purchase/refill and is not kept in sync,
 * so fall back to it only for items that have no usage tracking yet.
 */
export function getRemainingQuantity(
  item: Pick<InventoryItem, 'quantity' | 'currentQuantity'>,
): number {
  return item.currentQuantity ?? item.quantity;
}
