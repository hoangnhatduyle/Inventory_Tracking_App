import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { ImageService } from './image.service';
import { InventoryItem, Category, Location, ItemImage } from '../models/inventory.model';
import { toLocalDateString } from '../utils/date.utils';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  constructor(
    private db: DatabaseService,
    private imageService: ImageService
  ) {}

  // Inventory Items
  async getItems(userId: number): Promise<InventoryItem[]> {
    try {
      const query = `
        SELECT * FROM inventory_items 
        WHERE user_id = ? 
        ORDER BY expiration_date ASC
      `;
      const result = await this.db.query(query, [userId]);
      return this.mapToInventoryItems(result.values || []);
    } catch (error) {
      console.error('Error getting items:', error);
      return [];
    }
  }

  async getItemById(itemId: number): Promise<InventoryItem | null> {
    try {
      const query = `SELECT * FROM inventory_items WHERE id = ?`;
      const result = await this.db.query(query, [itemId]);
      
      if (result.values && result.values.length > 0) {
        return this.mapToInventoryItem(result.values[0]);
      }
      return null;
    } catch (error) {
      console.error('Error getting item:', error);
      return null;
    }
  }

  async addItem(item: InventoryItem): Promise<{ success: boolean; itemId?: number }> {
    try {
      const query = `
        INSERT INTO inventory_items (
          user_id, name, category_id, quantity, unit, purchase_date,
          expiration_date, location_id, price, notes, notification_enabled,
          notification_days_before, barcode, initial_quantity, current_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await this.db.run(query, [
        item.userId,
        item.name,
        item.categoryId,
        item.quantity,
        item.unit,
        item.purchaseDate,
        item.expirationDate,
        item.locationId,
        item.price || null,
        item.notes || null,
        item.notificationEnabled ? 1 : 0,
        item.notificationDaysBefore,
        item.barcode || null,
        item.initialQuantity ?? item.quantity,
        item.currentQuantity !== undefined ? item.currentQuantity : item.quantity
      ]);

      return { success: true, itemId: result.changes?.lastId };
    } catch (error) {
      console.error('Error adding item:', error);
      return { success: false };
    }
  }

  async updateItem(item: InventoryItem): Promise<boolean> {
    try {
      const query = `
        UPDATE inventory_items SET
          name = ?, category_id = ?, quantity = ?, unit = ?,
          purchase_date = ?, expiration_date = ?, location_id = ?,
          price = ?, notes = ?, notification_enabled = ?,
          notification_days_before = ?, barcode = ?,
          initial_quantity = ?, current_quantity = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      const params = [
        item.name,
        item.categoryId,
        item.quantity,
        item.unit,
        item.purchaseDate,
        item.expirationDate,
        item.locationId,
        item.price || null,
        item.notes || null,
        item.notificationEnabled ? 1 : 0,
        item.notificationDaysBefore,
        item.barcode || null,
        item.initialQuantity ?? item.quantity,
        item.currentQuantity !== undefined ? item.currentQuantity : item.quantity,
        item.id
      ];
      
      await this.db.run(query, params);

      return true;
    } catch (error) {
      console.error('Error updating item:', error);
      return false;
    }
  }

  async deleteItem(itemId: number): Promise<boolean> {
    try {
      // Get all images for this item
      const images = await this.getItemImages(itemId);

      // Delete image files from filesystem
      for (const image of images) {
        if (image.imagePath) {
          try {
            await this.imageService.deleteImage(image.imagePath);
            console.log(`Deleted image file: ${image.imagePath}`);
          } catch (imgErr) {
            console.warn(`Failed to delete image file ${image.imagePath}:`, imgErr);
            // Continue deletion even if image file deletion fails
          }
        }
      }

      // Delete all related database records
      // Note: inventory_batches and usage_history have ON DELETE CASCADE FK constraints,
      // so they'll auto-delete when inventory_items is deleted
      const deleteImagesQuery = `DELETE FROM item_images WHERE item_id = ?`;
      await this.db.run(deleteImagesQuery, [itemId]);

      // Delete the item (batches and usage history will cascade delete)
      const query = `DELETE FROM inventory_items WHERE id = ?`;
      await this.db.run(query, [itemId]);

      console.log(`Deleted item ${itemId} with ${images.length} image(s), batches, and usage history`);
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  }

  async deleteItems(itemIds: number[]): Promise<boolean> {
    try {
      // Delete images for each item
      for (const itemId of itemIds) {
        const images = await this.getItemImages(itemId);
        for (const image of images) {
          if (image.imagePath) {
            try {
              await this.imageService.deleteImage(image.imagePath);
            } catch (imgErr) {
              console.warn(`Failed to delete image file ${image.imagePath}:`, imgErr);
            }
          }
        }
      }

      // Delete all related database records
      // Note: inventory_batches and usage_history have ON DELETE CASCADE FK constraints,
      // so they'll auto-delete when inventory_items is deleted
      const placeholders = itemIds.map(() => '?').join(',');
      const deleteImagesQuery = `DELETE FROM item_images WHERE item_id IN (${placeholders})`;
      await this.db.run(deleteImagesQuery, itemIds);

      // Delete items (batches and usage history will cascade delete)
      const query = `DELETE FROM inventory_items WHERE id IN (${placeholders})`;
      await this.db.run(query, itemIds);

      console.log(`Deleted ${itemIds.length} item(s) with their images, batches, and usage history`);
      return true;
    } catch (error) {
      console.error('Error deleting items:', error);
      return false;
    }
  }

  async markAsWasted(itemId: number): Promise<boolean> {
    try {
      // Get item details
      const item = await this.getItemById(itemId);
      if (!item) return false;
      // Determine how much of the item remains (use currentQuantity if available)
      const remainingQty = item.currentQuantity != null ? item.currentQuantity : item.quantity;
      if (!remainingQty || remainingQty <= 0) {
        // Nothing to mark as wasted
        return false;
      }

      // Use remaining quantity as the wasted amount
      const wastedQty = remainingQty;

      // Price is stored as per-unit cost (calculated from total price / quantity when added)
      // valueLost = price_per_unit × quantity_wasted
      const pricePerUnit = item.price || 0;

      // Delete the item FIRST (this will also delete images via deleteItem method)
      const deleteSuccess = await this.deleteItem(itemId);

      if (!deleteSuccess) {
        console.error(`Failed to delete item ${itemId} when marking as wasted`);
        return false;
      }

      // Only insert into wasted_items table AFTER successful deletion
      const insertQuery = `
        INSERT INTO wasted_items (user_id, item_name, category_id, quantity, unit, price, wasted_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        item.userId,
        item.name,
        item.categoryId ?? null,
        wastedQty,
        item.unit,
        pricePerUnit,
        new Date().toISOString()
      ];
      console.log('Inserting waste record with params:', params);
      const result = await this.db.run(insertQuery, params);
      console.log('Waste INSERT result:', result);

      // Check if insert was successful (lastId > 0 means insertion succeeded)
      if (!result || !result.changes || !result.changes.lastId) {
        console.error('Failed to insert waste record:', result);
        return false;
      }

      console.log(`Marked item ${itemId} as wasted and cleaned up images`);
      return true;
    } catch (error) {
      console.error('Error marking item as wasted:', error);
      return false;
    }
  }

  async searchItems(userId: number, searchTerm: string): Promise<InventoryItem[]> {
    try {
      const query = `
        SELECT * FROM inventory_items 
        WHERE user_id = ? AND (
          name LIKE ? OR notes LIKE ?
        )
        ORDER BY expiration_date ASC
      `;
      const searchPattern = `%${searchTerm}%`;
      const result = await this.db.query(query, [userId, searchPattern, searchPattern]);
      return this.mapToInventoryItems(result.values || []);
    } catch (error) {
      console.error('Error searching items:', error);
      return [];
    }
  }

  async filterItems(
    userId: number,
    categoryId?: number,
    locationId?: number,
    expiringDays?: number
  ): Promise<InventoryItem[]> {
    try {
      let query = `SELECT * FROM inventory_items WHERE user_id = ?`;
      const params: any[] = [userId];

      if (categoryId) {
        query += ` AND category_id = ?`;
        params.push(categoryId);
      }

      if (locationId) {
        query += ` AND location_id = ?`;
        params.push(locationId);
      }

      if (expiringDays !== undefined) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + expiringDays);
        const today = toLocalDateString(new Date());
        // Include items expiring between today and expiringDays from now
        query += ` AND expiration_date >= ? AND expiration_date <= ?`;
        params.push(today);
        params.push(toLocalDateString(futureDate));
      }

      query += ` ORDER BY expiration_date ASC`;

      const result = await this.db.query(query, params);
      return this.mapToInventoryItems(result.values || []);
    } catch (error) {
      console.error('Error filtering items:', error);
      return [];
    }
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    try {
      const query = `SELECT * FROM categories ORDER BY name ASC`;
      const result = await this.db.query(query, []);
      return this.mapToCategories(result.values || []);
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  // Locations
  async getLocations(userId: number): Promise<Location[]> {
    try {
      const query = `SELECT * FROM locations WHERE user_id = ? ORDER BY name ASC`;
      const result = await this.db.query(query, [userId]);
      return this.mapToLocations(result.values || []);
    } catch (error) {
      console.error('Error getting locations:', error);
      return [];
    }
  }

  async addLocation(location: Location): Promise<boolean> {
    try {
      const query = `
        INSERT INTO locations (user_id, name, sub_location)
        VALUES (?, ?, ?)
      `;
      await this.db.run(query, [
        location.userId,
        location.name,
        location.subLocation || null
      ]);
      return true;
    } catch (error) {
      console.error('Error adding location:', error);
      return false;
    }
  }

  async updateLocation(location: Location): Promise<boolean> {
    try {
      const query = `
        UPDATE locations SET name = ?, sub_location = ?
        WHERE id = ?
      `;
      await this.db.run(query, [
        location.name,
        location.subLocation || null,
        location.id
      ]);
      return true;
    } catch (error) {
      console.error('Error updating location:', error);
      return false;
    }
  }

  async deleteLocation(locationId: number): Promise<boolean> {
    try {
      const query = `DELETE FROM locations WHERE id = ?`;
      await this.db.run(query, [locationId]);
      return true;
    } catch (error) {
      console.error('Error deleting location:', error);
      return false;
    }
  }

  // Item Images
  async getItemImages(itemId: number): Promise<ItemImage[]> {
    try {
      const query = `
        SELECT * FROM item_images 
        WHERE item_id = ? 
        ORDER BY is_primary DESC, created_at ASC
      `;
      const result = await this.db.query(query, [itemId]);
      return this.mapToItemImages(result.values || []);
    } catch (error) {
      console.error('Error getting item images:', error);
      return [];
    }
  }

  async getImagesByBarcode(barcode: string, userId: number): Promise<ItemImage[]> {
    try {
      const query = `
        SELECT DISTINCT ii.* 
        FROM item_images ii
        INNER JOIN inventory_items i ON ii.item_id = i.id
        WHERE i.barcode = ? AND i.user_id = ?
        ORDER BY ii.created_at DESC
      `;
      const result = await this.db.query(query, [barcode, userId]);
      return this.mapToItemImages(result.values || []);
    } catch (error) {
      console.error('Error getting images by barcode:', error);
      return [];
    }
  }

  async addItemImage(itemImage: ItemImage): Promise<boolean> {
    try {
      // If this is set as primary, unset other primary images
      if (itemImage.isPrimary) {
        const updateQuery = `UPDATE item_images SET is_primary = 0 WHERE item_id = ?`;
        await this.db.run(updateQuery, [itemImage.itemId]);
      }

      const query = `
        INSERT INTO item_images (item_id, image_path, is_primary)
        VALUES (?, ?, ?)
      `;
      await this.db.run(query, [
        itemImage.itemId,
        itemImage.imagePath,
        itemImage.isPrimary ? 1 : 0
      ]);
      return true;
    } catch (error) {
      console.error('Error adding item image:', error);
      return false;
    }
  }

  async deleteItemImage(imageId: number): Promise<boolean> {
    try {
      // Get image details before deleting
      const getQuery = `SELECT * FROM item_images WHERE id = ?`;
      const result = await this.db.query(getQuery, [imageId]);
      
      if (result.values && result.values.length > 0) {
        const imagePath = result.values[0].image_path;
        
        // Delete image file from filesystem
        if (imagePath) {
          try {
            await this.imageService.deleteImage(imagePath);
            console.log(`Deleted image file: ${imagePath}`);
          } catch (imgErr) {
            console.warn(`Failed to delete image file ${imagePath}:`, imgErr);
          }
        }
      }
      
      // Delete image record from database
      const query = `DELETE FROM item_images WHERE id = ?`;
      await this.db.run(query, [imageId]);
      return true;
    } catch (error) {
      console.error('Error deleting item image:', error);
      return false;
    }
  }

  // Helper methods
  private mapToInventoryItems(rows: any[]): InventoryItem[] {
    return rows.map(row => this.mapToInventoryItem(row));
  }

  private mapToInventoryItem(row: any): InventoryItem {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      categoryId: row.category_id,
      quantity: row.quantity,
      unit: row.unit,
      purchaseDate: row.purchase_date,
      expirationDate: row.expiration_date,
      locationId: row.location_id,
      price: row.price,
      notes: row.notes,
      notificationEnabled: row.notification_enabled === 1,
      notificationDaysBefore: row.notification_days_before,
      barcode: row.barcode,
      initialQuantity: row.initial_quantity,
      currentQuantity: row.current_quantity,
      usageNotes: row.usage_notes,
      lowStockThreshold: row.low_stock_threshold,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToCategories(rows: any[]): Category[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color
    }));
  }

  private mapToLocations(rows: any[]): Location[] {
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      subLocation: row.sub_location
    }));
  }

  private mapToItemImages(rows: any[]): ItemImage[] {
    return rows.map(row => ({
      id: row.id,
      itemId: row.item_id,
      imagePath: row.image_path,
      isPrimary: row.is_primary === 1,
      createdAt: row.created_at
    }));
  }

  // Usage Tracking
  async updateItemUsage(itemId: number, currentQuantity: number, amountUsed: number, notes?: string): Promise<boolean> {
    try {
      // Update item's current quantity
      const updateQuery = `
        UPDATE inventory_items
        SET current_quantity = ?
        WHERE id = ?
      `;
      await this.db.run(updateQuery, [currentQuantity, itemId]);

      // Record usage history
      const historyQuery = `
        INSERT INTO usage_history (item_id, amount_used, remaining_amount, notes, recorded_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      await this.db.run(historyQuery, [
        itemId,
        amountUsed,
        currentQuantity,
        notes || null,
        new Date().toISOString()
      ]);

      return true;
    } catch (error) {
      console.error('Error updating item usage:', error);
      return false;
    }
  }

  async getUsageHistory(itemId: number): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM usage_history
        WHERE item_id = ?
        ORDER BY recorded_at DESC
      `;
      const result = await this.db.query(query, [itemId]);
      return result.values || [];
    } catch (error) {
      console.error('Error getting usage history:', error);
      return [];
    }
  }

  async calculateConsumptionRate(itemId: number): Promise<number | null> {
    try {
      const history = await this.getUsageHistory(itemId);
      
      if (history.length < 2) return null;

      // Calculate average daily consumption
      const firstRecord = history[history.length - 1];
      const lastRecord = history[0];
      
      const firstDate = new Date(firstRecord.recorded_at);
      const lastDate = new Date(lastRecord.recorded_at);
      const daysDiff = Math.max(1, Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      const totalUsed = history.reduce((sum, record) => sum + record.amount_used, 0);
      const averagePerDay = totalUsed / daysDiff;
      
      return averagePerDay;
    } catch (error) {
      console.error('Error calculating consumption rate:', error);
      return null;
    }
  }

  async predictRunOutDate(itemId: number): Promise<Date | null> {
    try {
      const item = await this.getItemById(itemId);
      if (!item || item.currentQuantity === undefined || item.currentQuantity === 0) return null;

      const consumptionRate = await this.calculateConsumptionRate(itemId);
      if (!consumptionRate || consumptionRate <= 0) return null;

      const daysRemaining = item.currentQuantity / consumptionRate;
      const runOutDate = new Date();
      runOutDate.setDate(runOutDate.getDate() + Math.ceil(daysRemaining));
      
      return runOutDate;
    } catch (error) {
      console.error('Error predicting run-out date:', error);
      return null;
    }
  }

  async getLowStockItems(userId: number, globalThreshold: number = 20): Promise<InventoryItem[]> {
    try {
      const items = await this.getItems(userId);
      return items.filter(item => {
        if (item.initialQuantity && item.currentQuantity !== undefined) {
          const percentage = (item.currentQuantity / item.initialQuantity) * 100;
          // Use per-item threshold if set, otherwise fall back to global threshold
          const itemThreshold = item.lowStockThreshold ?? globalThreshold;
          return percentage <= itemThreshold && percentage > 0;
        }
        return false;
      });
    } catch (error) {
      console.error('Error getting low stock items:', error);
      return [];
    }
  }

  // ==================== Inventory Batches Methods ====================

  async getBatches(itemId: number): Promise<any[]> {
    return await this.db.getBatchesByItem(itemId);
  }

  async addBatch(batch: any): Promise<number> {
    return await this.db.addBatch(batch);
  }

  async updateBatch(batch: any): Promise<boolean> {
    return await this.db.updateBatch(batch);
  }

  async deleteBatch(batchId: number): Promise<boolean> {
    return await this.db.deleteBatch(batchId);
  }

  async deleteBatchesByItem(itemId: number): Promise<boolean> {
    return await this.db.deleteBatchesByItem(itemId);
  }

  async getTotalBatchQuantity(itemId: number): Promise<number> {
    return await this.db.getTotalBatchQuantity(itemId);
  }

  async getEarliestBatchExpiration(itemId: number): Promise<string | null> {
    return await this.db.getEarliestBatchExpiration(itemId);
  }

  /**
   * Deduct quantity using FIFO (First Expiring First Out)
   * Validates total available stock first to prevent over-deduction
   * @param itemId The inventory item ID
   * @param amountToDeduct Amount to deduct
   * @returns Success boolean
   */
  async deductFromBatchesFIFO(itemId: number, amountToDeduct: number): Promise<boolean> {
    try {
      // Get all batches sorted by expiration date (FIFO)
      const batches = await this.getBatches(itemId);

      // Calculate total available stock across all batches
      const totalAvailable = batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);

      // Prevent over-deduction: error if trying to deduct more than available
      if (amountToDeduct > totalAvailable) {
        console.error(
          `Over-deduction prevented: requested ${amountToDeduct} but only ${totalAvailable} available`
        );
        return false;
      }

      let remaining = amountToDeduct;

      for (const batch of batches) {
        if (remaining <= 0) break;

        if (batch.quantity >= remaining) {
          // This batch has enough to cover the remaining amount
          const newQuantity = batch.quantity - remaining;

          if (newQuantity === 0) {
            // Batch depleted, delete it
            await this.deleteBatch(batch.id);
          } else {
            // Update batch with reduced quantity
            await this.updateBatch({
              id: batch.id,
              quantity: newQuantity,
              expirationDate: batch.expiration_date || batch.expirationDate,
              purchaseDate: batch.purchase_date || batch.purchaseDate,
              price: batch.price,
              notes: batch.notes
            });
          }
          remaining = 0;
        } else {
          // Use entire batch and move to next
          remaining -= batch.quantity;
          await this.deleteBatch(batch.id);
        }
      }

      // Update the parent item's current_quantity
      const actuallyDeducted = amountToDeduct - remaining;
      if (actuallyDeducted > 0) {
        const itemResult = await this.db.query(
          `SELECT id, quantity, current_quantity FROM inventory_items WHERE id = ?`,
          [itemId]
        );
        if (itemResult.values && itemResult.values.length > 0) {
          const item = itemResult.values[0];
          const currentQty = item.current_quantity ?? item.quantity ?? 0;
          const newCurrentQuantity = Math.max(0, currentQty - actuallyDeducted);
          await this.db.run(
            `UPDATE inventory_items SET current_quantity = ? WHERE id = ?`,
            [newCurrentQuantity, itemId]
          );
        }
      }

      return remaining === 0;
    } catch (error) {
      console.error('Error deducting from batches (FIFO):', error);
      return false;
    }
  }
}
