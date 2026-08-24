import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface UsageConfirmDialogData {
  itemName: string;
  unit: string;
  oldPercentage: number;
  newPercentage: number;
  oldQuantity: number;
  newQuantity: number;
}

export interface UsageConfirmDialogResult {
  confirmed: boolean;
  notes: string;
}

@Component({
  selector: 'app-usage-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>timeline</mat-icon>
      Update Usage: {{ data.itemName }}
    </h2>

    <mat-dialog-content>
      <div class="comparison-card">
        <div class="comparison-side">
          <span class="comparison-label">Current</span>
          <span class="comparison-percentage">{{ data.oldPercentage | number: '1.0-0' }}%</span>
          <span class="comparison-quantity"
            >{{ data.oldQuantity | number: '1.0-2' }} {{ data.unit }}</span
          >
        </div>
        <mat-icon class="comparison-arrow">arrow_forward</mat-icon>
        <div class="comparison-side">
          <span class="comparison-label">New</span>
          <span class="comparison-percentage highlight"
            >{{ data.newPercentage | number: '1.0-0' }}%</span
          >
          <span class="comparison-quantity"
            >{{ data.newQuantity | number: '1.0-2' }} {{ data.unit }}</span
          >
        </div>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Notes (Optional)</mat-label>
        <textarea
          matInput
          [(ngModel)]="notes"
          rows="2"
          placeholder="e.g., Used for dinner, Shared with neighbors..."
        ></textarea>
        <mat-icon matPrefix>note</mat-icon>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onConfirm()">
        <mat-icon>check</mat-icon>
        Confirm
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
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
        min-width: 350px;
      }

      @media (max-width: 600px) {
        mat-dialog-content {
          min-width: unset;
          width: 100%;
        }
      }

      .comparison-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }

      .comparison-side {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
      }

      .comparison-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(0, 0, 0, 0.5);
        margin-bottom: 4px;
      }

      .comparison-percentage {
        font-size: 1.5rem;
        font-weight: 700;
        color: rgba(0, 0, 0, 0.87);
      }

      .comparison-percentage.highlight {
        color: var(--primary-color);
      }

      .comparison-quantity {
        font-size: 0.813rem;
        color: rgba(0, 0, 0, 0.6);
        margin-top: 2px;
      }

      .comparison-arrow {
        color: rgba(0, 0, 0, 0.3);
        flex-shrink: 0;
      }

      .full-width {
        width: 100%;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
      }

      mat-dialog-actions button {
        margin-left: 8px;
      }
    `,
  ],
})
export class UsageConfirmDialogComponent {
  notes = '';

  constructor(
    public dialogRef: MatDialogRef<UsageConfirmDialogComponent, UsageConfirmDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: UsageConfirmDialogData,
  ) {}

  onConfirm(): void {
    this.dialogRef.close({ confirmed: true, notes: this.notes.trim() });
  }

  onCancel(): void {
    this.dialogRef.close({ confirmed: false, notes: '' });
  }
}
