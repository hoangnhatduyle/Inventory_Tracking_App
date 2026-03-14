import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { InventoryItem, InventoryBatch } from '../../models/inventory.model';

@Component({
  selector: 'app-view-batches-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>inventory</mat-icon>
      Batches for {{ data.item.name }}
    </h2>

    <mat-dialog-content>
      <div class="summary-card">
        <div class="summary-row">
          <span class="label">Total Quantity:</span>
          <span class="value">{{ totalQuantity }} {{ data.item.unit }}</span>
        </div>
        <div class="summary-row">
          <span class="label">Total Batches:</span>
          <span class="value">{{ data.batches.length }}</span>
        </div>
        @if (earliestExpiration) {
        <div class="summary-row">
          <span class="label">Earliest Expiration:</span>
          <span class="value warning">{{ earliestExpiration | date:'mediumDate' }}</span>
        </div>
        }
      </div>

      @if (data.batches.length > 0) {
      <div class="batches-list">
        @for (batch of data.batches; track batch.id; let i = $index) {
        <mat-card class="batch-card">
          <mat-card-content>
            <div class="batch-header">
              <div class="batch-number">
                <mat-icon>layers</mat-icon>
                <span>Batch {{ i + 1 }}</span>
              </div>
              <mat-chip [class]="getBatchStatusClass(batch)">
                {{ getBatchStatus(batch) }}
              </mat-chip>
            </div>

            <div class="batch-details">
              <div class="detail-row">
                <mat-icon>shopping_cart</mat-icon>
                <div class="detail-content">
                  <span class="detail-label">Quantity</span>
                  <span class="detail-value">{{ batch.quantity }} {{ data.item.unit }}</span>
                </div>
              </div>

              <div class="detail-row">
                <mat-icon>event</mat-icon>
                <div class="detail-content">
                  <span class="detail-label">Purchase Date</span>
                  <span class="detail-value">{{ batch.purchase_date | date:'mediumDate' }}</span>
                </div>
              </div>

              @if (batch.expiration_date) {
              <div class="detail-row">
                <mat-icon>schedule</mat-icon>
                <div class="detail-content">
                  <span class="detail-label">Expiration Date</span>
                  <span class="detail-value" [class.expired]="isExpired(batch)" [class.expiring]="isExpiringSoon(batch)">
                    {{ batch.expiration_date | date:'mediumDate' }}
                    @if (getDaysUntilExpiration(batch) !== null) {
                    <span class="days-info">
                      ({{ getDaysUntilExpiration(batch)! > 0 ? getDaysUntilExpiration(batch) + ' days' : getDaysUntilExpiration(batch)! === 0 ? 'Today' : 'Expired' }})
                    </span>
                    }
                  </span>
                </div>
              </div>
              }

              @if (batch.price) {
              <div class="detail-row">
                <mat-icon>attach_money</mat-icon>
                <div class="detail-content">
                  <span class="detail-label">Price</span>
                  <span class="detail-value">\${{ batch.price }}</span>
                </div>
              </div>
              }

              @if (batch.notes) {
              <div class="detail-row">
                <mat-icon>note</mat-icon>
                <div class="detail-content">
                  <span class="detail-label">Notes</span>
                  <span class="detail-value">{{ batch.notes }}</span>
                </div>
              </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
        }
      </div>
      }

      @if (data.batches.length === 0) {
      <div class="empty-state">
        <mat-icon>inventory_2</mat-icon>
        <p>No batches tracked yet</p>
        <p class="hint">Use the "Refill" button to add batches</p>
      </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" mat-dialog-close>
        <mat-icon>close</mat-icon>
        Close
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
      min-width: 500px;
      max-height: 70vh;
      overflow-y: auto;
    }

    @media (max-width: 600px) {
      mat-dialog-content {
        min-width: unset;
        width: 100%;
      }
    }

    .summary-card {
      background: linear-gradient(135deg, var(--primary-color) 0%, rgba(var(--primary-color-rgb), 0.8) 100%);
      color: black;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .summary-row:not(:last-child) {
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .summary-row .label {
      font-size: 0.95rem;
      opacity: 0.9;
    }

    .summary-row .value {
      font-size: 1.1rem;
      font-weight: 600;
    }

    .summary-row .value.warning {
      color: #ffd54f;
    }

    .batches-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .batch-card {
      border-left: 4px solid var(--primary-color);
      transition: transform 0.2s, box-shadow 0.2s;
      background: white;
    }

    .batch-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .batch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(0, 0, 0, 0.08);
    }

    .batch-number {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 1.1rem;
      color: rgba(0, 0, 0, 0.87);
    }

    .batch-number mat-icon {
      color: var(--primary-color);
    }

    mat-chip.fresh {
      background: #4caf50 !important;
      color: white !important;
    }

    mat-chip.expiring {
      background: #ff9800 !important;
      color: white !important;
    }

    mat-chip.expired {
      background: #f44336 !important;
      color: white !important;
    }

    .batch-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .detail-row mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: rgba(0, 0, 0, 0.54);
      margin-top: 2px;
    }

    .detail-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-label {
      font-size: 0.75rem;
      color: rgba(0, 0, 0, 0.54);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    .detail-value {
      font-size: 0.95rem;
      color: rgba(0, 0, 0, 0.87);
      font-weight: 500;
    }

    .detail-value.expired {
      color: #f44336;
      font-weight: 500;
    }

    .detail-value.expiring {
      color: #ff9800;
      font-weight: 500;
    }

    .days-info {
      font-size: 0.85rem;
      opacity: 0.8;
    }

    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: rgba(0, 0, 0, 0.54);
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .empty-state p {
      margin: 8px 0;
    }

    .empty-state .hint {
      font-size: 0.875rem;
      font-style: italic;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    }
  `]
})
export class ViewBatchesDialogComponent implements OnInit {
  totalQuantity = 0;
  earliestExpiration: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<ViewBatchesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      item: InventoryItem;
      batches: InventoryBatch[];
    }
  ) {}

  ngOnInit() {
    // Calculate total quantity
    this.totalQuantity = this.data.batches.reduce((sum, batch) => sum + batch.quantity, 0);

    // Find earliest expiration
    const expirations = this.data.batches
      .filter(b => b.expiration_date || b.expirationDate)
      .map(b => (b.expiration_date || b.expirationDate)!);
    
    if (expirations.length > 0) {
      this.earliestExpiration = expirations.sort()[0];
    }
  }

  getBatchStatus(batch: InventoryBatch): string {
    if (!batch.expiration_date) return 'Fresh';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = this.parseLocalDate(batch.expiration_date);
    expDate.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (expDate < today) return 'Expired';
    if (expDate <= threeDaysFromNow) return 'Expiring Soon';
    return 'Fresh';
  }

  getBatchStatusClass(batch: InventoryBatch): string {
    const status = this.getBatchStatus(batch);
    if (status === 'Expired') return 'expired';
    if (status === 'Expiring Soon') return 'expiring';
    return 'fresh';
  }

  isExpired(batch: InventoryBatch): boolean {
    if (!batch.expiration_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = this.parseLocalDate(batch.expiration_date);
    expDate.setHours(0, 0, 0, 0);
    return expDate < today;
  }

  isExpiringSoon(batch: InventoryBatch): boolean {
    if (!batch.expiration_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = this.parseLocalDate(batch.expiration_date);
    expDate.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return expDate >= today && expDate <= threeDaysFromNow;
  }

  getDaysUntilExpiration(batch: InventoryBatch): number | null {
    if (!batch.expiration_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = this.parseLocalDate(batch.expiration_date);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
