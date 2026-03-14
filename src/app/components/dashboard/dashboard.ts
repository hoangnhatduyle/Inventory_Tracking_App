import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
      const items = await this.inventoryService.getLowStockItems(this.userId, 20);

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

  getDaysUntilExpiration(expirationDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
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
    const expDate = new Date(item.expirationDate);
    expDate.setHours(0, 0, 0, 0);

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

  showQuickInstructions() {
    this.dialog.open(QuickInstructionsDialog, {
      width: '600px',
      panelClass: 'quick-instructions-dialog'
    });
  }
}

// Quick Instructions Dialog Component
@Component({
  selector: 'quick-instructions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-icon">
          <mat-icon>info</mat-icon>
        </div>
        <h2 mat-dialog-title>Getting Started 🚀</h2>
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <mat-dialog-content>
        <p class="intro-text">
          Welcome to <strong>Chắt Chiu</strong> - your personal grocery inventory management system!
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3><mat-icon>settings</mat-icon> Setup Locations</h3>
              <p>Configure your storage areas like Fridge, Freezer, and Pantry to organize your items efficiently.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3><mat-icon>add_circle</mat-icon> Add Items</h3>
              <p>Start tracking your groceries by adding items with details like quantity, expiration dates, and categories.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3><mat-icon>notifications_active</mat-icon> Enable Notifications</h3>
              <p>Get timely reminders before items expire to reduce waste and save money.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3><mat-icon>timeline</mat-icon> Track Usage</h3>
              <p>Monitor consumption patterns and get predictions on when items will run out.</p>
            </div>
          </div>
        </div>

        <div class="tips-section">
          <div class="tip-header">
            <mat-icon>lightbulb</mat-icon>
            <h3>Pro Tips</h3>
          </div>
          <ul class="tips-list">
            <li><mat-icon>check_circle</mat-icon> Use barcode scanning for quick item entry</li>
            <li><mat-icon>check_circle</mat-icon> Set up shopping lists to never forget items</li>
            <li><mat-icon>check_circle</mat-icon> Review your waste tracking to improve habits</li>
          </ul>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions>
        <button mat-raised-button color="primary" mat-dialog-close>
          <mat-icon>check</mat-icon>
          Got it!
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 0;
      overflow: hidden;
    }

    .dialog-header {
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      padding: 1.5rem 2.5rem;
      position: relative;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-radius: 4px 4px 0 0;
      margin: -24px -24px 0 -24px;

      .header-icon {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }

      h2 {
        margin: 0;
        flex: 1;
        font-size: 1.5rem;
        font-weight: 500;
      }

      .close-btn {
        color: white;
        margin-right: -8px;
      }
    }

    mat-dialog-content {
      padding: 2rem 1.5rem !important;
      max-height: 70vh;

      .intro-text {
        font-size: 1.05rem;
        line-height: 1.6;
        color: rgba(0, 0, 0, 0.87);
        margin-bottom: 2rem;
        text-align: center;

        strong {
          color: #4CAF50;
          font-weight: 600;
        }
      }

      .steps-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .step-card {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 12px;
        border-left: 4px solid #4CAF50;
        transition: all 0.3s ease;

        &:hover {
          background: #e8f5e9;
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
        }

        .step-number {
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.1rem;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(76, 175, 80, 0.3);
        }

        .step-content {
          flex: 1;

          h3 {
            margin: 0 0 0.5rem 0;
            font-size: 1.1rem;
            font-weight: 500;
            color: rgba(0, 0, 0, 0.87);
            display: flex;
            align-items: center;
            gap: 0.5rem;

            mat-icon {
              color: #4CAF50;
              font-size: 20px;
              width: 20px;
              height: 20px;
            }
          }

          p {
            margin: 0;
            color: rgba(0, 0, 0, 0.6);
            font-size: 0.95rem;
            line-height: 1.5;
          }
        }
      }

      .tips-section {
        background: #fff3e0;
        border-radius: 12px;
        padding: 1.5rem;
        border: 2px solid #ffb74d;

        .tip-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;

          mat-icon {
            color: #f57c00;
            font-size: 24px;
            width: 24px;
            height: 24px;
          }

          h3 {
            margin: 0;
            color: #e65100;
            font-size: 1.1rem;
            font-weight: 600;
          }
        }

        .tips-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;

          li {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: rgba(0, 0, 0, 0.87);
            font-size: 0.95rem;

            mat-icon {
              color: #4CAF50;
              font-size: 20px;
              width: 20px;
              height: 20px;
              flex-shrink: 0;
            }
          }
        }
      }
    }

    mat-dialog-actions {
      padding: 1rem 1.5rem;
      margin: 0;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      display: flex;
      justify-content: flex-end;

      button {
        min-width: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          margin: 0 !important;
        }
      }
    }
  `]
})
export class QuickInstructionsDialog { }
