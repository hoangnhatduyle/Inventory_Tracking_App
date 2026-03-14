import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { ReceiptScanService } from '../../services/receipt-scan.service';
import { Category, Location, InventoryItem } from '../../models/inventory.model';
import { toLocalDateString } from '../../utils/date.utils';

interface ReviewItem {
  selected: boolean;
  name: string;
  quantity: number;
  unit: string;
  totalPrice: number | null;
  categoryHint: string;
  categoryId: number;
}

type Step = 'capture' | 'analyzing' | 'review' | 'adding' | 'done';

@Component({
  selector: 'app-receipt-scan',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule
  ],
  template: `
    <div class="receipt-scan-container">

      <!-- Header -->
      <div class="scan-header">
        <button mat-icon-button (click)="onBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Scan Receipt</h1>
        <div class="step-indicator" *ngIf="step === 'review'">
          <span class="step-count">{{ selectedCount }} / {{ reviewItems.length }} selected</span>
        </div>
      </div>

      <!-- Step: Capture -->
      <div *ngIf="step === 'capture'" class="step-capture">
        <div class="capture-illustration">
          <mat-icon>receipt_long</mat-icon>
        </div>
        <h2>Take a photo of your receipt</h2>
        <p class="hint">Make sure the receipt is flat and well-lit for best results.</p>

        <div class="capture-actions">
          <button mat-raised-button color="primary" (click)="capturePhoto('camera')">
            <mat-icon>photo_camera</mat-icon>
            Take Photo
          </button>
          <button mat-stroked-button (click)="capturePhoto('gallery')">
            <mat-icon>photo_library</mat-icon>
            Choose from Gallery
          </button>
        </div>
      </div>

      <!-- Step: Analyzing -->
      <div *ngIf="step === 'analyzing'" class="step-analyzing">
        <mat-spinner diameter="64"></mat-spinner>
        <h2>Reading receipt...</h2>
        <p class="hint">AI is parsing your items. This usually takes 5–15 seconds.</p>
      </div>

      <!-- Step: Review -->
      <div *ngIf="step === 'review'" class="step-review">
        <div class="review-toolbar">
          <button mat-button (click)="selectAll()" *ngIf="selectedCount < reviewItems.length">
            <mat-icon>select_all</mat-icon> Select All
          </button>
          <button mat-button (click)="deselectAll()" *ngIf="selectedCount === reviewItems.length">
            <mat-icon>deselect</mat-icon> Deselect All
          </button>
          <span class="spacer"></span>
          <button mat-raised-button color="primary" [disabled]="selectedCount === 0" (click)="addItems()">
            <mat-icon>add_shopping_cart</mat-icon>
            Add {{ selectedCount }} Item{{ selectedCount !== 1 ? 's' : '' }}
          </button>
        </div>

        <div class="review-list">
          <div *ngFor="let item of reviewItems; let i = index" class="review-item" [class.deselected]="!item.selected">
            <mat-checkbox [(ngModel)]="item.selected" class="item-checkbox"></mat-checkbox>

            <div class="item-fields">
              <mat-form-field appearance="outline" class="field-name">
                <mat-label>Item Name</mat-label>
                <input matInput [(ngModel)]="item.name">
              </mat-form-field>

              <div class="item-row">
                <mat-form-field appearance="outline" class="field-qty">
                  <mat-label>Qty</mat-label>
                  <input matInput type="number" [(ngModel)]="item.quantity" min="1">
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-unit">
                  <mat-label>Unit</mat-label>
                  <mat-select [(ngModel)]="item.unit">
                    <mat-option value="piece">piece</mat-option>
                    <mat-option value="kg">kg</mat-option>
                    <mat-option value="g">g</mat-option>
                    <mat-option value="lbs">lbs</mat-option>
                    <mat-option value="oz">oz</mat-option>
                    <mat-option value="liter">liter</mat-option>
                    <mat-option value="ml">ml</mat-option>
                    <mat-option value="pack">pack</mat-option>
                    <mat-option value="box">box</mat-option>
                    <mat-option value="can">can</mat-option>
                    <mat-option value="bottle">bottle</mat-option>
                    <mat-option value="bag">bag</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-price">
                  <mat-label>Price ($)</mat-label>
                  <input matInput type="number" [(ngModel)]="item.totalPrice" min="0" step="0.01">
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="field-category">
                <mat-label>Category</mat-label>
                <mat-select [(ngModel)]="item.categoryId">
                  <mat-option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        </div>
      </div>

      <!-- Step: Adding -->
      <div *ngIf="step === 'adding'" class="step-adding">
        <mat-spinner diameter="64"></mat-spinner>
        <h2>Adding items...</h2>
        <p class="progress-text">{{ addProgress }} of {{ addTotal }}</p>
      </div>

      <!-- Step: Done -->
      <div *ngIf="step === 'done'" class="step-done">
        <mat-icon class="done-icon">check_circle</mat-icon>
        <h2>All done!</h2>
        <p>Added {{ addedCount }} item{{ addedCount !== 1 ? 's' : '' }} to your inventory.</p>
        <button mat-raised-button color="primary" (click)="onBack()">
          <mat-icon>inventory</mat-icon>
          View Inventory
        </button>
      </div>

    </div>
  `,
  styles: [`
    .receipt-scan-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #fafafa;
    }

    .scan-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: white;
      border-bottom: 1px solid rgba(0,0,0,0.12);
      position: sticky;
      top: 0;
      z-index: 10;

      h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
        flex: 1;
      }

      .step-count {
        font-size: 0.9rem;
        color: rgba(0,0,0,0.6);
      }
    }

    /* Capture step */
    .step-capture {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
      text-align: center;
      gap: 1rem;

      .capture-illustration mat-icon {
        font-size: 96px;
        width: 96px;
        height: 96px;
        color: rgba(0,0,0,0.2);
      }

      h2 { margin: 0; font-weight: 500; }

      .hint {
        margin: 0;
        color: rgba(0,0,0,0.54);
        font-size: 0.9rem;
        max-width: 320px;
      }

      .capture-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 280px;
        margin-top: 1rem;

        button {
          min-height: 48px;
          mat-icon { margin-right: 8px; }
        }
      }
    }

    /* Analyzing / Adding steps */
    .step-analyzing,
    .step-adding {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      text-align: center;

      h2 { margin: 0; font-weight: 500; }

      .hint, .progress-text {
        margin: 0;
        color: rgba(0,0,0,0.54);
        font-size: 0.9rem;
      }
    }

    /* Review step */
    .step-review {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .review-toolbar {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      background: white;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      gap: 8px;

      .spacer { flex: 1; }
    }

    .review-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 16px 80px;
    }

    .review-item {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      transition: opacity 0.2s;

      &.deselected {
        opacity: 0.45;
      }

      .item-checkbox {
        margin-top: 18px;
        flex-shrink: 0;
      }

      .item-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .field-name { width: 100%; }

      .item-row {
        display: flex;
        gap: 8px;

        .field-qty { flex: 1; min-width: 60px; }
        .field-unit { flex: 1.5; }
        .field-price { flex: 1.5; }
      }

      .field-category { width: 100%; }
    }

    /* Done step */
    .step-done {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      text-align: center;
      padding: 2rem;

      .done-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        color: #4caf50;
      }

      h2 { margin: 0; font-weight: 500; }
      p { margin: 0; color: rgba(0,0,0,0.6); }

      button {
        margin-top: 1rem;
        min-height: 48px;
        mat-icon { margin-right: 8px; }
      }
    }

    /* mat-form-field density */
    ::ng-deep .review-item .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  `]
})
export class ReceiptScanComponent implements OnInit {
  step: Step = 'capture';
  reviewItems: ReviewItem[] = [];
  categories: Category[] = [];
  locations: Location[] = [];
  addProgress = 0;
  addTotal = 0;
  addedCount = 0;

