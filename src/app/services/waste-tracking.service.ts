import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { WastedItem, WasteStatistics, WasteCategoryStats, WasteMonthStats } from '../models/waste-tracking.model';
import { parseLocalDate } from '../utils/date.utils';

@Injectable({
  providedIn: 'root'
})
export class WasteTrackingService {

  constructor(private db: DatabaseService) { }

  async getWastedItems(userId: number): Promise<WastedItem[]> {
    try {
      // Query wasted_items without JOIN (web localStorage fallback doesn't support JOINs)
      const query = `
        SELECT
          w.id,
          w.user_id,
          w.item_name,
          w.category_id,
          w.quantity,
          w.unit,
          w.price,
          w.wasted_date
        FROM wasted_items w
        WHERE w.user_id = ?
        ORDER BY w.wasted_date DESC
      `;

      const result = await this.db.query(query, [userId]);

      if (result.values) {
        // Fetch all categories once to map IDs to names
        const categoriesRes = await this.db.query('SELECT id, name FROM categories');
        const categories: any = {};
        if (categoriesRes.values) {
          categoriesRes.values.forEach((c: any) => {
            categories[c.id] = c.name;
          });
        }

        return result.values.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          itemName: row.item_name,
          categoryId: row.category_id,
          categoryName: categories[row.category_id] || null,
          quantity: row.quantity,
          unit: row.unit,
          price: row.price || 0,
          wastedDate: row.wasted_date || ''
        }));
      }

      return [];
    } catch (error) {
      console.error('Error getting wasted items:', error);
      return [];
    }
  }

  async getWasteStatistics(userId: number): Promise<WasteStatistics> {
    try {
      const wastedItems = await this.getWastedItems(userId);
      
      // Calculate totals
      const totalItemsWasted = wastedItems.length;
      const totalValueLost = wastedItems.reduce((sum, item) => 
        sum + ((item.price || 0) * item.quantity), 0
      );

      // Waste by category
      const categoryMap = new Map<number, WasteCategoryStats>();
      wastedItems.forEach(item => {
        if (!categoryMap.has(item.categoryId)) {
          categoryMap.set(item.categoryId, {
            categoryId: item.categoryId,
            categoryName: item.categoryName || 'Unknown',
            itemsWasted: 0,
            valueLost: 0
          });
        }
        const stats = categoryMap.get(item.categoryId)!;
        stats.itemsWasted++;
        stats.valueLost += (item.price || 0) * item.quantity;
      });

      // Waste by month (last 6 months)
      const monthMap = new Map<string, WasteMonthStats>();
      wastedItems.forEach(item => {
        // Extract YYYY-MM-DD from ISO string and parse with timezone safety
        const dateStr = item.wastedDate.split('T')[0]; // Get YYYY-MM-DD part
        const date = parseLocalDate(dateStr);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthName,
            itemsWasted: 0,
            valueLost: 0
          });
        }
        const stats = monthMap.get(monthKey)!;
        stats.itemsWasted++;
        stats.valueLost += (item.price || 0) * item.quantity;
      });

      // Get the last 6 months in chronological order
      const months = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0])) // Sort by month key chronologically
        .slice(-6) // Get last 6 months
        .map(entry => entry[1]); // Get the stats

      return {
        totalItemsWasted,
        totalValueLost,
        wasteByCategory: Array.from(categoryMap.values()).sort((a, b) => b.valueLost - a.valueLost),
        wasteByMonth: months
      };
    } catch (error) {
      console.error('Error calculating waste statistics:', error);
      return {
        totalItemsWasted: 0,
        totalValueLost: 0,
        wasteByCategory: [],
        wasteByMonth: []
      };
    }
  }

  async deleteWastedItem(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM wasted_items WHERE id = ?`;
      await this.db.run(query, [id]);
      return true;
    } catch (error) {
      console.error('Error deleting wasted item:', error);
      return false;
    }
  }
}
