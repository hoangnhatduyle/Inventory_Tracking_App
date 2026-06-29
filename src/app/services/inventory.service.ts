import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../core/api-client.service';
import {
  Category,
  InventoryBatch,
  InventoryItem,
  ItemImage,
  Location,
  UsageHistory,
} from '../models/inventory.model';

// Important: the API resolves the acting user from the Supabase JWT
// (`auth.uid()`) - the client never passes a user id. RLS enforces the same on
// the database layer, so even if a request were tampered with it could not
// reach another user's rows.

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(ApiClient);

  // --------------------------------------------------------------------------
  // Items
  // --------------------------------------------------------------------------

  async getItems(): Promise<InventoryItem[]> {
    return this.api.get<InventoryItem[]>('/api/inventory');
  }

  async getItemById(itemId: number): Promise<InventoryItem | null> {
    try {
      return await this.api.get<InventoryItem>(`/api/inventory/${itemId}`);
    } catch {
      return null;
    }
  }

  async addItem(item: InventoryItem): Promise<{ success: boolean; itemId?: number }> {
    try {
      const saved = await this.api.post<InventoryItem>('/api/inventory', item);
      return { success: true, itemId: saved?.id ?? undefined };
    } catch (err) {
      console.error('Add item failed', err);
      return { success: false };
    }
  }

  async updateItem(item: InventoryItem): Promise<boolean> {
    if (!item.id) return false;
    try {
      await this.api.patch<InventoryItem>(`/api/inventory/${item.id}`, item);
      return true;
    } catch (err) {
      console.error('Update item failed', err);
      return false;
    }
  }

  async deleteItem(itemId: number): Promise<boolean> {
    try {
      await this.api.delete<{ deleted: true }>(`/api/inventory/${itemId}`);
      return true;
    } catch (err) {
      console.error('Delete item failed', err);
      return false;
    }
  }

  async deleteItems(itemIds: number[]): Promise<boolean> {
    const results = await Promise.allSettled(itemIds.map((id) => this.deleteItem(id)));
    return results.every((r) => r.status === 'fulfilled' && r.value === true);
  }

  // Atomic on the server: inserts wasted_items + deletes the inventory row in a
  // single transaction (see api/waste/from-item.ts and supabase/migrations/
  // 0004_waste_function.sql). Fixes audit finding H16.
  async markAsWasted(itemId: number): Promise<boolean> {
    try {
      await this.api.post('/api/waste/from-item', { itemId });
      return true;
    } catch (err) {
      console.error('Mark wasted failed', err);
      return false;
    }
  }

  async searchItems(searchTerm: string): Promise<InventoryItem[]> {
    const items = await this.getItems();
    const q = (searchTerm ?? '').toLowerCase();
    return items.filter((i) => i.name?.toLowerCase().includes(q));
  }

  async filterItems(
    categoryId?: number,
    locationId?: number,
    expiringInDays?: number,
  ): Promise<InventoryItem[]> {
    const items = await this.getItems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return items.filter((item) => {
      if (categoryId !== undefined && item.categoryId !== categoryId) return false;
      if (locationId !== undefined && item.locationId !== locationId) return false;
      if (expiringInDays !== undefined && item.expirationDate) {
        const exp = new Date(item.expirationDate);
        exp.setHours(0, 0, 0, 0);
        if (exp < today) return false;
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > expiringInDays) return false;
      }
      return true;
    });
  }

  // --------------------------------------------------------------------------
  // Reference data
  // --------------------------------------------------------------------------

  async getCategories(): Promise<Category[]> {
    return this.api.get<Category[]>('/api/categories');
  }

  async addCategory(category: Pick<Category, 'name' | 'icon' | 'color'>): Promise<boolean> {
    try {
      await this.api.post<Category>('/api/categories', category);
      return true;
    } catch {
      return false;
    }
  }

  async updateCategory(category: Category): Promise<boolean> {
    if (!category.id) return false;
    try {
      await this.api.patch(`/api/categories/${category.id}`, category);
      return true;
    } catch {
      return false;
    }
  }

  async deleteCategory(categoryId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/categories/${categoryId}`);
      return true;
    } catch {
      return false;
    }
  }

  async getLocations(): Promise<Location[]> {
    return this.api.get<Location[]>('/api/locations');
  }

  async addLocation(location: Location): Promise<boolean> {
    try {
      await this.api.post<Location>('/api/locations', location);
      return true;
    } catch {
      return false;
    }
  }

  async updateLocation(location: Location): Promise<boolean> {
    if (!location.id) return false;
    try {
      await this.api.patch(`/api/locations/${location.id}`, location);
      return true;
    } catch {
      return false;
    }
  }

  async deleteLocation(locationId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/locations/${locationId}`);
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Images  (delegates to the dedicated image.service for the actual storage
  // upload; this service just talks to the DB row endpoints in Phase 4)
  // --------------------------------------------------------------------------

  async getItemImages(itemId: number): Promise<ItemImage[]> {
    try {
      return await this.api.get<ItemImage[]>(`/api/inventory/${itemId}/images`);
    } catch {
      return [];
    }
  }

  async getImagesByBarcode(barcode: string): Promise<ItemImage[]> {
    if (!barcode) return [];
    try {
      return await this.api.get<ItemImage[]>(
        `/api/inventory/by-barcode/${encodeURIComponent(barcode)}/images`,
      );
    } catch {
      return [];
    }
  }

  async addItemImage(itemImage: ItemImage): Promise<boolean> {
    try {
      const storagePath = itemImage.storagePath ?? itemImage.imagePath;
      await this.api.post(`/api/inventory/${itemImage.itemId}/images`, {
        storagePath,
        isPrimary: itemImage.isPrimary,
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteItemImage(imageId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/inventory/images/${imageId}`);
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Usage history / batches  (server-driven; FIFO computed in the API)
  // --------------------------------------------------------------------------

  async updateItemUsage(
    itemId: number,
    currentQuantity: number,
    amountUsed: number,
    notes?: string,
  ): Promise<boolean> {
    try {
      await this.api.post(`/api/inventory/${itemId}/usage`, {
        currentQuantity,
        amountUsed,
        notes,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getUsageHistory(itemId: number): Promise<UsageHistory[]> {
    try {
      return await this.api.get<UsageHistory[]>(`/api/inventory/${itemId}/usage`);
    } catch {
      return [];
    }
  }

  async calculateConsumptionRate(_itemId: number): Promise<number | null> {
    // Moved server-side into the dashboard aggregate. Components that still
    // call this individually get a stub null until they switch to the
    // dashboard summary endpoint.
    return null;
  }

  async predictRunOutDate(_itemId: number): Promise<Date | null> {
    return null;
  }

  // An item is "running low" when its remaining percentage (current / initial)
  // is at or below its threshold. `lowStockThreshold` is treated as a percentage
  // (default 20 = 20% remaining), matching the dashboard's critical/warning/good
  // bands and the original app's behavior.
  async getLowStockItems(): Promise<InventoryItem[]> {
    const items = await this.getItems();
    return items.filter((i) => {
      if (!i.initialQuantity || i.currentQuantity == null) return false;
      const percentage = (i.currentQuantity / i.initialQuantity) * 100;
      const threshold = i.lowStockThreshold ?? 20;
      return percentage > 0 && percentage <= threshold;
    });
  }

  async getBatches(itemId: number): Promise<InventoryBatch[]> {
    try {
      return await this.api.get<InventoryBatch[]>(`/api/inventory/${itemId}/batches`);
    } catch {
      return [];
    }
  }

  async addBatch(batch: InventoryBatch): Promise<number> {
    if (!batch.itemId) return 0;
    try {
      const saved = await this.api.post<InventoryBatch>(
        `/api/inventory/${batch.itemId}/batches`,
        batch,
      );
      return saved?.id ?? 0;
    } catch {
      return 0;
    }
  }

  async updateBatch(batch: InventoryBatch): Promise<boolean> {
    if (!batch.id || !batch.itemId) return false;
    try {
      await this.api.patch(`/api/inventory/${batch.itemId}/batches/${batch.id}`, batch);
      return true;
    } catch {
      return false;
    }
  }

  async deleteBatch(batchId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/inventory/batches/${batchId}`);
      return true;
    } catch {
      return false;
    }
  }

  async deleteBatchesByItem(itemId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/inventory/${itemId}/batches`);
      return true;
    } catch {
      return false;
    }
  }

  async getTotalBatchQuantity(itemId: number): Promise<number> {
    const batches = await this.getBatches(itemId);
    return batches.reduce((sum, b) => sum + (b.quantity ?? 0), 0);
  }

  async getEarliestBatchExpiration(itemId: number): Promise<string | null> {
    const batches = await this.getBatches(itemId);
    const dated = batches
      .map((b) => b.expirationDate ?? b.expiration_date)
      .filter((d): d is string => !!d)
      .sort();
    return dated[0] ?? null;
  }

  async deductFromBatchesFIFO(itemId: number, amountToDeduct: number): Promise<boolean> {
    try {
      await this.api.post(`/api/inventory/${itemId}/batches/deduct`, { amount: amountToDeduct });
      return true;
    } catch {
      return false;
    }
  }
}