  private userId: number | null = null;
  private defaultLocationId: number | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private inventoryService: InventoryService,
    private receiptScanService: ReceiptScanService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.userId = await this.authService.getCurrentUserId();
    this.categories = await this.inventoryService.getCategories();
    if (this.userId) {
      this.locations = await this.inventoryService.getLocations(this.userId);
      this.defaultLocationId = this.locations.length > 0 ? (this.locations[0].id ?? null) : null;
    }
  }

  get selectedCount(): number {
    return this.reviewItems.filter(i => i.selected).length;
  }

  selectAll() {
    this.reviewItems.forEach(i => i.selected = true);
  }

  deselectAll() {
    this.reviewItems.forEach(i => i.selected = false);
  }

  async capturePhoto(source: 'camera' | 'gallery') {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
      });

      if (!photo.base64String) {
        this.showMessage('Could not read photo. Please try again.');
        return;
      }

      const base64 = `data:image/jpeg;base64,${photo.base64String}`;
      this.step = 'analyzing';
      await this.analyzeReceipt(base64);
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('cancel')) return;
      console.error('[ReceiptScan] capturePhoto error:', err);
      this.showMessage('Could not open camera. Please try again.');
    }
  }

  private async analyzeReceipt(base64Image: string) {
    if (!this.userId) {
      this.showMessage('Not logged in.');
      this.step = 'capture';
      return;
    }

    try {
      const items = await this.receiptScanService.parseReceipt(base64Image, this.userId);
      this.reviewItems = items.map(item => ({
        selected: true,
        name: item.name,
        quantity: item.quantity,
        unit: 'piece',
        totalPrice: item.totalPrice,
        categoryHint: item.categoryHint,
        categoryId: this.resolveCategoryId(item.categoryHint)
      }));
      this.step = 'review';
    } catch (err: any) {
      console.error('[ReceiptScan] analyzeReceipt error:', err);
      this.showMessage(err?.message || 'Failed to parse receipt. Please try again.');
      this.step = 'capture';
    }
  }

  private resolveCategoryId(hint: string): number {
    const match = this.categories.find(c => c.name.toLowerCase() === hint.toLowerCase());
    if (match?.id) return match.id;
    const other = this.categories.find(c => c.name.toLowerCase() === 'other');
    return other?.id ?? (this.categories[0]?.id ?? 1);
  }

  async addItems() {
    const selected = this.reviewItems.filter(i => i.selected);
    if (selected.length === 0) return;

    this.addTotal = selected.length;
    this.addProgress = 0;
    this.step = 'adding';

    const today = toLocalDateString(new Date());
    let addedCount = 0;

    for (const item of selected) {
      const expiryDays = this.receiptScanService.getDefaultExpiryDays(item.categoryHint);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      const inventoryItem: InventoryItem = {
        userId: this.userId!,
        name: item.name,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unit: item.unit,
        purchaseDate: today,
        expirationDate: toLocalDateString(expiryDate),
        locationId: this.defaultLocationId ?? 1,
        price: item.totalPrice ?? undefined,
        notificationEnabled: true,
        notificationDaysBefore: 3
      };

      const result = await this.inventoryService.addItem(inventoryItem);
      if (result.success) addedCount++;
      this.addProgress++;
    }

    this.addedCount = addedCount;
    this.step = 'done';
  }

  onBack() {
    this.router.navigate(['/inventory']);
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', { duration: 4000, verticalPosition: 'top' });
  }
}
