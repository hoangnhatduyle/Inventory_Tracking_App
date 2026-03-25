import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { AISuggestionDialogComponent, AISuggestionDialogData } from '../item-form/ai-suggestion-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InventoryItem } from '../../models/inventory.model';
import { ExpirationAIService } from '../../services/expiration-ai.service';

@Component({
  selector: 'app-refill-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>autorenew</mat-icon>
      Refill {{ data.item.name }}
    </h2>

    <mat-dialog-content>
      <form>
        <!-- Refill Mode Selection -->
        <div class="form-section">
          <label class="section-label">How do you want to refill?</label>
          <mat-radio-group [(ngModel)]="refillMode" name="refillMode" class="radio-group">
            <mat-radio-button value="add" class="radio-option">
              <div class="radio-content">
                <strong>Add to Existing</strong>
                <p>Adds new quantity to current stock</p>
              </div>
            </mat-radio-button>
            <mat-radio-button value="replace" class="radio-option">
              <div class="radio-content">
                <strong>Replace All</strong>
                <p>Removes old batches and starts fresh</p>
              </div>
            </mat-radio-button>
          </mat-radio-group>
        </div>

        <!-- Current Stock Info -->
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Current Total:</span>
            <span class="info-value">{{ data.currentQuantity }} {{ data.item.unit }}</span>
          </div>
          @if (refillMode === 'add' && newQuantity) {
          <div class="info-row">
            <span class="info-label">After Refill:</span>
            <span class="info-value highlight">{{ data.currentQuantity + newQuantity }} {{ data.item.unit }}</span>
          </div>
          }
        </div>

        <!-- New Quantity -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>New Quantity</mat-label>
          <input matInput type="number" [(ngModel)]="newQuantity" name="newQuantity" 
                 min="0.01" step="0.01" required>
          <span matSuffix style="padding-right: 1rem;">{{ data.item.unit }}</span>
          <mat-icon matPrefix>shopping_cart</mat-icon>
        </mat-form-field>

        <!-- Purchase Date -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Purchase Date</mat-label>
          <input matInput [matDatepicker]="purchasePicker" [(ngModel)]="purchaseDate" name="purchaseDate">
          <mat-icon matPrefix>event</mat-icon>
          <mat-datepicker-toggle matSuffix [for]="purchasePicker"></mat-datepicker-toggle>
          <mat-datepicker #purchasePicker></mat-datepicker>
        </mat-form-field>

        <!-- Expiration Date -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Expiration Date (Optional)</mat-label>
          <input matInput [matDatepicker]="expirationPicker" [(ngModel)]="expirationDate" name="expirationDate">
          <mat-icon matPrefix>schedule</mat-icon>
          <mat-datepicker-toggle matSuffix [for]="expirationPicker"></mat-datepicker-toggle>
          <mat-datepicker #expirationPicker></mat-datepicker>
        </mat-form-field>

        <div class="expiry-actions">
          <button mat-button (click)="requestAISuggestion()" [disabled]="isLoadingAI || !data.item.name" color="accent">
            <mat-icon>{{ isLoadingAI ? 'hourglass_empty' : 'lightbulb' }}</mat-icon>
            {{ isLoadingAI ? 'Loading...' : 'AI Suggestion' }}
          </button>
          <button mat-button (click)="resetExpiration()">Reset</button>
        </div>

        <!-- Total Price -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Total Price (Optional)</mat-label>
          <input matInput type="number" [(ngModel)]="price" name="price" 
                 min="0" step="0.01" placeholder="e.g., 15.99">
          <mat-icon matPrefix>attach_money</mat-icon>
        </mat-form-field>

        <!-- Notes -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes (Optional)</mat-label>
          <textarea matInput [(ngModel)]="notes" name="notes" rows="2"
                    placeholder="e.g., From Costco, better quality"></textarea>
          <mat-icon matPrefix>note</mat-icon>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()" 
              [disabled]="!isValid()">
        <mat-icon>save</mat-icon>
        {{ refillMode === 'add' ? 'Add Stock' : 'Replace Stock' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }

    h2 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--primary-color);
    }

    mat-dialog-content {
      padding: 24px;
      min-width: 450px;
      max-height: 70vh;
      overflow-y: auto;
      background: #fafafa;
    }

    @media (max-width: 600px) {
      mat-dialog-content {
        min-width: unset;
        width: 100%;
      }
    }

    .form-section {
      margin-bottom: 24px;
      background: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-label {
      display: block;
      font-weight: 600;
      margin-bottom: 12px;
      color: rgba(0, 0, 0, 0.87);
      font-size: 0.95rem;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .radio-option {
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .radio-option:hover {
      border-color: var(--primary-color);
      background: rgba(var(--primary-color-rgb), 0.05);
    }

    .radio-option.mat-mdc-radio-checked {
      border-color: var(--primary-color);
      background: rgba(var(--primary-color-rgb), 0.1);
    }

    .radio-content strong {
      display: block;
      margin-bottom: 4px;
    }

    .radio-content p {
      margin: 0;
      font-size: 0.875rem;
      color: rgba(0, 0, 0, 0.6);
    }

    .info-card {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .info-row:not(:last-child) {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .info-label {
      font-weight: 500;
      color: rgba(0, 0, 0, 0.6);
    }

    .info-value {
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
    }

    .info-value.highlight {
      color: var(--primary-color);
      font-size: 1.1rem;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .expiry-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      justify-content: flex-end;
    }

    .expiry-actions button {
      flex: 1;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class RefillDialogComponent implements OnInit {
  refillMode: 'add' | 'replace' = 'add';
  newQuantity: number = 0;
  purchaseDate: Date = new Date();
  expirationDate: Date | null = null;
  price: number | null = null;
  notes: string = '';
  isLoadingAI = false;

  constructor(
    public dialogRef: MatDialogRef<RefillDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      item: InventoryItem;
      currentQuantity: number;
      userId: number;
    },
    private expirationAIService: ExpirationAIService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    // Pre-fill price with last known price
    this.price = this.data.item.price || null;
  }

  isValid(): boolean {
    return this.newQuantity > 0;
  }

  async requestAISuggestion() {
    if (!this.data.item.name) {
      this.snackBar.open('Item name is required for AI suggestion', 'Close', { duration: 3000 });
      return;
    }
    if (!this.purchaseDate) {
      this.snackBar.open('Purchase date is required for AI suggestion', 'Close', { duration: 3000 });
      return;
    }

    this.isLoadingAI = true;

    try {
      const suggestion = await this.expirationAIService.suggestExpiration(
        this.data.item.name,
        this.purchaseDate,
        null,
        this.data.userId
      );

      const suggestedDate = new Date(this.purchaseDate);
      suggestedDate.setDate(suggestedDate.getDate() + suggestion.days);

      const dialogRef = this.dialog.open(AISuggestionDialogComponent, {
        width: '90%',
        maxWidth: '500px',
        data: {
          itemName: this.data.item.name,
          purchaseDate: this.purchaseDate,
          suggestedDays: suggestion.days,
          suggestedExpirationDate: suggestedDate,
          note: suggestion.note
        } as AISuggestionDialogData
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result?.accepted) {
          this.expirationDate = suggestedDate;
          this.snackBar.open('✓ AI suggestion applied', 'Close', { duration: 3000 });
        }
      });
    } catch (error: any) {
      console.error('AI suggestion error:', error);
      this.snackBar.open(error.message || 'Failed to get AI suggestion', 'Close', { duration: 5000 });
    } finally {
      this.isLoadingAI = false;
    }
  }

  resetExpiration() {
    this.expirationDate = null;
  }

  onSave() {
    if (!this.isValid()) return;

    // Calculate price per unit from total price
    const pricePerUnit = this.price && this.newQuantity > 0 ? this.price / this.newQuantity : null;

    this.dialogRef.close({
      mode: this.refillMode,
      quantity: this.newQuantity,
      purchaseDate: this.formatDate(this.purchaseDate),
      expirationDate: this.expirationDate ? this.formatDate(this.expirationDate) : null,
      price: pricePerUnit,
      notes: this.notes
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
