import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ShoppingListService } from '../../services/shopping-list.service';
import { InventoryService } from '../../services/inventory.service';
import { ShoppingListItem, Category } from '../../models/inventory.model';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatChipsModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  templateUrl: './shopping-list.html',
  styleUrl: './shopping-list.scss',
})
export class ShoppingList implements OnInit {
  userId: number | null = null;
  items: ShoppingListItem[] = [];
  categories: Category[] = [];
  
  // Add item form
  newItemName = '';
  newItemQuantity = '';
  newItemNotes = '';
  
  // View options
  groupByCategory = false;
  showPurchased = true;

  constructor(
    private authService: AuthService,
    private shoppingListService: ShoppingListService,
    private inventoryService: InventoryService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.userId = await this.authService.getUserId();
    await this.loadData();
  }

  async loadData() {
    if (!this.userId) return;

    try {
      this.items = await this.shoppingListService.getItems(this.userId);
      this.categories = await this.inventoryService.getCategories();
    } catch (error) {
      console.error('Error loading shopping list:', error);
      this.snackBar.open('Failed to load shopping list', 'Close', { duration: 3000 });
    }
  }

  getFilteredItems(): ShoppingListItem[] {
    if (this.showPurchased) {
      return this.items;
    }
    return this.items.filter(item => !item.isPurchased);
  }

  getGroupedItems(): { [key: string]: ShoppingListItem[] } {
    const filtered = this.getFilteredItems();
    
    if (!this.groupByCategory) {
      return { 'all': filtered };
    }

    const grouped: { [key: string]: ShoppingListItem[] } = {};
    
    // Group by category
    filtered.forEach(item => {
      const category = this.getCategoryName(item.categoryId || null);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    // Sort purchased to bottom within each group
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        if (a.isPurchased === b.isPurchased) return 0;
        return a.isPurchased ? 1 : -1;
      });
    });

    return grouped;
  }

  getCategoryName(categoryId: number | null): string {
    if (!categoryId) return 'Uncategorized';
    return this.categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
  }

  async onAddItem() {
    if (!this.userId || !this.newItemName.trim()) {
      this.snackBar.open('Item name is required', 'Close', { duration: 3000 });
      return;
    }

    try {
      const newItem: ShoppingListItem = {
        userId: this.userId,
        name: this.newItemName.trim(),
        quantity: this.newItemQuantity.trim() || undefined,
        notes: this.newItemNotes.trim() || undefined,
        isPurchased: false
      };

      await this.shoppingListService.addItem(newItem);
      
      // Clear form
      this.newItemName = '';
      this.newItemQuantity = '';
      this.newItemNotes = '';
      
      // Reload list
      await this.loadData();
      
      this.snackBar.open('Item added to shopping list', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Error adding item:', error);
      this.snackBar.open('Failed to add item', 'Close', { duration: 3000 });
    }
  }

  async onTogglePurchased(item: ShoppingListItem) {
    if (!item.id) return;

    try {
      await this.shoppingListService.togglePurchased(item.id);
      await this.loadData();
    } catch (error) {
      console.error('Error toggling item:', error);
      this.snackBar.open('Failed to update item', 'Close', { duration: 3000 });
    }
  }

  async onDeleteItem(item: ShoppingListItem) {
    if (!item.id) return;

    try {
      await this.shoppingListService.deleteItem(item.id);
      await this.loadData();
      this.snackBar.open('Item removed', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Error deleting item:', error);
      this.snackBar.open('Failed to delete item', 'Close', { duration: 3000 });
    }
  }

  async onClearPurchased() {
    const purchasedCount = this.items.filter(i => i.isPurchased).length;
    
    if (purchasedCount === 0) {
      this.snackBar.open('No purchased items to clear', 'Close', { duration: 2000 });
      return;
    }

    const confirmed = confirm(`Clear ${purchasedCount} purchased item(s)?`);
    if (!confirmed) return;

    try {
      await this.shoppingListService.clearPurchased(this.userId!);
      await this.loadData();
      this.snackBar.open(`${purchasedCount} item(s) cleared`, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error clearing purchased items:', error);
      this.snackBar.open('Failed to clear items', 'Close', { duration: 3000 });
    }
  }

  async onExportList() {
    if (!this.userId) return;

    try {
      await this.shoppingListService.exportToText(this.userId);
      this.snackBar.open('Shopping list exported!', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error exporting list:', error);
      this.snackBar.open('Failed to export list', 'Close', { duration: 3000 });
    }
  }

  get pendingCount(): number {
    return this.items.filter(i => !i.isPurchased).length;
  }

  get purchasedCount(): number {
    return this.items.filter(i => i.isPurchased).length;
  }

  onBackToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
