import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';
import { BarcodeService } from '../../services/barcode.service';
import { NotificationService } from '../../services/notification.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ImageService } from '../../services/image.service';
import { InventoryItem, Category, Location } from '../../models/inventory.model';
import { UpdateUsageDialog } from '../update-usage-dialog/update-usage-dialog';
import { RefillDialogComponent } from './refill-dialog.component';
import { ViewBatchesDialogComponent } from './view-batches-dialog.component';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatBadgeModule,
    MatTableModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule
  ],
  templateUrl: './inventory-list.html',
  styleUrl: './inventory-list.scss',
})
export class InventoryList implements OnInit, OnDestroy {
  userId: number | null = null;
  items: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  categories: Category[] = [];
  locations: Location[] = [];
  itemImages: Map<number, string> = new Map(); // Store item images by item ID

  // Search and filter
  searchQuery = '';
  selectedCategory: number | null = null;
  selectedLocation: number | null = null;
  selectedStatus: string = 'all'; // all, expiring-soon, expired, fresh
  isScanning = false;

  // View options
  viewMode: 'card' | 'table' = 'card';
  groupBy: 'none' | 'category' | 'location' = 'none';
  sortBy: 'expiration' | 'name' | 'quantity' | 'recent' = 'expiration';

  // Batch selection
  selectedItems: Set<number> = new Set();
  selectMode = false;

  // Table columns
  displayedColumns: string[] = ['select', 'image', 'name', 'category', 'quantity', 'location', 'expiration', 'status', 'actions'];

  // Pagination
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  pageSize = 20;
  pageIndex = 0;

