import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../core/api-client.service';
import { WastedItem, WasteStatistics } from '../models/waste-tracking.model';

export type { WastedItem, WasteStatistics };

@Injectable({ providedIn: 'root' })
export class WasteTrackingService {
  private readonly api = inject(ApiClient);

  async getWasteLog(): Promise<WastedItem[]> {
    return this.api.get<WastedItem[]>('/api/waste');
  }

  async getWastedItems(): Promise<WastedItem[]> {
    return this.getWasteLog();
  }

  async deleteWastedItem(id: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/waste/${id}`);
      return true;
    } catch {
      return false;
    }
  }

  async recordWaste(entry: WastedItem): Promise<boolean> {
    try {
      await this.api.post('/api/waste', entry);
      return true;
    } catch {
      return false;
    }
  }

  async getWasteStatistics(): Promise<WasteStatistics> {
    const log = await this.getWasteLog();
    const byMonth = new Map<string, { count: number; value: number }>();
    const byCategory = new Map<string, { categoryId: number | null; count: number; value: number }>();
    for (const w of log) {
      const month = (w.wastedDate ?? '').slice(0, 7);
      const cur = byMonth.get(month) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += (w.price ?? 0) * (w.quantity ?? 1);
      byMonth.set(month, cur);
      const catName = w.categoryName ?? 'Unknown';
      const catCur = byCategory.get(catName) ?? {
        categoryId: w.categoryId ?? null,
        count: 0,
        value: 0,
      };
      catCur.count += 1;
      catCur.value += (w.price ?? 0) * (w.quantity ?? 1);
      byCategory.set(catName, catCur);
    }
    const totalValue = Array.from(byMonth.values()).reduce((s, v) => s + v.value, 0);
    return {
      totalItemsWasted: log.length,
      totalValueLost: totalValue,
      wasteByMonth: Array.from(byMonth.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([month, v]) => ({ month, itemsWasted: v.count, valueLost: v.value })),
      wasteByCategory: Array.from(byCategory.entries())
        .sort((a, b) => b[1].value - a[1].value)
        .map(([categoryName, v]) => ({
          categoryId: v.categoryId ?? 0,
          categoryName,
          itemsWasted: v.count,
          valueLost: v.value,
        })),
    };
  }
}
