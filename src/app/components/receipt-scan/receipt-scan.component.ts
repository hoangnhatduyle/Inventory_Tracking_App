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
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { ReceiptScanService } from '../../services/receipt-scan.service';
import { ExpirationAIService } from '../../services/expiration-ai.service';
import { ImageService } from '../../services/image.service';
import { Category, Location, InventoryItem } from '../../models/inventory.model';
import { toLocalDateString } from '../../utils/date.utils';
import { CategorySelectorComponent } from '../item-form/category-selector.component';
import { LocationSelectorComponent } from '../item-form/location-selector.component';
import { AISuggestionDialogComponent, AISuggestionDialogData } from '../item-form/ai-suggestion-dialog.component';

interface ReviewItem {
  included: boolean;          // includes item in final add
  name: string;
  quantity: number;
  unit: string;
  totalPrice: number | null;
  categoryHint: string;
  categoryId: number;
  // Matches manual add form fields
  locationId: number;
  purchaseDate: string;       // YYYY-MM-DD
  expirationDate: string;     // YYYY-MM-DD
  expireAmount: number;       // e.g., 7
  expireUnit: 'days' | 'weeks' | 'months' | 'years';
  notes: string;
  notificationEnabled: boolean;
}

type Step = 'capture' | 'analyzing' | 'item-wizard' | 'adding' | 'done';

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
    MatDividerModule,
    MatBottomSheetModule,
    MatDialogModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="receipt-scan-container">

      <!-- Header -->
      <div class="scan-header">
        <button mat-icon-button (click)="step === 'item-wizard' ? goBack() : onBack()" [disabled]="step === 'item-wizard' && isFirstItem">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Scan Receipt</h1>
        <div class="step-indicator" *ngIf="step === 'item-wizard'">
          <span class="step-count">Item {{ currentItemIndex + 1 }} / {{ reviewItems.length }}</span>
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

      <!-- Step: Item Wizard -->
      <div *ngIf="step === 'item-wizard'" class="step-item-wizard">
        <!-- Progress bar -->
        <mat-progress-bar mode="determinate" [value]="(currentItemIndex + 1) / reviewItems.length * 100" class="wizard-progress"></mat-progress-bar>

        <!-- Item card -->
        <div class="wizard-card">
          <div class="wizard-item-header">
            <span class="item-progress">Item {{ currentItemIndex + 1 }} of {{ reviewItems.length }}</span>
            <button mat-icon-button (click)="skipItem()" class="skip-btn">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Basic Information Section -->
          <div class="wizard-section">
            <h3 class="wizard-section-title">
              <mat-icon>info</mat-icon>
              Basic Information
            </h3>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Item Name</mat-label>
              <input matInput [(ngModel)]="currentItem.name" required>
            </mat-form-field>

            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Quantity</mat-label>
                <input matInput type="number" [(ngModel)]="currentItem.quantity" min="1">
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>Unit</mat-label>
                <mat-select [(ngModel)]="currentItem.unit">
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
            </div>
          </div>

          <!-- Storage & Price Section -->
          <div class="wizard-section">
            <h3 class="wizard-section-title">
              <mat-icon>location_on</mat-icon>
              Storage & Price
            </h3>

            <div class="selector-field" (click)="openLocationSelector(currentItem)">
              <div class="selector-label">
                <mat-icon>kitchen</mat-icon>
                <span>Storage Location</span>
              </div>
              <div class="selector-value">
                <span *ngIf="getLocationName(currentItem.locationId)">{{ getLocationName(currentItem.locationId) }}</span>
                <mat-icon>chevron_right</mat-icon>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Total Price ($)</mat-label>
              <input matInput type="number" [(ngModel)]="currentItem.totalPrice" min="0" step="0.01" placeholder="Total for this quantity">
            </mat-form-field>
          </div>

          <!-- Category Section -->
          <div class="wizard-section">
            <h3 class="wizard-section-title">
              <mat-icon>category</mat-icon>
              Category
            </h3>

            <div class="selector-field" (click)="openCategorySelector(currentItem)">
              <div class="selector-label">
                <mat-icon>label</mat-icon>
                <span>Category</span>
              </div>
              <div class="selector-value">
                <span *ngIf="categories[currentItem.categoryId - 1]">{{ categories[currentItem.categoryId - 1].name }}</span>
                <mat-icon>chevron_right</mat-icon>
              </div>
            </div>
          </div>

          <!-- Dates Section -->
          <div class="wizard-section">
            <h3 class="wizard-section-title">
              <mat-icon>event</mat-icon>
              Dates
            </h3>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Purchase Date</mat-label>
              <input matInput [matDatepicker]="purchasePicker" [(ngModel)]="currentItem.purchaseDate" readonly>
              <mat-datepicker-toggle matSuffix [for]="purchasePicker"></mat-datepicker-toggle>
              <mat-datepicker #purchasePicker></mat-datepicker>
            </mat-form-field>

            <div class="expiry-controls">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Expires in</mat-label>
                <input matInput type="number" [(ngModel)]="currentItem.expireAmount" min="0">
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Unit</mat-label>
                <mat-select [(ngModel)]="currentItem.expireUnit">
                  <mat-option value="days">Days</mat-option>
                  <mat-option value="weeks">Weeks</mat-option>
                  <mat-option value="months">Months</mat-option>
                  <mat-option value="years">Years</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-button (click)="onAISuggest(currentItem)" [disabled]="isLoadingAI" color="accent" class="ai-btn">
                <mat-icon>{{ isLoadingAI ? 'hourglass_empty' : 'lightbulb' }}</mat-icon>
                {{ isLoadingAI ? 'Suggesting...' : 'AI' }}
              </button>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Expiration Date</mat-label>
              <input matInput [matDatepicker]="expiryPicker" [(ngModel)]="currentItem.expirationDate" readonly>
              <mat-datepicker-toggle matSuffix [for]="expiryPicker"></mat-datepicker-toggle>
              <mat-datepicker #expiryPicker></mat-datepicker>
            </mat-form-field>
          </div>

          <!-- Notes Section -->
          <div class="wizard-section">
            <h3 class="wizard-section-title">
              <mat-icon>notes</mat-icon>
              Notes
            </h3>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes (Optional)</mat-label>
              <textarea matInput [(ngModel)]="currentItem.notes" rows="2"></textarea>
            </mat-form-field>

            <div class="notification-toggle">
              <div class="toggle-info">
                <mat-icon>notifications</mat-icon>
                <span>Enable Notifications</span>
              </div>
              <mat-slide-toggle [(ngModel)]="currentItem.notificationEnabled" color="primary"></mat-slide-toggle>
            </div>
          </div>
        </div>

        <!-- Bottom navigation (fixed) -->
        <div class="wizard-nav">
          <button mat-button (click)="goBack()" [disabled]="isFirstItem">
            <mat-icon>arrow_back</mat-icon>
            Back
          </button>
          <button mat-button (click)="skipItem()">
            <mat-icon>skip_next</mat-icon>
            Skip
          </button>
          <span class="spacer"></span>
          <button mat-raised-button color="primary" (click)="goNext()">
            {{ isLastItem ? 'Add All (' + includedCount + ')' : 'Next' }}
            <mat-icon>{{ isLastItem ? 'check' : 'arrow_forward' }}</mat-icon>
          </button>
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

    /* Item Wizard step */
    .step-item-wizard {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #f5f5f5;
    }

    .wizard-progress {
      position: sticky;
      top: 0;
      z-index: 5;
      width: 100%;
    }

    .wizard-card {
      flex: 1;
      overflow-y: auto;
      margin: 12px 16px 88px 16px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);

      .wizard-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;

        .item-progress {
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(0,0,0,0.87);
        }

        .skip-btn {
          color: rgba(0,0,0,0.6);
        }
      }
    }

    .wizard-section {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }

      .wizard-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--primary-color);
        font-size: 1rem;
        font-weight: 500;
        margin: 0 0 16px 0;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .full-width {
        width: 100%;
      }

      .form-row {
        display: flex;
        gap: 12px;

        .flex-1 { flex: 1; }
        .flex-2 { flex: 2; }
      }

      .selector-field {
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border: 1px solid rgba(0,0,0,0.12);
        border-radius: 4px;
        margin-bottom: 12px;
        transition: background 0.2s ease;

        &:hover {
          background: rgba(0,0,0,0.02);
        }

        .selector-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(0,0,0,0.87);

          mat-icon {
            color: var(--primary-color);
          }
        }

        .selector-value {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary-color);
          font-weight: 500;
        }
      }

      .expiry-controls {
        display: flex;
        gap: 12px;
        align-items: flex-end;
        margin-bottom: 12px;

        .flex-1 { flex: 1; }

        .ai-btn {
          margin-bottom: 8px;
          min-width: 60px;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            margin-right: 4px;
          }
        }
      }

      .notification-toggle {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-top: 1px solid rgba(0,0,0,0.08);

        .toggle-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(0,0,0,0.87);

          mat-icon {
            color: var(--primary-color);
          }
        }
      }
    }

    /* Bottom navigation (fixed) */
    .wizard-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
      background: white;
      border-top: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
      z-index: 10;

      button {
        flex: 1;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .spacer {
        flex: 1;
      }
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

  // Wizard navigation state
  currentItemIndex = 0;
  isLoadingAI = false;

  private userId: number | null = null;
  private defaultLocationId: number | null = null;

  // Wizard convenience getters
  get currentItem(): ReviewItem {
    return this.reviewItems[this.currentItemIndex];
  }
  get isFirstItem(): boolean {
    return this.currentItemIndex === 0;
  }
  get isLastItem(): boolean {
    return this.currentItemIndex === this.reviewItems.length - 1;
  }
  get includedCount(): number {
    return this.reviewItems.filter(i => i.included).length;
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private inventoryService: InventoryService,
    private receiptScanService: ReceiptScanService,
    private snackBar: MatSnackBar,
    private bottomSheet: MatBottomSheet,
    private matDialog: MatDialog,
    private expirationAIService: ExpirationAIService,
    private imageService: ImageService
  ) {}

  async ngOnInit() {
    this.userId = await this.authService.getCurrentUserId();
    this.categories = await this.inventoryService.getCategories();
    if (this.userId) {
      this.locations = await this.inventoryService.getLocations(this.userId);
      this.defaultLocationId = this.locations.length > 0 ? (this.locations[0].id ?? null) : null;
    }
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

      // Detect MIME type from photo format
      const format = photo.format || 'jpeg'; // Default to jpeg if format not available
      const mimeType = this.imageService.getMimeTypeFromPath(`photo.${format}`);
      const base64 = `data:${mimeType};base64,${photo.base64String}`;
      this.step = 'analyzing';
      await this.analyzeReceipt(base64);
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('cancel')) return;
      console.error('[ReceiptScan] capturePhoto error:', err);
      this.showMessage('Could not open camera. Please try again.');
    }
  }

  getLocationName(locationId: number): string | undefined {
    return this.locations.find(l => l.id === locationId)?.name;
  }

  private async analyzeReceipt(base64Image: string) {
    if (!this.userId) {
      this.showMessage('Not logged in.');
      this.step = 'capture';
      return;
    }

    try {
      const items = await this.receiptScanService.parseReceipt(base64Image, this.userId);
      const today = toLocalDateString(new Date());

      this.reviewItems = items.map(item => {
        const categoryId = this.resolveCategoryId(item.categoryHint);
        const expiryDays = this.receiptScanService.getDefaultExpiryDays(item.categoryHint);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);

        return {
          included: true,
          name: item.name,
          quantity: item.quantity,
          unit: 'piece',
          totalPrice: item.totalPrice,
          categoryHint: item.categoryHint,
          categoryId,
          // New fields — auto-filled
          locationId: this.defaultLocationId ?? 1,
          purchaseDate: today,
          expirationDate: toLocalDateString(expiryDate),
          expireAmount: expiryDays,
          expireUnit: 'days' as const,
          notes: '',
          notificationEnabled: true
        };
      });

      this.currentItemIndex = 0;
      this.step = 'item-wizard';
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

  // Wizard navigation methods
  goBack() {
    if (!this.isFirstItem) {
      this.currentItemIndex--;
    }
  }

  goNext() {
    if (this.isLastItem) {
      this.addItems();
    } else {
      this.currentItemIndex++;
    }
  }

  skipItem() {
    this.currentItem.included = false;
    this.goNext();
  }

  // Open category selector bottom sheet
  openCategorySelector(item: ReviewItem) {
    const ref = this.bottomSheet.open(CategorySelectorComponent, {
      panelClass: 'centered-bottom-sheet'
    });
    ref.afterDismissed().subscribe((category: Category) => {
      if (category) {
        item.categoryId = category.id!;
        item.categoryHint = category.name;
      }
    });
  }

  // Open location selector bottom sheet
  openLocationSelector(item: ReviewItem) {
    const ref = this.bottomSheet.open(LocationSelectorComponent, {
      data: { userId: this.userId },
      panelClass: 'centered-bottom-sheet'
    });
    ref.afterDismissed().subscribe((location: Location) => {
      if (location) {
        item.locationId = location.id!;
      }
    });
  }

  // AI expiration suggestion
  async onAISuggest(item: ReviewItem) {
    if (!this.userId) return;
    this.isLoadingAI = true;
    try {
      const location = this.locations.find(l => l.id === item.locationId);
      const purchaseDate = new Date(item.purchaseDate);

      const result = await this.expirationAIService.suggestExpiration(
        item.name,
        purchaseDate,
        location?.name || null,
        this.userId
      );

      if (!result.days || result.days <= 0) {
        this.showMessage('AI could not suggest an expiration date. Please set it manually.');
        return;
      }

      // Calculate expiry date
      const expiryDate = new Date(purchaseDate);
      expiryDate.setDate(expiryDate.getDate() + result.days);

      // Open AI suggestion dialog
      const dialogRef = this.matDialog.open(AISuggestionDialogComponent, {
        width: '400px',
        data: {
          itemName: item.name,
          purchaseDate: purchaseDate,
          suggestedDays: result.days,
          suggestedExpirationDate: expiryDate,
          note: result.note || ''
        } as AISuggestionDialogData
      });

      dialogRef.afterClosed().subscribe((dialogResult: any) => {
        if (dialogResult?.accepted) {
          item.expireAmount = result.days;
          item.expireUnit = 'days';
          item.expirationDate = toLocalDateString(expiryDate);
        }
      });
    } catch (error: any) {
      console.error('[ReceiptScan] AI suggestion error:', error);
      this.showMessage(error?.message || 'AI suggestion failed. Please try again.');
    } finally {
      this.isLoadingAI = false;
    }
  }

  async addItems() {
    const included = this.reviewItems.filter(i => i.included);
    if (included.length === 0) return;

    this.addTotal = included.length;
    this.addProgress = 0;
    this.step = 'adding';

    let addedCount = 0;

    for (const item of included) {
      // Calculate unit price from total price and quantity
      // If user entered "2 bottles for $10", unit price is $5
      const unitPrice = (item.totalPrice && item.quantity > 0)
        ? item.totalPrice / item.quantity
        : undefined;

      const inventoryItem: InventoryItem = {
        userId: this.userId!,
        name: item.name,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unit: item.unit,
        purchaseDate: item.purchaseDate,
        expirationDate: item.expirationDate,
        locationId: item.locationId,
        price: unitPrice,
        notes: item.notes || undefined,
        notificationEnabled: item.notificationEnabled,
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
