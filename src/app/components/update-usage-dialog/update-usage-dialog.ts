import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InventoryItem, ShoppingListItem } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { ShoppingListService } from '../../services/shopping-list.service';

export interface UpdateUsageDialogData {
  item: InventoryItem;
}

export interface UpdateUsageDialogResult {
  amountUsed: number;
  remainingAmount: number;
  notes: string;
  markedAsEmpty: boolean;
}

@Component({
  selector: 'app-update-usage-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './update-usage-dialog.html',
  styleUrl: './update-usage-dialog.scss',
})
export class UpdateUsageDialog implements OnInit {
  item: InventoryItem;

  // Usage tracking
  initialQuantity: number = 0;
  currentQuantity: number = 0;
  amountToUse: number = 0;
  usageNotes: string = '';

  // Calculated values
  percentageRemaining: number = 100;
  percentageUsed: number = 0;
  usageHistory: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<UpdateUsageDialog>,
    @Inject(MAT_DIALOG_DATA) public data: UpdateUsageDialogData,
    private inventoryService: InventoryService,
    private shoppingListService: ShoppingListService,
    private snackBar: MatSnackBar
  ) {
    this.item = data.item;
  }

  async ngOnInit() {
    // Initialize quantities
    this.initialQuantity = this.item.initialQuantity || this.item.quantity;
    this.currentQuantity = this.item.currentQuantity !== undefined
      ? this.item.currentQuantity
      : this.item.quantity;

    this.calculatePercentages();

    // Load usage history
    if (this.item.id) {
      this.usageHistory = await this.inventoryService.getUsageHistory(this.item.id);
    }

    // Initialize amountToUse to 0 (user will input how much they just used)
    this.amountToUse = 0;
  }

  onSliderChange(value: number) {
    // Slider represents percentage remaining (0-100)
    this.percentageRemaining = value;
    this.currentQuantity = (this.initialQuantity * value) / 100;
    
    // Calculate incremental amount used from previous quantity
    const previousQuantity = this.item.currentQuantity !== undefined 
      ? this.item.currentQuantity 
      : this.item.quantity;
    this.amountToUse = previousQuantity - this.currentQuantity;
    
    this.percentageUsed = 100 - value;
  }

  onCurrentQuantityChange() {
    // Manual input of current quantity
    if (this.currentQuantity < 0) this.currentQuantity = 0;
    if (this.currentQuantity > this.initialQuantity) this.currentQuantity = this.initialQuantity;

    // Calculate the previous current quantity to determine incremental usage
    const previousQuantity = this.item.currentQuantity !== undefined 
      ? this.item.currentQuantity 
      : this.item.quantity;
    
    this.amountToUse = previousQuantity - this.currentQuantity;
    this.calculatePercentages();
  }

  onAmountUsedChange() {
    // Manual input of amount used (incremental)
    const previousQuantity = this.item.currentQuantity !== undefined 
      ? this.item.currentQuantity 
      : this.item.quantity;
    
    if (this.amountToUse < 0) this.amountToUse = 0;
    if (this.amountToUse > previousQuantity) this.amountToUse = previousQuantity;

    this.currentQuantity = previousQuantity - this.amountToUse;
    this.calculatePercentages();
  }

  calculatePercentages() {
    if (this.initialQuantity > 0) {
      this.percentageRemaining = (this.currentQuantity / this.initialQuantity) * 100;
      this.percentageUsed = 100 - this.percentageRemaining;
    } else {
      this.percentageRemaining = 0;
      this.percentageUsed = 100;
    }
  }

  getProgressBarColor(): string {
    if (this.percentageRemaining > 50) return 'primary'; // Green
    if (this.percentageRemaining > 20) return 'accent'; // Orange
    return 'warn'; // Red
  }

  onMarkAsEmpty() {
    const previousQuantity = this.item.currentQuantity !== undefined 
      ? this.item.currentQuantity 
      : this.item.quantity;
    
    this.currentQuantity = 0;
    this.amountToUse = previousQuantity; // Use all remaining quantity
    this.percentageRemaining = 0;
    this.percentageUsed = 100;
  }

  onSave() {
    const result: UpdateUsageDialogResult = {
      amountUsed: this.amountToUse,
      remainingAmount: this.currentQuantity,
      notes: this.usageNotes.trim(),
      markedAsEmpty: this.currentQuantity === 0
    };

    this.dialogRef.close(result);
  }

  onCancel() {
    this.dialogRef.close();
  }

  formatLabel(value: number): string {
    return `${Math.round(value)}%`;
  }

  isLowStock(): boolean {
    return this.percentageRemaining <= 20 && this.percentageRemaining > 0;
  }

  async onAddToShoppingList() {
    if (!this.item.userId) {
      this.snackBar.open('User not found', 'Close', { duration: 3000 });
      return;
    }

    try {
      const shoppingItem: ShoppingListItem = {
        userId: this.item.userId,
        name: this.item.name,
        quantity: `${this.initialQuantity} ${this.item.unit}`,
        notes: `Low stock (${this.percentageRemaining.toFixed(0)}% remaining)`,
        categoryId: this.item.categoryId,
        isPurchased: false
      };

      await this.shoppingListService.addItem(shoppingItem);
      this.snackBar.open(`${this.item.name} added to shopping list`, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      this.snackBar.open('Failed to add to shopping list', 'Close', { duration: 3000 });
    }
  }
}
