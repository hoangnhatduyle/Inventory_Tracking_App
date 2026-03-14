import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { WasteTrackingService } from '../../services/waste-tracking.service';
import { WastedItem, WasteStatistics } from '../../models/waste-tracking.model';
import { Category } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-waste-tracking',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatPaginatorModule
  ],
  templateUrl: './waste-tracking.html',
  styleUrls: ['./waste-tracking.scss']
})
export class WasteTrackingComponent implements OnInit {
  wastedItems: WastedItem[] = [];
  filteredItems: WastedItem[] = [];
  statistics: WasteStatistics | null = null;
  categories: Category[] = [];
  selectedCategoryId: number | null = null;
  selectedTimeRange: string = 'all'; // 'week', 'month', 'year', 'all'
  loading = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  pageSize = 20;
  pageIndex = 0;

  get pagedItems(): WastedItem[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  constructor(
    private wasteTrackingService: WasteTrackingService,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const user = await this.authService.getCurrentUser();
      if (user) {
        [this.wastedItems, this.statistics, this.categories] = await Promise.all([
          this.wasteTrackingService.getWastedItems(user.id!),
          this.wasteTrackingService.getWasteStatistics(user.id!),
          this.inventoryService.getCategories()
        ]);
        this.applyFilters();
      }
    } catch (error) {
      console.error('Error loading waste data:', error);
      this.snackBar.open('Failed to load waste data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    let filtered = [...this.wastedItems];

    // Filter by category
    if (this.selectedCategoryId) {
      filtered = filtered.filter(item => item.categoryId === this.selectedCategoryId);
    }

    // Filter by time range
    if (this.selectedTimeRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (this.selectedTimeRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(item => new Date(item.wastedDate) >= cutoffDate);
    }

    this.filteredItems = filtered;
    this.pageIndex = 0;
    if (this.paginator) this.paginator.firstPage();
  }

  onCategoryFilterChange(categoryId: number | null) {
    this.selectedCategoryId = categoryId;
    this.applyFilters();
  }

  onTimeRangeChange(range: string) {
    this.selectedTimeRange = range;
    this.applyFilters();
  }

  async onDeleteItem(item: WastedItem) {
    if (confirm(`Remove "${item.itemName}" from waste history?`)) {
      const success = await this.wasteTrackingService.deleteWastedItem(item.id!);
      if (success) {
        await this.loadData();
      }
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatValue(price: number, quantity: number): string {
    return ((price || 0) * quantity).toFixed(2);
  }

  getCategoryIcon(categoryName: string): string {
    const iconMap: { [key: string]: string } = {
      'Fruits': 'apple',
      'Vegetables': 'eco',
      'Dairy': 'egg',
      'Meat': 'food_bank',
      'Grains': 'grain',
      'Beverages': 'local_drink',
      'Snacks': 'cookie',
      'Frozen': 'ac_unit',
      'Condiments': 'liquor',
      'Other': 'shopping_basket'
    };
    return iconMap[categoryName] || 'inventory_2';
  }

  getFilteredStats(): { itemsWasted: number; valueLost: number } {
    const itemsWasted = this.filteredItems.length;
    const valueLost = this.filteredItems.reduce((sum, item) => 
      sum + ((item.price || 0) * item.quantity), 0
    );
    return { itemsWasted, valueLost };
  }
}
