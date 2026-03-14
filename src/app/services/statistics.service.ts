import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { InventoryService } from './inventory.service';
import { DashboardStatistics, CategoryStats, LocationStats, WastedItemStats, Recipe } from '../models/statistics.model';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  constructor(
    private db: DatabaseService,
    private inventoryService: InventoryService
  ) {}

  async getDashboardStatistics(userId: number): Promise<DashboardStatistics> {
    try {
      const items = await this.inventoryService.getItems(userId);
      const categories = await this.inventoryService.getCategories();
      const locations = await this.inventoryService.getLocations(userId);

      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(now.getDate() + 3);
      const weekLater = new Date(now);
      weekLater.setDate(now.getDate() + 7);

      let totalValue = 0;
      let expiringIn3Days = 0;
      let expiringInWeek = 0;
      let expiredItems = 0;

      const categoryMap = new Map<number, { count: number; value: number }>();
      const locationMap = new Map<number, number>();

      items.forEach(item => {
        const expirationDate = new Date(item.expirationDate);
        
        // Calculate total value (use current quantity, not initial)
        if (item.price) {
          totalValue += item.price * (item.currentQuantity ?? item.quantity);
        }

        // Count expiring items
        if (expirationDate < now) {
          expiredItems++;
        } else if (expirationDate <= threeDaysLater) {
          expiringIn3Days++;
        } else if (expirationDate <= weekLater) {
          expiringInWeek++;
        }

        // Category breakdown
        const catStats = categoryMap.get(item.categoryId) || { count: 0, value: 0 };
        catStats.count++;
        catStats.value += (item.price || 0) * (item.currentQuantity ?? item.quantity);
        categoryMap.set(item.categoryId, catStats);

        // Location breakdown
        const locCount = locationMap.get(item.locationId) || 0;
        locationMap.set(item.locationId, locCount + 1);
      });

      // Build category breakdown
      const categoryBreakdown: CategoryStats[] = [];
      categoryMap.forEach((stats, categoryId) => {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          categoryBreakdown.push({
            categoryName: category.name,
            count: stats.count,
            totalValue: stats.value
          });
        }
      });

      // Build location breakdown
      const locationBreakdown: LocationStats[] = [];
      locationMap.forEach((count, locationId) => {
        const location = locations.find(l => l.id === locationId);
        if (location) {
          locationBreakdown.push({
            locationName: location.name + (location.subLocation ? ` - ${location.subLocation}` : ''),
            count
          });
        }
      });

      // Get wasted items statistics
      const mostWastedItems = await this.getMostWastedItems(userId);

      // Get recent items (last 5 added) - create copy to avoid mutating original array
      const recentItems = [...items]
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
        .slice(0, 5);

      return {
        totalItems: items.length,
        totalValue,
        expiringSoon: expiringIn3Days,
        expiringIn3Days,
        expiringInWeek,
        expired: expiredItems,
        expiredItems,
        categoryBreakdown,
        locationBreakdown,
        mostWastedItems,
        wastedItems: mostWastedItems,
        recentItems
      };
    } catch (error) {
      console.error('Error getting dashboard statistics:', error);
      return {
        totalItems: 0,
        totalValue: 0,
        expiringSoon: 0,
        expiringIn3Days: 0,
        expiringInWeek: 0,
        expired: 0,
        expiredItems: 0,
        categoryBreakdown: [],
        locationBreakdown: [],
        mostWastedItems: [],
        wastedItems: [],
        recentItems: []
      };
    }
  }

  private async getMostWastedItems(userId: number): Promise<WastedItemStats[]> {
    try {
      const query = `
        SELECT 
          w.item_name,
          c.name as category_name,
          COUNT(*) as times_wasted,
          SUM(w.price * w.quantity) as total_value
        FROM wasted_items w
        LEFT JOIN categories c ON w.category_id = c.id
        WHERE w.user_id = ?
        GROUP BY w.item_name, c.name
        ORDER BY times_wasted DESC, total_value DESC
        LIMIT 10
      `;
      
      const result = await this.db.query(query, [userId]);
      
      if (result.values) {
        return result.values.map((row: any) => ({
          itemName: row.item_name,
          categoryName: row.category_name || 'Unknown',
          timesWasted: row.times_wasted,
          totalValue: row.total_value || 0
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error getting wasted items:', error);
      return [];
    }
  }

  async getTotalWasteStats(userId: number): Promise<{ totalItems: number; totalValue: number }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_items,
          SUM(price * quantity) as total_value
        FROM wasted_items
        WHERE user_id = ?
      `;
      
      const result = await this.db.query(query, [userId]);
      
      if (result.values && result.values.length > 0) {
        const row = result.values[0];
        return {
          totalItems: row.total_items || 0,
          totalValue: row.total_value || 0
        };
      }
      
      return { totalItems: 0, totalValue: 0 };
    } catch (error) {
      console.error('Error getting total waste stats:', error);
      return { totalItems: 0, totalValue: 0 };
    }
  }

  async getAllRecipes(): Promise<Recipe[]> {
    try {
      const query = `SELECT * FROM recipes ORDER BY name ASC`;
      const result = await this.db.query(query, []);
      
      if (result.values) {
        return result.values.map((row: any) => ({
          id: row.id,
          name: row.name,
          ingredients: row.ingredients || '',
          ingredientsList: (row.ingredients || '').split(',').map((i: string) => i.trim()).filter((i: string) => i.length > 0),
          prepTime: row.prep_time,
          servings: row.servings,
          instructions: row.instructions || '',
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error getting recipes:', error);
      return [];
    }
  }

  async addRecipe(recipe: Recipe): Promise<boolean> {
    try {
      const query = `
        INSERT INTO recipes (name, ingredients, prep_time, servings, instructions)
        VALUES (?, ?, ?, ?, ?)
      `;
      await this.db.run(query, [
        recipe.name,
        recipe.ingredients,
        recipe.prepTime,
        recipe.servings,
        recipe.instructions || ''
      ]);
      return true;
    } catch (error) {
      console.error('Error adding recipe:', error);
      return false;
    }
  }

  async updateRecipe(recipe: Recipe): Promise<boolean> {
    try {
      const query = `
        UPDATE recipes 
        SET name = ?, ingredients = ?, prep_time = ?, servings = ?, instructions = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await this.db.run(query, [
        recipe.name,
        recipe.ingredients,
        recipe.prepTime,
        recipe.servings,
        recipe.instructions || '',
        recipe.id
      ]);
      return true;
    } catch (error) {
      console.error('Error updating recipe:', error);
      return false;
    }
  }

  async deleteRecipe(recipeId: number): Promise<boolean> {
    try {
      const query = `DELETE FROM recipes WHERE id = ?`;
      await this.db.run(query, [recipeId]);
      return true;
    } catch (error) {
      console.error('Error deleting recipe:', error);
      return false;
    }
  }

  async getRecipeSuggestions(userId: number): Promise<Recipe[]> {
    try {
      // Get items expiring in the next 7 days
      const items = await this.inventoryService.filterItems(userId, undefined, undefined, 7);
      
      if (items.length === 0) {
        return [];
      }

      // Get all recipes from database
      const recipes = await this.getAllRecipes();
      
      if (recipes.length === 0) {
        return [];
      }

      // Get categories for items
      const categories = await this.inventoryService.getCategories();
      const categoryMap = new Map(categories.map(c => [c.id!, c.name.toLowerCase()]));

      // Score recipes based on matching ingredients
      const scoredRecipes = recipes.map((recipe: Recipe) => {
        const matchingItems: string[] = [];
        let matchCount = 0;
        const ingredientsList = recipe.ingredientsList || recipe.ingredients.split(',').map(i => i.trim());

        ingredientsList.forEach((ingredient: string) => {
          // Check if ingredient matches any item name or category
          const matches = items.filter(item => {
            const itemName = item.name.toLowerCase();
            const itemCategory = categoryMap.get(item.categoryId) || '';
            return itemName.includes(ingredient.toLowerCase()) || 
                   itemCategory.includes(ingredient.toLowerCase()) ||
                   ingredient.toLowerCase().includes(itemName);
          });

          if (matches.length > 0) {
            matchCount++;
            matches.forEach(match => {
              if (!matchingItems.includes(match.name)) {
                matchingItems.push(match.name);
              }
            });
          }
        });

        return {
          ...recipe,
          matchingItems,
          matchCount
        };
      });

      // Filter recipes with at least 2 matching ingredients and sort by match count
      return scoredRecipes
        .filter((recipe: Recipe) => (recipe.matchCount || 0) >= 2)
        .sort((a: Recipe, b: Recipe) => (b.matchCount || 0) - (a.matchCount || 0))
        .slice(0, 5);
    } catch (error) {
      console.error('Error getting recipe suggestions:', error);
      return [];
    }
  }

  private sanitizeCsvField(value: string): string {
    // Escape internal double-quotes
    const escaped = value.replace(/"/g, '""');
    // Strip formula-injection prefixes (=, +, -, @, TAB, CR)
    const safe = escaped.replace(/^[=+\-@\t\r]+/, '');
    return safe;
  }

  async exportInventoryData(userId: number): Promise<string> {
    try {
      const items = await this.inventoryService.getItems(userId);
      const categories = await this.inventoryService.getCategories();
      const locations = await this.inventoryService.getLocations(userId);

      const categoryMap = new Map(categories.map(c => [c.id!, c.name]));
      const locationMap = new Map(locations.map(l => [l.id!, `${l.name}${l.subLocation ? ' - ' + l.subLocation : ''}`]));

      // Create CSV header
      let csv = 'Name,Category,Quantity,Unit,Purchase Date,Expiration Date,Location,Price,Notes,Notification Enabled,Notification Days Before\n';

      // Add items
      items.forEach(item => {
        const category = categoryMap.get(item.categoryId) || 'Unknown';
        const location = locationMap.get(item.locationId) || 'Unknown';

        csv += `"${this.sanitizeCsvField(item.name)}","${this.sanitizeCsvField(category)}",${item.quantity},"${this.sanitizeCsvField(item.unit)}","${item.purchaseDate}","${item.expirationDate}","${this.sanitizeCsvField(location)}",${item.price || 0},"${this.sanitizeCsvField(item.notes || '')}",${item.notificationEnabled},${item.notificationDaysBefore}\n`;
      });

      return csv;
    } catch (error) {
      console.error('Error exporting inventory data:', error);
      return '';
    }
  }
}
