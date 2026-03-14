import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

export interface AISuggestionDialogData {
  itemName: string;
  purchaseDate: Date;
  suggestedDays: number;
  suggestedExpirationDate: Date;
  note: string;
}

@Component({
  selector: 'app-ai-suggestion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <div class="ai-dialog" style="padding: 1rem;">
      <div class="dialog-header">
        <mat-icon class="ai-icon">lightbulb</mat-icon>
        <h2 mat-dialog-title>AI Expiration Suggestion</h2>
      </div>

      <mat-dialog-content>
        <div class="suggestion-content">
          <div class="item-info">
            <strong>{{ data.itemName }}</strong>
            <p class="date-info">
              Purchased: {{ data.purchaseDate | date:'mediumDate' }}
            </p>
          </div>

          <mat-divider></mat-divider>

          <div class="suggestion-box">
            <div class="expiration-suggestion">
              <div class="days-badge">
                <span class="days-number">{{ data.suggestedDays }}</span>
                <span class="days-label">{{ data.suggestedDays === 1 ? 'day' : 'days' }}</span>
              </div>
              <div class="expiration-date">
                <mat-icon>event</mat-icon>
                <div>
                  <strong>Suggested Expiration</strong>
                  <p>{{ data.suggestedExpirationDate | date:'mediumDate' }}</p>
                </div>
              </div>
            </div>

            @if (data.note) {
            <div class="ai-note">
              <mat-icon style="overflow: visible;">info</mat-icon>
              <p>{{ data.note }}</p>
            </div>
            }
          </div>

          <div class="disclaimer">
            <mat-icon>warning</mat-icon>
            <p>AI suggestion is an estimate. Always check item condition before use.</p>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onReject()">
          <mat-icon>close</mat-icon>
          Cancel
        </button>
        <button mat-raised-button color="primary" (click)="onAccept()">
          <mat-icon>check</mat-icon>
          Apply Suggestion
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .ai-dialog {
      min-width: 320px;
      max-width: 500px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ai-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #FFC107;
    }

    h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .suggestion-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .item-info {
      text-align: center;
    }

    .item-info strong {
      font-size: 1.1rem;
      color: #333;
    }

    .date-info {
      margin: 4px 0 0 0;
      color: #666;
      font-size: 0.9rem;
    }

    .suggestion-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 20px;
      color: white;
    }

    .expiration-suggestion {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .days-badge {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      min-width: 80px;
      backdrop-filter: blur(10px);
    }

    .days-number {
      display: block;
      font-size: 2rem;
      font-weight: bold;
      line-height: 1;
    }

    .days-label {
      display: block;
      font-size: 0.85rem;
      opacity: 0.9;
      margin-top: 4px;
    }

    .expiration-date {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .expiration-date mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .expiration-date strong {
      display: block;
      font-size: 0.9rem;
      margin-bottom: 4px;
    }

    .expiration-date p {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .ai-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: rgba(255, 255, 255, 0.15);
      padding: 12px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }

    .ai-note mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .ai-note p {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .disclaimer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #FFF3CD;
      border-left: 4px solid #FFC107;
      border-radius: 4px;
    }

    .disclaimer mat-icon {
      color: #FF6F00;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .disclaimer p {
      margin: 0;
      font-size: 0.85rem;
      color: #856404;
    }

    mat-dialog-actions {
      margin-top: 16px;
      padding: 16px 0 0 0;
      gap: 8px;
    }

    button {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `]
})
export class AISuggestionDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AISuggestionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AISuggestionDialogData
  ) {}

  onAccept(): void {
    this.dialogRef.close({ accepted: true });
  }

  onReject(): void {
    this.dialogRef.close({ accepted: false });
  }
}
