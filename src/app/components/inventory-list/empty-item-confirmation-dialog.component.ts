import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Empty Item Confirmation Dialog Component
@Component({
  selector: 'empty-item-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
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
        <p>
          <strong>{{ data.itemName }}</strong> is now out of stock.
        </p>
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
  styles: [
    `
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
    `,
  ],
})
export class EmptyItemConfirmationDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { itemName: string }) {}
}
