import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { ShoppingListItem } from '../models/inventory.model';

@Injectable({
  providedIn: 'root'
})
export class ShoppingListService {
  constructor(private db: DatabaseService) {}

  async getItems(userId: number): Promise<ShoppingListItem[]> {
    try {
      const query = `
        SELECT * FROM shopping_list 
        WHERE user_id = ? 
        ORDER BY is_purchased ASC, created_at DESC
      `;
      const result = await this.db.query(query, [userId]);
      return this.mapToShoppingListItems(result.values || []);
    } catch (error) {
      console.error('Error getting shopping list items:', error);
      return [];
    }
  }

  async addItem(item: ShoppingListItem): Promise<boolean> {
    try {
      const query = `
        INSERT INTO shopping_list (user_id, name, quantity, notes, category_id, is_purchased)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await this.db.run(query, [
        item.userId,
        item.name,
        item.quantity || null,
        item.notes || null,
        item.categoryId || null,
        item.isPurchased ? 1 : 0
      ]);
      return true;
    } catch (error) {
      console.error('Error adding shopping list item:', error);
      return false;
    }
  }

  async updateItem(item: ShoppingListItem): Promise<boolean> {
    try {
      const query = `
        UPDATE shopping_list SET
          name = ?, quantity = ?, notes = ?, category_id = ?, is_purchased = ?
        WHERE id = ?
      `;
      await this.db.run(query, [
        item.name,
        item.quantity || null,
        item.notes || null,
        item.categoryId || null,
        item.isPurchased ? 1 : 0,
        item.id
      ]);
      return true;
    } catch (error) {
      console.error('Error updating shopping list item:', error);
      return false;
    }
  }

  async togglePurchased(itemId: number): Promise<boolean> {
    try {
      const query = `
        UPDATE shopping_list SET is_purchased = CASE WHEN is_purchased = 0 THEN 1 ELSE 0 END
        WHERE id = ?
      `;
      await this.db.run(query, [itemId]);
      return true;
    } catch (error) {
      console.error('Error toggling purchased status:', error);
      return false;
    }
  }

  async deleteItem(itemId: number): Promise<boolean> {
    try {
      const query = `DELETE FROM shopping_list WHERE id = ?`;
      await this.db.run(query, [itemId]);
      return true;
    } catch (error) {
      console.error('Error deleting shopping list item:', error);
      return false;
    }
  }

  async clearPurchased(userId: number): Promise<boolean> {
    try {
      const query = `DELETE FROM shopping_list WHERE user_id = ? AND is_purchased = 1`;
      await this.db.run(query, [userId]);
      return true;
    } catch (error) {
      console.error('Error clearing purchased items:', error);
      return false;
    }
  }

  async exportToText(userId: number): Promise<string> {
    try {
      const items = await this.getItems(userId);
      const unpurchased = items.filter(item => !item.isPurchased);
      
      let text = '=== Shopping List ===\n\n';
      unpurchased.forEach((item, index) => {
        const quantityText = item.quantity ? ` - ${item.quantity}` : '';
        text += `${index + 1}. ${item.name}${quantityText}\n`;
      });
      
      return text;
    } catch (error) {
      console.error('Error exporting shopping list:', error);
      return '';
    }
  }

  private mapToShoppingListItems(rows: any[]): ShoppingListItem[] {
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      quantity: row.quantity,
      notes: row.notes,
      categoryId: row.category_id,
      isPurchased: row.is_purchased === 1,
      createdAt: row.created_at
    }));
  }
}