  get pagedItems(): InventoryItem[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  // Loading state
  isLoading = false;

  // Event handler reference for cleanup
  private resizeHandler = () => this.updateViewMode();

  // Filter persistence
  private readonly FILTER_KEY = 'inventory_filter_state';

  private saveFilterState() {
    const state = {
      searchQuery: this.searchQuery,
      selectedCategory: this.selectedCategory,
      selectedLocation: this.selectedLocation,
      selectedStatus: this.selectedStatus,
      sortBy: this.sortBy,
      groupBy: this.groupBy,
      viewMode: this.viewMode,
    };
    localStorage.setItem(this.FILTER_KEY, JSON.stringify(state));
  }

  private restoreFilterState() {
    const saved = localStorage.getItem(this.FILTER_KEY);
    if (!saved) return;
    try {
      const state = JSON.parse(saved);
      this.searchQuery = state.searchQuery ?? '';
      this.selectedCategory = state.selectedCategory ?? null;
      this.selectedLocation = state.selectedLocation ?? null;
      this.selectedStatus = state.selectedStatus ?? 'all';
      this.sortBy = state.sortBy ?? 'expiration';
      this.groupBy = state.groupBy ?? 'none';
      this.viewMode = state.viewMode ?? 'card';
    } catch {
      // Ignore corrupt data
    }
  }

  constructor(
    private inventoryService: InventoryService,
    private authService: AuthService,
    private barcodeService: BarcodeService,
    private notificationService: NotificationService,
    private errorHandler: ErrorHandlerService,
    private imageService: ImageService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  getItemImage(itemId: number | undefined): string {
    if (!itemId) return '';
    return this.itemImages.get(itemId) || '';
  }

  async ngOnInit() {
    this.userId = await this.authService.getUserId();
    this.restoreFilterState();
    await this.loadData();

    // Set view mode based on screen size
    this.updateViewMode();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    // Clean up event listener to prevent memory leak
    window.removeEventListener('resize', this.resizeHandler);
  }

  async loadData() {
    if (!this.userId) return;

    this.isLoading = true;
    try {
      this.items = await this.inventoryService.getItems(this.userId);
      this.categories = await this.inventoryService.getCategories();
      this.locations = await this.inventoryService.getLocations(this.userId);
      
      // Load images for all items
      await this.loadItemImages();
      
      this.applyFilters();
    } catch (error) {
      this.errorHandler.handleDataError('load inventory', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadItemImages() {
    // Load images for all items in parallel
    const imagePromises = this.items.map(async (item) => {
      if (item.id) {
        try {
          const images = await this.inventoryService.getItemImages(item.id);
          if (images.length > 0 && images[0].imagePath) {
            // Convert file path to base64 data URI for display
            const imageUrl = await this.imageService.getImageUrl(images[0].imagePath);
            if (imageUrl) {
              this.itemImages.set(item.id, imageUrl);
            }
          }
        } catch (error) {
          // Silently fail for individual images
          console.warn(`Failed to load image for item ${item.id}:`, error);
        }
      }
    });
    
    await Promise.all(imagePromises);
  }

  updateViewMode() {
    this.viewMode = window.innerWidth >= 1024 ? 'table' : 'card';
  }

  applyFilters() {
    let filtered = [...this.items];

    // Search filter (includes barcode search)
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(item => item.categoryId === this.selectedCategory);
    }

    // Location filter
    if (this.selectedLocation) {
      filtered = filtered.filter(item => item.locationId === this.selectedLocation);
    }

    // Status filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (this.selectedStatus === 'expired') {
      filtered = filtered.filter(item => {
        if (!item.expirationDate) return false;
        const expDate = new Date(item.expirationDate);
        return expDate < today;
      });
    } else if (this.selectedStatus === 'expiring-soon') {
      filtered = filtered.filter(item => {
        if (!item.expirationDate) return false;
        const expDate = new Date(item.expirationDate);
        return expDate >= today && expDate <= threeDaysFromNow;
      });
    } else if (this.selectedStatus === 'fresh') {
      filtered = filtered.filter(item => {
        if (!item.expirationDate) return true;
        const expDate = new Date(item.expirationDate);
        return expDate > threeDaysFromNow;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'expiration':
          if (!a.expirationDate && !b.expirationDate) return 0;
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'quantity':
          return a.quantity - b.quantity;
        case 'recent':
          return (b.id || 0) - (a.id || 0);
        default:
          return 0;
      }
    });

    this.filteredItems = filtered;
    this.pageIndex = 0;
    if (this.paginator) this.paginator.firstPage();
    this.saveFilterState();
  }

  /** Parse date string (YYYY-MM-DD) as local date to avoid timezone issues */
  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  getItemStatus(item: InventoryItem): 'expired' | 'expiring-soon' | 'fresh' {
    if (!item.expirationDate) return 'fresh';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = this.parseLocalDate(item.expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (expDate < today) return 'expired';
    if (expDate <= threeDaysFromNow) return 'expiring-soon';
    return 'fresh';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'expired': return 'warn';
      case 'expiring-soon': return 'accent';
      default: return 'primary';
    }
  }

  hasUsageTracking(item: InventoryItem): boolean {
    return item.initialQuantity !== undefined && 
           item.initialQuantity !== null && 
           item.currentQuantity !== undefined && 
           item.currentQuantity !== null;
  }

  getUsagePercentage(item: InventoryItem): number {
    if (!this.hasUsageTracking(item) || item.initialQuantity === 0) {
      return 100;
    }
    return (item.currentQuantity! / item.initialQuantity!) * 100;
  }

  getUsageProgressColor(item: InventoryItem): 'primary' | 'accent' | 'warn' {
    const percentage = this.getUsagePercentage(item);
    if (percentage > 50) return 'primary'; // Green
    if (percentage > 20) return 'accent';  // Orange
    return 'warn'; // Red
  }

  getCategoryName(categoryId: number): string {
    return this.categories.find(c => c.id === categoryId)?.name || 'Unknown';
  }

  getLocationName(locationId: number): string {
    const location = this.locations.find(l => l.id === locationId);
    return location ? `${location.name}${location.subLocation ? ' - ' + location.subLocation : ''}` : 'Unknown';
  }

  getDaysUntilExpiration(item: InventoryItem): number | null {
    if (!item.expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = this.parseLocalDate(item.expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getGroupedItems(): { [key: string]: InventoryItem[] } {
    if (this.groupBy === 'none') {
      return { 'all': this.pagedItems };
    }

    const grouped: { [key: string]: InventoryItem[] } = {};

    this.pagedItems.forEach(item => {
      let key: string;
      if (this.groupBy === 'category') {
        key = this.getCategoryName(item.categoryId);
      } else {
        key = this.getLocationName(item.locationId);
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    return grouped;
  }

  onSearch() {
    this.applyFilters();
  }

  async onScanBarcodeSearch() {
    this.isScanning = true;

    try {
      const scannedBarcode = await this.barcodeService.scanBarcode();
      
      if (scannedBarcode) {
        this.searchQuery = scannedBarcode;
        this.applyFilters();
        
        if (this.filteredItems.length === 0) {
          this.errorHandler.showWarning('No items found with this barcode');
        } else {
          this.errorHandler.showSuccess(`✓ Found ${this.filteredItems.length} item(s)`);
        }
      } else {
        this.errorHandler.showWarning('No barcode detected');
      }
    } catch (error) {
      this.errorHandler.handleDataError('scan barcode', error);
    } finally {
      this.isScanning = false;
    }
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = null;
    this.selectedLocation = null;
    this.selectedStatus = 'all';
    this.applyFilters();
  }

  toggleSelectMode() {
    this.selectMode = !this.selectMode;
    if (!this.selectMode) {
      this.selectedItems.clear();
    }
  }

  toggleItemSelection(itemId: number | undefined) {
    if (!itemId) return;
    
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }
  }

  selectAll() {
    this.filteredItems.forEach(item => {
      if (item.id) this.selectedItems.add(item.id);
    });
  }

  deselectAll() {
    this.selectedItems.clear();
  }

  async deleteSelected() {
    if (this.selectedItems.size === 0) return;

    const confirmed = confirm(`Delete ${this.selectedItems.size} item(s)?`);
    if (!confirmed) return;

    try {
      for (const itemId of this.selectedItems) {
        await this.inventoryService.deleteItem(itemId);
      }

      this.errorHandler.showSuccess(`✓ ${this.selectedItems.size} item(s) deleted successfully`);
      this.selectedItems.clear();
      this.selectMode = false;
      await this.loadData();
    } catch (error) {
      this.errorHandler.handleDataError('delete items', error);
      // Reset select mode on failure so user can retry
      this.selectedItems.clear();
      this.selectMode = false;
    }
  }

  onAddItem() {
    this.router.navigate(['/item/add']);
  }

  onScanReceipt() {
    this.router.navigate(['/receipt-scan']);
  }

  onEditItem(item: InventoryItem) {
    this.router.navigate(['/item/edit', item.id]);
  }

  async onDeleteItem(item: InventoryItem) {
    const confirmed = confirm(`Delete "${item.name}"?`);
    if (!confirmed) return;

    try {
      await this.inventoryService.deleteItem(item.id!);
      this.errorHandler.showSuccess('✓ Item deleted successfully');
      await this.loadData();
    } catch (error) {
      this.errorHandler.handleDataError('delete item', error);
    }
  }

  onUpdateUsage(item: InventoryItem) {
    const dialogRef = this.dialog.open(UpdateUsageDialog, {
      width: '500px',
      maxWidth: '95vw',
      data: { item }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          // Check if item is now empty (quantity is 0 or marked as empty)
          if (result.markedAsEmpty || result.remainingAmount === 0) {
            // Show confirmation dialog with Refill or Remove options
            const confirmDialog = this.dialog.open(EmptyItemConfirmationDialog, {
              width: '400px',
              maxWidth: '95vw',
              data: { itemName: item.name }
            });

            confirmDialog.afterClosed().subscribe(async (action: 'refill' | 'remove' | null) => {
              if (action === 'refill') {
                // Open refill dialog
                await this.onRefillItem(item);
              } else if (action === 'remove') {
                // Delete the item and all related data
                try {
                  await this.inventoryService.deleteItem(item.id!);
                  this.errorHandler.showSuccess('✓ Item removed successfully');
                  await this.loadData();
                } catch (error) {
                  this.errorHandler.handleDataError('remove item', error);
                }
              }
            });
            return;
          }

          // Normal usage update (not empty)
          // Use FIFO batch deduction if batches exist
          const batches = await this.inventoryService.getBatches(item.id!);
          
          if (batches && batches.length > 0) {
            // Deduct from batches using FIFO
            const success = await this.inventoryService.deductFromBatchesFIFO(
              item.id!,
              result.amountUsed
            );

            if (success) {
              // Update main item quantity to match total from batches
              const newTotalQuantity = await this.inventoryService.getTotalBatchQuantity(item.id!);
              const earliestExpiration = await this.inventoryService.getEarliestBatchExpiration(item.id!);
              
              await this.inventoryService.updateItemUsage(
                item.id!,
                newTotalQuantity,
                result.amountUsed,
                result.notes
              );

              // Update expiration date to earliest batch
              if (earliestExpiration) {
                await this.inventoryService.updateItem({
                  ...item,
                  quantity: newTotalQuantity,
                  currentQuantity: newTotalQuantity,
                  expirationDate: earliestExpiration
                });
              }
            } else {
              this.errorHandler.showWarning('Not enough stock to deduct that amount');
              return;
            }
          } else {
            // No batches - use legacy tracking
            await this.inventoryService.updateItemUsage(
              item.id!,
              result.remainingAmount,
              result.amountUsed,
              result.notes
            );
          }
          
          // Check for low stock and notify
          if (item.initialQuantity && item.initialQuantity > 0) {
            const percentage = (result.remainingAmount / item.initialQuantity) * 100;
            if (percentage <= 20 && percentage > 0) {
              await this.notificationService.checkAndNotifyLowStock(
                item.id!,
                item.name,
                percentage
              );
            }
          }
          
          this.errorHandler.showSuccess('✓ Usage updated successfully (FIFO)');
          await this.loadData();
        } catch (error) {
          this.errorHandler.handleDataError('update usage', error);
        }
      }
    });
  }

  async onMarkAsWasted(item: InventoryItem) {
    try {
      const remainingQty = item.currentQuantity != null ? item.currentQuantity : item.quantity;
      if (!remainingQty || remainingQty <= 0) {
        this.errorHandler.showWarning('Nothing left to mark as wasted');
        return;
      }
      const pricePerUnit = item.price || 0;
      const valueLost = (pricePerUnit * remainingQty).toFixed(2);

      const confirmed = confirm(`Mark ${remainingQty} ${item.unit} of "${item.name}" as wasted?\nValue lost: $${valueLost}`);
      if (!confirmed) return;

      const success = await this.inventoryService.markAsWasted(item.id!);
      // markAsWasted already removes the item, but keep the reload for completeness
      await this.loadData();
      if (success) {
        this.errorHandler.showSuccess('✓ Item marked as wasted');
      } else {
        this.errorHandler.showWarning('Item removed but could not be logged in Waste Tracking');
      }
    } catch (error) {
      this.errorHandler.handleDataError('mark item as wasted', error);
    }
  }

  async onRefillItem(item: InventoryItem) {
    if (!this.userId || !item.id) return;

    // Get current total quantity from batches
    const currentQuantity = await this.inventoryService.getTotalBatchQuantity(item.id);

    const dialogRef = this.dialog.open(RefillDialogComponent, {
      width: '90%',
      maxWidth: '500px',
      data: {
        item,
        currentQuantity,
        userId: this.userId
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          if (result.mode === 'replace') {
            // Delete all existing batches
            await this.inventoryService.deleteBatchesByItem(item.id!);
          }

          // Add new batch
          await this.inventoryService.addBatch({
            itemId: item.id,
            quantity: result.quantity,
            expirationDate: result.expirationDate,
            purchaseDate: result.purchaseDate,
            price: result.price,
            notes: result.notes
          });

          // Update main item's expiration date to earliest batch expiration
          const earliestExpiration = await this.inventoryService.getEarliestBatchExpiration(item.id!);
          const totalQuantity = await this.inventoryService.getTotalBatchQuantity(item.id!);

          // Update item with new totals
          await this.inventoryService.updateItem({
            ...item,
            quantity: totalQuantity,
            expirationDate: earliestExpiration || item.expirationDate,
            purchaseDate: result.purchaseDate,
            price: result.price || item.price
          });

          this.errorHandler.showSuccess(`✓ Refilled ${item.name}`);
          await this.loadData();
        } catch (error) {
          this.errorHandler.handleDataError('refill item', error);
        }
      }
    });
  }

  async onViewBatches(item: InventoryItem) {
    if (!item.id) return;

    try {
      const batches = await this.inventoryService.getBatches(item.id);
      
      this.dialog.open(ViewBatchesDialogComponent, {
        width: '90%',
        maxWidth: '600px',
        data: {
          item,
          batches
        }
      });
    } catch (error) {
      this.errorHandler.handleDataError('load batches', error);
    }
  }

  get expiredCount(): number {
    return this.items.filter(item => this.getItemStatus(item) === 'expired').length;
  }

  get expiringSoonCount(): number {
    return this.items.filter(item => this.getItemStatus(item) === 'expiring-soon').length;
  }

  viewImage(item: InventoryItem) {
    const imageUrl = this.getItemImage(item.id);
    if (!imageUrl) return;

    const dialogRef = this.dialog.open(ImagePreviewDialog, {
      data: {
        imageUrl: imageUrl,
        itemName: item.name
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'image-preview-dialog'
    });
  }
}

// Image Preview Dialog Component
@Component({
  selector: 'image-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="image-preview-container">
      <div class="preview-header">
        <h2 mat-dialog-title>{{ data.itemName }}</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <mat-dialog-content>
        <img [src]="data.imageUrl" [alt]="data.itemName">
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    .image-preview-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
      }
    }

    mat-dialog-content {
      padding: 0 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #000;

      img {
        max-width: 100%;
        max-height: calc(90vh - 80px);
        object-fit: contain;
      }
    }
  `]
})
export class ImagePreviewDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { imageUrl: string; itemName: string }) {}
}

// Empty Item Confirmation Dialog Component
@Component({
  selector: 'empty-item-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="empty-item-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>inventory_2</mat-icon>
          Item Empty
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <mat-dialog-content>
        <p><strong>{{ data.itemName }}</strong> is now out of stock.</p>
        <p>What would you like to do?</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button color="warn" [mat-dialog-close]="'remove'">
          <mat-icon>delete</mat-icon>
          Remove Item
        </button>
        <button mat-raised-button color="primary" [mat-dialog-close]="'refill'">
          <mat-icon>add_shopping_cart</mat-icon>
          Refill Stock
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .empty-item-dialog {
      padding: 1rem;
      
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        
        h2 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          padding-left: 0;
          
          mat-icon {
            color: var(--mat-warn-color);
          }
        }
        
        button {
          margin: -0.5rem -0.5rem 0 0;
        }
      }
      
      mat-dialog-content {
        padding: 1rem 0;
        
        p {
          margin: 0.5rem 0;
          
          &:first-child {
            font-size: 1rem;
          }
          
          strong {
            color: var(--mat-primary-color);
          }
        }
      }
      
      mat-dialog-actions {
        gap: 0.5rem;
        padding: 1.5rem 0 0;
        
        button {
          mat-icon {
            margin-right: 0.25rem;
            font-size: 1.25rem;
            width: 1.25rem;
            height: 1.25rem;
            vertical-align: middle;
          }
        }
      }
    }
  `]
})
export class EmptyItemConfirmationDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { itemName: string }) {}
}
