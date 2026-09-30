import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { InventoryItem } from '../models/inventory.model';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';
import { InventoryService } from './inventory.service';
import { NotificationService } from './notification.service';
import {
  UpdateUsageDialog,
  UpdateUsageDialogResult,
} from '../components/update-usage-dialog/update-usage-dialog';
import { EmptyItemConfirmationDialog } from '../components/inventory-list/empty-item-confirmation-dialog.component';
import { RefillDialogComponent } from '../components/inventory-list/refill-dialog.component';

const LOW_STOCK_PERCENTAGE = 20;

/**
 * Shared "track usage" flow (dialog -> usage update -> empty-item
 * handling -> low-stock notification) used by both the inventory list and the
 * dashboard so the two entry points behave identically.
 *
 * Every method resolves to `true` when inventory data changed and callers
 * should reload, `false` otherwise (cancelled, nothing to do, or failed —
 * failures are already reported to the user).
 */
@Injectable({ providedIn: 'root' })
export class UsageTrackingService {
  constructor(
    private dialog: MatDialog,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private errorHandler: ErrorHandlerService,
  ) {}

  async trackUsage(item: InventoryItem): Promise<boolean> {
    const result: UpdateUsageDialogResult | undefined = await firstValueFrom(
      this.dialog
        .open(UpdateUsageDialog, { width: '500px', maxWidth: '95vw', data: { item } })
        .afterClosed(),
    );
    if (!result) return false;

    try {
      const applied = await this.applyUsage(item, result);
      if (!applied) {
        this.errorHandler.showWarning('Failed to update usage');
        return false;
      }

      if (item.initialQuantity && item.initialQuantity > 0) {
        const percentage = (result.remainingAmount / item.initialQuantity) * 100;
        if (percentage <= LOW_STOCK_PERCENTAGE && percentage > 0) {
          await this.notificationService.checkAndNotifyLowStock(item.id!, item.name, percentage);
        }
      }

      this.errorHandler.showSuccess('✓ Usage updated successfully');
    } catch (error) {
      this.errorHandler.handleDataError('update usage', error);
      return false;
    }

    // The usage is now saved. If that emptied the item, ask what to do with it.
    if (result.markedAsEmpty || result.remainingAmount === 0) {
      await this.handleEmptyItem({ ...item, currentQuantity: 0 });
    }
    return true;
  }

  async refillItem(item: InventoryItem): Promise<boolean> {
    const userId = await this.authService.getUserId();
    if (!userId || !item.id) return false;

    const currentQuantity = item.currentQuantity ?? item.quantity;

    const result = await firstValueFrom(
      this.dialog
        .open(RefillDialogComponent, {
          width: '90%',
          maxWidth: '500px',
          data: { item, currentQuantity, userId },
        })
        .afterClosed(),
    );
    if (!result) return false;

    try {
      const newQuantity =
        result.mode === 'replace' ? result.quantity : currentQuantity + result.quantity;

      const updated = await this.inventoryService.updateItem({
        ...item,
        quantity: newQuantity,
        currentQuantity: newQuantity,
        initialQuantity:
          result.mode === 'replace'
            ? newQuantity
            : Math.max(item.initialQuantity ?? 0, newQuantity),
        expirationDate: result.expirationDate || item.expirationDate,
        purchaseDate: result.purchaseDate,
        price: result.price || item.price,
      });
      if (!updated) throw new Error('Failed to save refill');

      this.errorHandler.showSuccess(`✓ Refilled ${item.name}`);
      return true;
    } catch (error) {
      this.errorHandler.handleDataError('refill item', error);
      return false;
    }
  }

  /** Asks whether an emptied item should be refilled or removed. */
  async handleEmptyItem(item: InventoryItem): Promise<boolean> {
    const action: 'refill' | 'remove' | null | undefined = await firstValueFrom(
      this.dialog
        .open(EmptyItemConfirmationDialog, {
          width: '400px',
          maxWidth: '95vw',
          data: { itemName: item.name },
        })
        .afterClosed(),
    );

    if (action === 'refill') {
      return this.refillItem(item);
    }
    if (action === 'remove') {
      try {
        await this.inventoryService.deleteItem(item.id!);
        this.errorHandler.showSuccess('✓ Item removed successfully');
        return true;
      } catch (error) {
        this.errorHandler.handleDataError('remove item', error);
        return false;
      }
    }
    return false;
  }

  private async applyUsage(item: InventoryItem, result: UpdateUsageDialogResult): Promise<boolean> {
    return this.inventoryService.updateItemUsage(
      item.id!,
      result.remainingAmount,
      result.amountUsed,
      result.notes,
    );
  }
}
