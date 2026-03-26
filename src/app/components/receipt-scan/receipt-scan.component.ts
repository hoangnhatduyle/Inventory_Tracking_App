import { Component, OnInit, Inject } from '@angular/core';
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
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { ReceiptScanService } from '../../services/receipt-scan.service';
import { ExpirationAIService } from '../../services/expiration-ai.service';
import { ImageService } from '../../services/image.service';
import { Category, Location, InventoryItem } from '../../models/inventory.model';
import { toLocalDateString, parseLocalDate } from '../../utils/date.utils';
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
  purchaseDate: string;           // YYYY-MM-DD — source of truth
  expirationDate: string;         // YYYY-MM-DD — source of truth
  purchaseDateLocal: Date | null;     // stable Date object for matDatepicker [ngModel]
  expirationDateLocal: Date | null;   // stable Date object for matDatepicker [ngModel]
  expireAmount: number;       // e.g., 7
  expireUnit: 'days' | 'weeks' | 'months' | 'years';
  notes: string;
  notificationEnabled: boolean;
}

type Step = 'capture' | 'analyzing' | 'mode-select' | 'item-wizard' | 'adding' | 'done';

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
    MatNativeDateModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="receipt-scan-container">

      <!-- Header -->
      <div class="scan-header">
        <button mat-icon-button (click)="step === 'item-wizard' ? goBack() : onBack()" [disabled]="step === 'item-wizard' && isFirstItem">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Scan Receipt</h1>
        @if (step === 'item-wizard') {
        <div class="step-indicator">
          @if (reviewMode === 'wizard') {
          <span class="step-count">
            Item {{ currentItemIndex + 1 }} / {{ reviewItems.length }}
            @if (!currentItem.included) { <span class="skipped-label"> · Skipped</span> }
          </span>
          }
          @if (reviewMode === 'table') {
          <span class="step-count">
            {{ includedCount }} of {{ reviewItems.length }} items to add
          </span>
          }
          <mat-button-toggle-group [value]="reviewMode" (change)="selectMode($event.value)" class="mode-toggle">
            <mat-button-toggle value="wizard" [matTooltip]="'Item Wizard'">
              <mat-icon>view_carousel</mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="table" [matTooltip]="'Table View'">
              <mat-icon>table_rows</mat-icon>
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>
        }
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

        <mat-form-field appearance="outline" class="full-width receipt-date-field">
          <mat-label>Receipt Date</mat-label>
          <input matInput [matDatepicker]="receiptDatePicker"
            [(ngModel)]="receiptDate"
            [max]="todayDate">
          <mat-datepicker-toggle matSuffix [for]="receiptDatePicker"></mat-datepicker-toggle>
          <mat-datepicker #receiptDatePicker></mat-datepicker>
        </mat-form-field>
      </div>

      <!-- Step: Analyzing -->
      <div *ngIf="step === 'analyzing'" class="step-analyzing">
        <mat-spinner diameter="64"></mat-spinner>
        <h2>Reading receipt...</h2>
        <p class="hint">AI is parsing your items. This usually takes 5–15 seconds.</p>
      </div>

      <!-- Step: Mode Selection -->
      <div *ngIf="step === 'mode-select'" class="step-mode-select">
        <h2>How would you like to review your items?</h2>
        <p class="mode-hint">We found <strong>{{ reviewItems.length }}</strong> item{{ reviewItems.length !== 1 ? 's' : '' }} on your receipt.</p>

        <div class="mode-options">
          <div class="mode-card wizard-mode" (click)="selectMode('wizard')">
            <mat-icon>view_carousel</mat-icon>
            <h3>Item Wizard</h3>
            <p>Step through each item one by one</p>
          </div>

          <div class="mode-card table-mode" (click)="selectMode('table')">
            <mat-icon>table_rows</mat-icon>
            <h3>Table View</h3>
            <p>See and edit all items at once</p>
          </div>
        </div>
      </div>

      <!-- Step: Item Wizard -->
      <div *ngIf="step === 'item-wizard'" class="step-item-wizard">
        <!-- Wizard Mode -->
        @if (reviewMode === 'wizard') {
        <!-- Progress bar -->
        <mat-progress-bar mode="determinate" [value]="(currentItemIndex + 1) / reviewItems.length * 100" class="wizard-progress"></mat-progress-bar>

        <!-- Item card -->
        <div class="wizard-card">
          @if (!currentItem.included) {
          <div class="skipped-banner">
            <mat-icon>do_not_disturb</mat-icon>
            <span>This item is marked as skipped — it won't be added to inventory.</span>
            <button mat-button color="primary" (click)="includeCurrentItem()">Un-skip</button>
          </div>
          }

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
                <span *ngIf="currentItem.categoryHint">{{ currentItem.categoryHint }}</span>
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
              <input matInput [matDatepicker]="purchasePicker"
                     [ngModel]="currentItem.purchaseDateLocal"
                     (dateChange)="onPurchaseDateChange($event, currentItem)"
                     readonly>
              <mat-datepicker-toggle matSuffix [for]="purchasePicker"></mat-datepicker-toggle>
              <mat-datepicker #purchasePicker></mat-datepicker>
            </mat-form-field>

            <div class="expiry-controls">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Expires in</mat-label>
                <input matInput type="number" [(ngModel)]="currentItem.expireAmount"
                       (ngModelChange)="updateExpirationDate(currentItem)" min="0">
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Unit</mat-label>
                <mat-select [(ngModel)]="currentItem.expireUnit"
                            (ngModelChange)="updateExpirationDate(currentItem)">
                  <mat-option value="days">Days</mat-option>
                  <mat-option value="weeks">Weeks</mat-option>
                  <mat-option value="months">Months</mat-option>
                  <mat-option value="years">Years</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-button (click)="onAISuggest(currentItem)" [disabled]="isLoadingAI || !currentItem.name.trim()" color="accent" class="ai-btn">
                <mat-icon>{{ isLoadingAI ? 'hourglass_empty' : 'lightbulb' }}</mat-icon>
                {{ isLoadingAI ? 'Suggesting...' : 'AI' }}
              </button>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Expiration Date</mat-label>
              <input matInput [matDatepicker]="expiryPicker"
                     [ngModel]="currentItem.expirationDateLocal"
                     (dateChange)="onExpiryDateChange($event, currentItem)"
                     readonly>
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
        }

        <!-- Table Mode -->
        @if (reviewMode === 'table') {
        <div class="table-view-container">
          <div class="table-wrapper">
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-include">Include</th>
                  <th class="col-name">Name</th>
                  <th class="col-qty">Qty</th>
                  <th class="col-unit">Unit</th>
                  <th class="col-price">Price ($)</th>
                  <th class="col-category">Category</th>
                  <th class="col-location">Location</th>
                  <th class="col-purchase">Purchase</th>
                  <th class="col-expire-in">Expires In</th>
                  <th class="col-expiry">Expiry</th>
                  <th class="col-notes">Notes</th>
                  <th class="col-notify">Notify</th>
                </tr>
              </thead>
              <tbody>
                @for (item of reviewItems; let idx = $index; track idx) {
                <tr [class.row-skipped]="!item.included">
                  <!-- Include/Skip -->
                  <td class="col-include">
                    <mat-chip-set>
                      <mat-chip [class.included]="item.included" [class.skipped]="!item.included" (click)="toggleItemInclusion(item)" class="skip-chip">
                        {{ item.included ? '✓' : '✕' }}
                      </mat-chip>
                    </mat-chip-set>
                  </td>

                  <!-- Name -->
                  <td class="col-name" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'name'" (click)="startEdit(idx, 'name')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'name') {
                      <div class="cell-edit">
                        <input type="text" [(ngModel)]="editingValue" class="edit-input" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">{{ item.name }}</span>
                    }
                  </td>

                  <!-- Quantity -->
                  <td class="col-qty" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'quantity'" (click)="startEdit(idx, 'quantity')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'quantity') {
                      <div class="cell-edit">
                        <input type="number" [(ngModel)]="editingValue" class="edit-input" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">{{ item.quantity }}</span>
                    }
                  </td>

                  <!-- Unit -->
                  <td class="col-unit" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'unit'" (click)="startEdit(idx, 'unit')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'unit') {
                      <div class="cell-edit">
                        <select [(ngModel)]="editingValue" class="edit-select" (click)="$event.stopPropagation()">
                          <option value="piece">piece</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="lbs">lbs</option>
                          <option value="oz">oz</option>
                          <option value="liter">liter</option>
                          <option value="ml">ml</option>
                          <option value="pack">pack</option>
                          <option value="box">box</option>
                          <option value="can">can</option>
                          <option value="bottle">bottle</option>
                          <option value="bag">bag</option>
                        </select>
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">{{ item.unit }}</span>
                    }
                  </td>

                  <!-- Price -->
                  <td class="col-price" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'totalPrice'" (click)="startEdit(idx, 'totalPrice')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'totalPrice') {
                      <div class="cell-edit">
                        <input type="number" [(ngModel)]="editingValue" class="edit-input" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">{{ '$' }}{{ item.totalPrice | number: '1.2-2' }}</span>
                    }
                  </td>

                  <!-- Category -->
                  <td class="col-category">
                    <span class="cell-value cell-selector" (click)="$event.stopPropagation(); openCategorySelector(item)">
                      {{ item.categoryHint }} <mat-icon>edit</mat-icon>
                    </span>
                  </td>

                  <!-- Location -->
                  <td class="col-location">
                    <span class="cell-value cell-selector" (click)="$event.stopPropagation(); openLocationSelector(item)">
                      {{ getLocationName(item.locationId) }} <mat-icon>edit</mat-icon>
                    </span>
                  </td>

                  <!-- Purchase Date -->
                  <td class="col-purchase editable-cell" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'purchaseDate'" (click)="startEdit(idx, 'purchaseDate')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'purchaseDate') {
                      <div class="cell-edit">
                        <input matInput type="date" [(ngModel)]="editingValue" class="edit-input" [max]="today" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">{{ item.purchaseDate }}</span>
                      <mat-icon class="edit-indicator">edit</mat-icon>
                    }
                  </td>

                  <!-- Expire Amount -->
                  <td class="col-expire-in editable-cell" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'expireAmount'" (click)="startEdit(idx, 'expireAmount')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'expireAmount') {
                      <div class="cell-edit">
                        <input type="number" [(ngModel)]="editingValue" class="edit-input" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">
                        {{ item.expireAmount }} {{ item.expireUnit }}
                        <mat-icon class="edit-indicator">edit</mat-icon>
                      </span>
                    }
                  </td>

                  <!-- Expiry Date -->
                  <td class="col-expiry editable-cell"
                      [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'expirationDate'"
                      (click)="startEdit(idx, 'expirationDate')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'expirationDate') {
                      <div class="cell-edit">
                        <input type="date" [(ngModel)]="editingValue" class="edit-input" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">{{ item.expirationDate }}</span>
                      <mat-icon class="edit-indicator">edit</mat-icon>
                    }
                  </td>

                  <!-- Notes -->
                  <td class="col-notes editable-cell" [class.editing]="editingCell?.rowIndex === idx && editingCell?.field === 'notes'" (click)="startEdit(idx, 'notes')">
                    @if (editingCell?.rowIndex === idx && editingCell?.field === 'notes') {
                      <div class="cell-edit">
                        <input type="text" [(ngModel)]="editingValue" class="edit-input" (click)="$event.stopPropagation()">
                        <button mat-icon-button (click)="$event.stopPropagation(); confirmEdit()">
                          <mat-icon class="confirm-icon">check</mat-icon>
                        </button>
                        <button mat-icon-button (click)="$event.stopPropagation(); cancelEdit()">
                          <mat-icon class="cancel-icon">close</mat-icon>
                        </button>
                      </div>
                    } @else {
                      <span class="cell-value">
                        {{ item.notes || '—' }}
                        <mat-icon class="edit-indicator">edit</mat-icon>
                      </span>
                    }
                  </td>

                  <!-- Notifications -->
                  <td class="col-notify">
                    <mat-slide-toggle [(ngModel)]="item.notificationEnabled" (click)="$event.stopPropagation()" color="primary"></mat-slide-toggle>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        }

        <!-- Bottom navigation (fixed) -->
        @if (reviewMode === 'wizard') {
        <div class="wizard-nav">
          <button mat-button (click)="goBack()" [disabled]="isFirstItem">
            <mat-icon>arrow_back</mat-icon>
            Back
          </button>
          <button mat-button (click)="onSkipToggle()" [class.skipped]="!currentItem.included">
            <mat-icon>{{ currentItem.included ? 'skip_next' : 'undo' }}</mat-icon>
            {{ currentItem.included ? 'Skip' : 'Un-skip' }}
          </button>
          <span class="spacer"></span>
          <button mat-raised-button color="primary" (click)="goNext()">
            {{ isLastItem ? 'Add All (' + includedCount + ')' : 'Next' }}
            <mat-icon>{{ isLastItem ? 'check' : 'arrow_forward' }}</mat-icon>
          </button>
        </div>
        }
        @if (reviewMode === 'table') {
        <div class="wizard-nav table-nav">
          <span class="spacer"></span>
          <button mat-raised-button color="primary" (click)="addItems()">
            <mat-icon>check</mat-icon>
            Add All ({{ includedCount }})
          </button>
        </div>
        }
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

      .receipt-date-field {
        width: 100%;
        max-width: 280px;
        margin-top: 1rem;
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

    /* Mode selection screen */
    .step-mode-select {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      padding: 2rem;
      min-height: 100%;

      h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 500;
        text-align: center;
      }

      .mode-hint {
        margin: 0;
        color: rgba(0, 0, 0, 0.6);
        text-align: center;
        strong { color: var(--primary-color, #4caf50); }
      }

      .mode-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        width: 100%;
        max-width: 600px;
      }
    }

    .mode-card {
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 2rem 1.5rem;
      cursor: pointer;
      text-align: center;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;

      &:hover {
        border-color: var(--primary-color, #4caf50);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--primary-color, #4caf50);
      }

      h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 500;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    /* Datatable view styles */
    .table-view-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 240px);
      overflow: hidden;
    }

    .table-wrapper {
      flex: 1;
      overflow-x: auto;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: white;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;

      thead {
        position: sticky;
        top: 0;
        background: #f5f5f5;
        border-bottom: 2px solid #e0e0e0;
        z-index: 10;

        th {
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.87);
          white-space: nowrap;
          border-right: 1px solid #e0e0e0;

          &:last-child {
            border-right: none;
          }
        }
      }

      tbody tr {
        border-bottom: 1px solid #e0e0e0;
        transition: background-color 0.2s;

        &:hover {
          background: #fafafa;
        }

        &.row-skipped {
          opacity: 0.65;
          background: #f5f5f5;

          .cell-value {
            text-decoration: line-through;
            color: rgba(0, 0, 0, 0.4);
          }
        }
      }

      td {
        padding: 10px 8px;
        border-right: 1px solid #e0e0e0;
        vertical-align: middle;

        &:last-child {
          border-right: none;
        }

        &.editing {
          background: #fffbea;
          padding: 4px;
        }

        .cell-value {
          display: block;
          padding: 6px 4px;
          cursor: pointer;
          user-select: none;
          color: rgba(0, 0, 0, 0.87);

          &.cell-selector {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--primary-color, #4caf50);

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              opacity: 0.6;
            }

            &:hover {
              text-decoration: underline;
            }
          }
        }

        .cell-edit {
          display: flex;
          align-items: center;
          gap: 4px;

          .edit-input {
            flex: 1;
            padding: 4px 6px;
            border: 1px solid var(--primary-color, #4caf50);
            border-radius: 4px;
            font-size: 0.9rem;
            min-width: 60px;
          }

          .edit-select {
            flex: 1;
            padding: 4px 6px;
            border: 1px solid var(--primary-color, #4caf50);
            border-radius: 4px;
            font-size: 0.9rem;
            min-width: 60px;
          }

          .edit-buttons {
            display: flex;
            gap: 2px;

            button {
              padding: 0;
              min-width: 32px;
              height: 32px;

              mat-icon {
                font-size: 18px;
                width: 18px;
                height: 18px;

                &.confirm-icon {
                  color: #4caf50;
                }

                &.cancel-icon {
                  color: #f44336;
                }
              }
            }
          }
        }
      }

      /* Editable cell styling */
      td.editable-cell {
        position: relative;
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.03) 0%, transparent 100%);

        &:hover {
          background: rgba(76, 175, 80, 0.08);
        }

        .cell-value {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;

          .edit-indicator {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: var(--primary-color, #4caf50);
            opacity: 0;
            transition: opacity 0.2s;
          }
        }

        &:hover .edit-indicator {
          opacity: 0.7;
        }

        &.editing {
          background: #fffbea !important;
        }
      }

      /* Column widths */
      .col-include { width: 80px; }
      .col-name { width: 120px; }
      .col-qty { width: 60px; }
      .col-unit { width: 70px; }
      .col-price { width: 80px; }
      .col-category { width: 100px; }
      .col-location { width: 100px; }
      .col-purchase { width: 100px; }
      .col-expire-in { width: 90px; }
      .col-expiry { width: 90px; }
      .col-notes { width: 120px; }
      .col-notify { width: 60px; }
    }

    .skip-chip {
      cursor: pointer;
      min-width: 50px;
      font-size: 0.75rem;
      padding: 2px 8px !important;

      &.included {
        background: #e8f5e9 !important;
        color: #2e7d32 !important;
      }

      &.skipped {
        background: #eeeeee !important;
        color: rgba(0, 0, 0, 0.5) !important;
      }
    }

    .table-nav {
      justify-content: flex-end;
    }

    /* Skip banner */
    .skipped-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff3e0;
      border: 1px solid #ffb74d;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 0.9rem;
      color: #e65100;

      mat-icon {
        color: #e65100;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      span {
        flex: 1;
      }

      button {
        margin-left: auto;
        flex-shrink: 0;
      }
    }

    /* Mode toggle in header */
    .mode-toggle {
      margin-left: auto;
    }

    .skipped-label {
      color: rgba(0, 0, 0, 0.5);
      font-weight: 400;
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

  // Mode selection
  reviewMode: 'wizard' | 'table' = 'wizard';
  expandedItemIndex: number | null = null;

  // Receipt date selection — use Date objects so matDatepicker gets a stable reference
  receiptDate: Date = new Date();
  today: string = toLocalDateString(new Date());   // YYYY-MM-DD string for native <input type="date"> [max]
  todayDate: Date = new Date();                    // Date object for matDatepicker [max]

  // Table editing state
  editingCell: { rowIndex: number; field: keyof ReviewItem } | null = null;
  editingValue: any = null;

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

  // Convert a YYYY-MM-DD string to a local-midnight Date for matDatepicker display.
  // Using new Date('YYYY-MM-DD') would produce UTC midnight, which in negative-UTC
  // timezones shows as the previous day. parseLocalDate() uses new Date(y, m-1, d)
  // (local midnight) to avoid that off-by-one error.
  toLocalDate(dateStr: string | Date | null | undefined): Date | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    return parseLocalDate(dateStr as string);
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

      // Compute purchase date from receiptDate (always a Date object now)
      const purchaseDateLocal = this.receiptDate instanceof Date
        ? this.receiptDate
        : parseLocalDate(this.receiptDate as any) || new Date();
      const purchaseDateStr = toLocalDateString(purchaseDateLocal);

      this.reviewItems = items.map(item => {
        const categoryId = this.resolveCategoryId(item.categoryHint);
        const expiryDays = this.receiptScanService.getDefaultExpiryDays(item.categoryHint);
        // Use purchaseDateLocal as base so expiry is relative to the receipt date
        const expiryDate = new Date(purchaseDateLocal);
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
          purchaseDate: purchaseDateStr,
          expirationDate: toLocalDateString(expiryDate),
          purchaseDateLocal: purchaseDateLocal,   // stable Date ref for datepicker
          expirationDateLocal: expiryDate,        // stable Date ref for datepicker
          expireAmount: expiryDays,
          expireUnit: 'days' as const,
          notes: '',
          notificationEnabled: true
        };
      });

      this.currentItemIndex = 0;
      this.reviewMode = 'wizard';
      this.expandedItemIndex = null;
      this.step = 'mode-select';
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
    const dialogRef = this.matDialog.open(SkipItemConfirmationDialog, {
      width: '400px',
      data: { itemName: this.currentItem.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.currentItem.included = false;
        this.goNext();
      }
    });
  }

  // Mode selection
  selectMode(mode: 'wizard' | 'table' | any) {
    // Flush any pending table cell edit before switching views
    this.confirmEdit();
    // Handle both direct calls and MatButtonToggleChange events
    const selectedMode = typeof mode === 'string' ? mode : mode.value;
    this.reviewMode = selectedMode;
    this.expandedItemIndex = null;
    this.step = 'item-wizard';
  }

  // Toggle item expansion in table view
  toggleExpand(index: number) {
    this.expandedItemIndex = this.expandedItemIndex === index ? null : index;
  }

  // Toggle item inclusion in table view (no dialog)
  toggleItemInclusion(item: ReviewItem) {
    item.included = !item.included;
  }

  // Un-skip current item in wizard view
  includeCurrentItem() {
    this.currentItem.included = true;
  }

  // Route skip/un-skip based on current state
  onSkipToggle() {
    if (this.currentItem.included) {
      this.skipItem(); // open confirmation dialog
    } else {
      this.includeCurrentItem(); // immediate un-skip
    }
  }

  // Table view cell editing methods
  startEdit(rowIndex: number, field: keyof ReviewItem) {
    const item = this.reviewItems[rowIndex];
    if (!item) return;
    this.editingCell = { rowIndex, field };
    this.editingValue = item[field];
  }

  cancelEdit() {
    this.editingCell = null;
    this.editingValue = null;
  }

  confirmEdit() {
    if (!this.editingCell) return;
    const item = this.reviewItems[this.editingCell.rowIndex];
    if (item) {
      (item as any)[this.editingCell.field] = this.editingValue;

      // If editing expireAmount or expireUnit, recalculate expiration date
      if (this.editingCell.field === 'expireAmount' || this.editingCell.field === 'expireUnit') {
        this.updateExpirationDate(item);
      }

      // If directly editing purchaseDate string, sync the Local Date ref
      if (this.editingCell.field === 'purchaseDate' && item.purchaseDate) {
        item.purchaseDateLocal = parseLocalDate(item.purchaseDate);
        this.updateExpirationDate(item);
      }

      // If directly editing expirationDate string, sync Local Date ref and back-calculate expireAmount
      if (this.editingCell.field === 'expirationDate' && item.purchaseDate && item.expirationDate) {
        item.expirationDateLocal = parseLocalDate(item.expirationDate);
        const purchase = item.purchaseDateLocal || parseLocalDate(item.purchaseDate);
        const expiry = item.expirationDateLocal;
        const diffDays = Math.round((expiry.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
        item.expireAmount = diffDays > 0 ? diffDays : 0;
        item.expireUnit = 'days';
      }
    }
    this.cancelEdit();
  }

  // Handler for wizard purchase date datepicker — converts Date → string (no UTC offset)
  onPurchaseDateChange(event: MatDatepickerInputEvent<Date>, item: ReviewItem) {
    if (event.value) {
      item.purchaseDateLocal = event.value;          // keep stable Date ref
      item.purchaseDate = toLocalDateString(event.value);
      this.updateExpirationDate(item);
    }
  }

  // Handler for wizard expiry date datepicker — converts Date → string and back-calculates expireAmount
  onExpiryDateChange(event: MatDatepickerInputEvent<Date>, item: ReviewItem) {
    if (event.value) {
      item.expirationDateLocal = event.value;        // keep stable Date ref
      item.expirationDate = toLocalDateString(event.value);
      if (item.purchaseDate) {
        const purchase = item.purchaseDateLocal || parseLocalDate(item.purchaseDate);
        const diffMs = event.value.getTime() - purchase.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        item.expireAmount = diffDays > 0 ? diffDays : 0;
        item.expireUnit = 'days';
      }
    }
  }

  // Calculate and update expiration date based on purchase date and expiry offset
  updateExpirationDate(item: ReviewItem) {
    if (!item.purchaseDate || !item.expireAmount) return;

    // Use parseLocalDate for strings to avoid UTC -1 day in negative-offset timezones
    const purchaseDate = typeof item.purchaseDate === 'string'
      ? parseLocalDate(item.purchaseDate)
      : item.purchaseDate as Date;
    let daysToAdd = item.expireAmount;

    // Convert to days based on unit
    switch (item.expireUnit) {
      case 'weeks':
        daysToAdd = item.expireAmount * 7;
        break;
      case 'months':
        daysToAdd = item.expireAmount * 30;
        break;
      case 'years':
        daysToAdd = item.expireAmount * 365;
        break;
      case 'days':
      default:
        daysToAdd = item.expireAmount;
    }

    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);

    item.expirationDateLocal = expiryDate;           // update stable Date ref for datepicker
    item.expirationDate = toLocalDateString(expiryDate);
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
    if (!item.name?.trim()) {
      this.showMessage('Item name is required for AI suggestion');
      return;
    }
    if (!item.purchaseDate) {
      this.showMessage('Purchase date is required for AI suggestion');
      return;
    }
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
        notificationDaysBefore: 3,
        initialQuantity: item.quantity,
        currentQuantity: item.quantity
      };

      const result = await this.inventoryService.addItem(inventoryItem);
      if (result.success && result.itemId) {
        // Create batch for the newly added item
        await this.inventoryService.addBatch({
          itemId: result.itemId,
          quantity: item.quantity,
          expirationDate: item.expirationDate || null,
          purchaseDate: item.purchaseDate || null,
          price: unitPrice || null,
          notes: item.notes || null
        });
        addedCount++;
      }
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

// Skip Item Confirmation Dialog
@Component({
  selector: 'skip-item-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="skip-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">info</mat-icon>
        <h2 mat-dialog-title>Skip Item</h2>
      </div>

      <mat-dialog-content>
        <p class="dialog-message">
          Are you sure you want to skip <strong>"{{ data.itemName }}"</strong>?
        </p>
        <p class="dialog-hint">
          This item will not be added to your inventory. You can always add it manually later.
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">
          <mat-icon>close</mat-icon>
          Cancel
        </button>
        <button mat-raised-button color="warn" (click)="onConfirm()">
          <mat-icon>check</mat-icon>
          Skip Item
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .skip-dialog {
      min-width: 300px;

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 0;
        padding: 20px 24px 0;

        .warning-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: #ff9800;
          flex-shrink: 0;
        }

        h2 {
          margin: 0;
          font-size: 1.3rem;
        }
      }

      mat-dialog-content {
        padding: 8px 24px 16px !important;

        .dialog-message {
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
          color: rgba(0, 0, 0, 0.87);

          strong {
            color: var(--primary-color, #4caf50);
          }
        }

        .dialog-hint {
          margin: 0;
          font-size: 0.9rem;
          color: rgba(0, 0, 0, 0.6);
        }
      }

      mat-dialog-actions {
        padding: 12px 24px 16px !important;

        button {
          min-width: 80px;

          mat-icon {
            margin-right: 6px;
          }
        }
      }
    }
  `]
})
export class SkipItemConfirmationDialog {
  constructor(
    public dialogRef: MatDialogRef<SkipItemConfirmationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { itemName: string }
  ) {}

  onCancel() {
    this.dialogRef.close(false);
  }

  onConfirm() {
    this.dialogRef.close(true);
  }
}
