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
        <input matInput [(ngModel)]="categoryName" placeholder="e.g., Asian Pantry, Snacks" required />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!categoryName.trim()">
        {{ data.category ? 'Update' : 'Add' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }

      mat-dialog-content {
        min-width: 300px;
        padding: 20px 24px;
      }
    `,
  ],
})
export class CategoryDialogComponent {
  categoryName = '';

  constructor(
    public dialogRef: MatDialogRef<CategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category | null },
    private inventoryService: InventoryService,
    private snackBar: MatSnackBar,
  ) {
    if (data.category) {
      this.categoryName = data.category.name;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  async onSave(): Promise<void> {
    if (!this.categoryName.trim()) return;

    const payload = { name: this.categoryName.trim() };
    let success = false;

    if (this.data.category?.id) {
      success = await this.inventoryService.updateCategory({
        ...this.data.category,
        name: payload.name,
      });
    } else {
      success = await this.inventoryService.addCategory(payload);
    }

    if (success) {
      this.dialogRef.close(true);
    } else {
      this.snackBar.open('Failed to save category', 'Close', { duration: 3000 });
    }
  }
}
