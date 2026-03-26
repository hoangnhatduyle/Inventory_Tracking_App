import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalDatePipe } from '../../pipes/local-date.pipe';
import { parseLocalDate } from '../../utils/date.utils';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { StatisticsService } from '../../services/statistics.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { DashboardStatistics, Recipe } from '../../models/statistics.model';
import { InventoryItem } from '../../models/inventory.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LocalDatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  userId: number | null = null;
  username = '';
  statistics: DashboardStatistics | null = null;
  recentItems: InventoryItem[] = [];
  recipes: Recipe[] = [];
  lowStockItems: Array<{
    item: InventoryItem;
    percentage: number;
    consumptionRate: number | null;
    predictedRunOutDate: Date | null;
  }> = [];
  isLoading = false;
  isLoadingLowStock = false;
  viewMode: 'stats' | 'board' = 'board';
  itemsByLocation: { [key: string]: InventoryItem[] } = {};
  showLowStockDetails = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private inventoryService: InventoryService,
    private statisticsService: StatisticsService,
    private errorHandler: ErrorHandlerService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  async ngOnInit() {
    this.userId = await this.authService.getUserId();
    const user = await this.authService.getCurrentUser();
    this.username = user?.username || 'User';

    await this.loadDashboardData();
    await this.groupItemsByLocation();
  }

  async loadDashboardData() {
    if (!this.userId) return;

    this.isLoading = true;
    try {
      // Load statistics
      this.statistics = await this.statisticsService.getDashboardStatistics(this.userId);

      // Load recent items (last 5 added)
      const allItems = await this.inventoryService.getItems(this.userId);
      this.recentItems = allItems
        .sort((a, b) => (b.id || 0) - (a.id || 0))
        .slice(0, 5);

      // Load recipe suggestions
      this.recipes = await this.statisticsService.getRecipeSuggestions(this.userId);

      // Load low stock items in background
      this.loadLowStockItems();
    } catch (error) {
      this.errorHandler.handleDataError('load dashboard', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadLowStockItems() {
    if (!this.userId) return;

    this.isLoadingLowStock = true;
    try {
      const items = await this.inventoryService.getLowStockItems(this.userId);

      // Enrich with consumption rate and predicted run-out date
      this.lowStockItems = await Promise.all(
        items.map(async (item) => {
          const percentage = item.initialQuantity
            ? (item.currentQuantity! / item.initialQuantity) * 100
            : 0;
          const consumptionRate = await this.inventoryService.calculateConsumptionRate(item.id!);
          const predictedRunOutDate = await this.inventoryService.predictRunOutDate(item.id!);

          return {
            item,
            percentage,
            consumptionRate,
            predictedRunOutDate
          };
        })
      );

      // Sort by percentage (lowest first)
      this.lowStockItems.sort((a, b) => a.percentage - b.percentage);
    } catch (error) {
      console.error('Error loading low stock items:', error);
      this.snackBar.open('Failed to load low stock data', 'Close', { duration: 3000 });
    } finally {
      this.isLoadingLowStock = false;
    }
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  getCategoryName(categoryId: number): string {
    return this.statistics?.categoryBreakdown.find((c: any) => c.categoryId === categoryId)?.categoryName || 'Unknown';
  }

  getLocationName(locationId: number): string {
    return this.statistics?.locationBreakdown.find((l: any) => l.locationId === locationId)?.locationName || 'Unknown';
  }

  getDaysUntilExpiration(expirationDate: string | Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = typeof expirationDate === 'string' ? parseLocalDate(expirationDate) : new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysUntilRunOut(runOutDate: Date | null): number | null {
    if (!runOutDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const roDate = new Date(runOutDate);
    const diffTime = roDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getUsagePercentage(item: InventoryItem): number {
    if (!item.initialQuantity || item.currentQuantity === undefined) return 100;
    return (item.currentQuantity / item.initialQuantity) * 100;
  }

  navigateToInventory() {
    this.router.navigate(['/inventory']);
  }

  navigateToAddItem() {
    this.router.navigate(['/item/add']);
  }

  navigateToShoppingList() {
    this.router.navigate(['/shopping-list']);
  }

  navigateToSettings() {
    this.router.navigate(['/settings']);
  }

  onViewItem(item: InventoryItem) {
    this.router.navigate(['/item/edit', item.id]);
  }

  getTotalWastedValue(): string {
    if (!this.statistics || !this.statistics.wastedItems) return '0.00';
    const total = this.statistics.wastedItems.reduce((sum: number, item: any) => sum + (item.totalValue || 0), 0);
    return total.toFixed(2);
  }

  getTotalWastedCount(): number {
    if (!this.statistics || !this.statistics.wastedItems) return 0;
    return this.statistics.wastedItems.reduce((sum: number, item: any) => sum + (item.timesWasted || 0), 0);
  }

  navigateToWasteTracking() {
    this.router.navigate(['/waste-tracking']);
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'stats' ? 'board' : 'stats';
    if (this.viewMode === 'board') {
      this.groupItemsByLocation();
    }
  }

  async groupItemsByLocation() {
    if (!this.userId) return;

    try {
      const allItems = await this.inventoryService.getItems(this.userId);
      const locations = await this.inventoryService.getLocations(this.userId);

      // Initialize groups
      this.itemsByLocation = {};

      // Create a group for each location
      locations.forEach(location => {
        const key = location.subLocation
          ? `${location.name} - ${location.subLocation}`
          : location.name;
        this.itemsByLocation[key] = [];
      });

      // Group items by location
      allItems.forEach(item => {
        const location = locations.find(l => l.id === item.locationId);
        if (location) {
          const key = location.subLocation
            ? `${location.name} - ${location.subLocation}`
            : location.name;
          if (this.itemsByLocation[key]) {
            this.itemsByLocation[key].push(item);
          }
        }
      });

      // Sort items within each location by expiration date
      Object.keys(this.itemsByLocation).forEach(key => {
        this.itemsByLocation[key].sort((a, b) => {
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        });
      });
    } catch (error) {
      console.error('Error grouping items:', error);
      this.snackBar.open('Failed to load board view', 'Close', { duration: 3000 });
    }
  }

  getLocationIcon(locationName: string): string {
    const name = locationName.toLowerCase();
    if (name.includes('frozen') || name.includes('freezer')) return 'ac_unit';
    if (name.includes('fridge') || name.includes('refrigerator')) return 'kitchen';
    if (name.includes('pantry') || name.includes('cabinet')) return 'shelves';
    if (name.includes('snack')) return 'cookie';
    if (name.includes('bar') || name.includes('drink')) return 'local_bar';
    return 'inventory_2';
  }

  getItemStatusIcon(item: InventoryItem): string {
    const status = this.getItemStatus(item);
    if (status === 'expired') return 'error';
    if (status === 'expiring-soon') return 'warning';
    return '';
  }

  getItemStatus(item: InventoryItem): 'fresh' | 'expiring-soon' | 'expired' {
    if (!item.expirationDate) return 'fresh';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = typeof item.expirationDate === 'string'
      ? parseLocalDate(item.expirationDate)
      : new Date(item.expirationDate);

    if (expDate < today) return 'expired';

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (expDate <= threeDaysFromNow) return 'expiring-soon';

    return 'fresh';
  }

  hasLocations(): boolean {
    return Object.keys(this.itemsByLocation).length > 0;
  }

  getLocationKeys(): string[] {
    return Object.keys(this.itemsByLocation);
  }

  getItemPercentage(item: InventoryItem): number {
    if (!item.initialQuantity || item.currentQuantity === undefined) return 100;
    return (item.currentQuantity / item.initialQuantity) * 100;
  }

  toggleLowStockDetails() {
    this.showLowStockDetails = !this.showLowStockDetails;
  }
}
