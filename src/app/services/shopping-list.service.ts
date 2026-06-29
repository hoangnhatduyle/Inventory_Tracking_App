import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../core/api-client.service';
import { ShoppingListItem } from '../models/inventory.model';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly api = inject(ApiClient);

  async getShoppingList(): Promise<ShoppingListItem[]> {
    return this.api.get<ShoppingListItem[]>('/api/shopping-list');
  }

  async getItems(): Promise<ShoppingListItem[]> {
    return this.getShoppingList();
  }

  async addItem(item: ShoppingListItem): Promise<boolean> {
    try {
      await this.api.post<ShoppingListItem>('/api/shopping-list', item);
      return true;
    } catch {
      return false;
    }
  }

  async updateItem(item: ShoppingListItem): Promise<boolean> {
    if (!item.id) return false;
    try {
      await this.api.patch(`/api/shopping-list/${item.id}`, item);
      return true;
    } catch {
      return false;
    }
  }

  // Flips the `isPurchased` flag. Caller can pass an explicit value; otherwise
  // the current row is fetched and the flag is toggled.
  async togglePurchased(itemId: number, isPurchased?: boolean): Promise<boolean> {
    try {
      let next = isPurchased;
      if (next === undefined) {
        const list = await this.getShoppingList();
        next = !list.find((i) => i.id === itemId)?.isPurchased;
      }
      await this.api.patch(`/api/shopping-list/${itemId}`, { isPurchased: next });
      return true;
    } catch {
      return false;
    }
  }

  async deleteItem(itemId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/shopping-list/${itemId}`);
      return true;
    } catch {
      return false;
    }
  }

  async clearPurchased(): Promise<boolean> {
    const list = await this.getShoppingList();
    const ids = list.filter((i) => i.isPurchased && i.id).map((i) => i.id as number);
    const results = await Promise.allSettled(ids.map((id) => this.deleteItem(id)));
    return results.every((r) => r.status === 'fulfilled');
  }

  // Plain-text export of unpurchased items for sharing. Tries the Web Share
  // API first, falls back to clipboard; both failures are non-fatal because
  // the text is still returned to the caller.
  async exportToText(): Promise<string> {
    const items = await this.getShoppingList();
    const lines = items
      .filter((i) => !i.isPurchased)
      .map((i) => `- ${i.name}${i.quantity ? ` (${i.quantity})` : ''}`);
    const text = lines.length ? `Shopping List:\n${lines.join('\n')}` : 'Shopping list is empty.';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Shopping List', text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // intentional: failure to share/copy doesn't invalidate the text result.
    }
    return text;
  }
}
