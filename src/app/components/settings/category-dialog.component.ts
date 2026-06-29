import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InventoryService } from '../../services/inventory.service';
import { Category } from '../../models/inventory.model';

// Curated grocery/food emoji set. Categories store the icon as an emoji string
// (matches the seeded default categories e.g. Dairy '🥛', Produce '🥬').
const ICON_OPTIONS = [
  '📦',
  '🥛',
  '🧀',
  '🥚',
  '🥬',
  '🥦',
  '🥕',
  '🌽',
  '🥔',
  '🍅',
  '🍄',
  '🧄',
  '🧅',
  '🌶️',
  '🥗',
  '🍎',
  '🍌',
  '🍓',
  '🍇',
  '🍊',
  '🍉',
  '🥩',
  '🍗',
  '🐟',
  '🦐',
  '🍤',
  '🍞',
  '🥐',
  '🧁',
  '🍪',
  '🍫',
  '🍿',
  '🥫',
  '🍝',
  '🍚',
  '🧂',
  '🥤',
  '☕',
  '🍷',
  '🧊',
  '🍯',
  '🥜',
  '🛒',
  '🧴',
];

@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? 'Edit' : 'Add' }} Category</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Category Name</mat-label>
        <input
          matInput
          [(ngModel)]="categoryName"
          placeholder="e.g., Asian Pantry, Snacks"
          required
        />
      </mat-form-field>

      <p class="icon-label">
        Icon
        <span class="icon-preview" *ngIf="selectedIcon" aria-hidden="true">{{ selectedIcon }}</span>
      </p>
      <div class="icon-grid" role="radiogroup" aria-label="Category icon">
        <button
          type="button"
          class="icon-option"
          [class.selected]="selectedIcon === icon"
          role="radio"
          [attr.aria-checked]="selectedIcon === icon"
          [attr.aria-label]="'Icon ' + icon"
          *ngFor="let icon of iconOptions"
          (click)="selectIcon(icon)"
        >
          {{ icon }}
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!categoryName.trim()"
      >
        {{ data.category ? 'Update' : 'Add' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        margin-bottom: 8px;
      }

      mat-dialog-content {
        min-width: 320px;
        padding: 20px 24px;
      }

      .icon-label {
        margin: 4px 0 10px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .icon-preview {
        font-size: 22px;
        line-height: 1;
      }

      .icon-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 6px;
      }

      .icon-option {
        aspect-ratio: 1;
        border: 1px solid var(--mat-sys-outline-variant, #d6d6d0);
        border-radius: 10px;
        background: transparent;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        transition:
          border-color 120ms ease,
          background 120ms ease,
          transform 120ms ease;
      }

      .icon-option:hover {
        background: rgba(0, 0, 0, 0.04);
        transform: translateY(-1px);
      }

      .icon-option.selected {
        border-color: #2e7d32;
        background: rgba(46, 125, 50, 0.12);
        box-shadow: inset 0 0 0 1px #2e7d32;
      }

      .icon-option:focus-visible {
        outline: 2px solid #2e7d32;
        outline-offset: 2px;
      }
    `,
  ],
})
export class CategoryDialogComponent {
  categoryName = '';
  selectedIcon = '📦';
  readonly iconOptions = ICON_OPTIONS;

  constructor(
    public dialogRef: MatDialogRef<CategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category | null },
    private inventoryService: InventoryService,
    private snackBar: MatSnackBar,
  ) {
    if (data.category) {
      this.categoryName = data.category.name;
      this.selectedIcon = data.category.icon || '📦';
    }
  }

  selectIcon(icon: string): void {
    this.selectedIcon = icon;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  async onSave(): Promise<void> {
    if (!this.categoryName.trim()) return;

    const name = this.categoryName.trim();
    let success = false;

    if (this.data.category?.id) {
      success = await this.inventoryService.updateCategory({
        ...this.data.category,
        name,
        icon: this.selectedIcon,
      });
    } else {
      success = await this.inventoryService.addCategory({ name, icon: this.selectedIcon });
    }

    if (success) {
      this.dialogRef.close(true);
    } else {
      this.snackBar.open('Failed to save category', 'Close', { duration: 3000 });
    }
  }
}
