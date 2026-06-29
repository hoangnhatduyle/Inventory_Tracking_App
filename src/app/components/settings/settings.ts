import { Component, OnInit, inject } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';

import { MatButtonModule } from '@angular/material/button';

import { MatIconModule } from '@angular/material/icon';

import { MatListModule } from '@angular/material/list';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatInputModule } from '@angular/material/input';

import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MatDividerModule } from '@angular/material/divider';

import { MatExpansionModule } from '@angular/material/expansion';

import { MatTooltipModule } from '@angular/material/tooltip';

import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from '../../services/auth.service';

import { InventoryService } from '../../services/inventory.service';

import { StatisticsService } from '../../services/statistics.service';

import { NotificationService } from '../../services/notification.service';

import { Category, Location } from '../../models/inventory.model';

import { LocationDialogComponent } from './location-dialog.component';

import { CategoryDialogComponent } from './category-dialog.component';

import { toLocalDateString } from '../../utils/date.utils';

@Component({
  selector: 'app-settings',

  imports: [
    CommonModule,

    FormsModule,

    MatCardModule,

    MatButtonModule,

    MatIconModule,

    MatListModule,

    MatDialogModule,

    MatFormFieldModule,

    MatInputModule,

    MatSlideToggleModule,

    MatSnackBarModule,

    MatDividerModule,

    MatExpansionModule,

    MatTooltipModule,

    MatTabsModule,
  ],

  templateUrl: './settings.html',

  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly router = inject(Router);

  private readonly authService = inject(AuthService);

  private readonly inventoryService = inject(InventoryService);

  private readonly statisticsService = inject(StatisticsService);

  private readonly notificationService = inject(NotificationService);

  private readonly dialog = inject(MatDialog);

  private readonly snackBar = inject(MatSnackBar);

  locations: Location[] = [];

  categories: Category[] = [];

  userId: string | null = null;

  currentUser: { id?: string; email?: string; username?: string; createdAt?: string } | null = null;

  pushSupported = false;

  pushSubscribed = false;

  async ngOnInit() {
    this.userId = await this.authService.getCurrentUserId();

    this.currentUser = await this.authService.getCurrentUser();

    this.pushSupported = this.notificationService.isSupported();

    if (this.userId) {
      await Promise.all([this.loadLocations(), this.loadCategories()]);
    }

    this.pushSubscribed = await this.notificationService.isSubscribed();
  }

  async loadLocations() {
    if (!this.userId) return;

    this.locations = await this.inventoryService.getLocations();
  }

  async loadCategories() {
    if (!this.userId) return;

    this.categories = await this.inventoryService.getCategories();
  }

  openAddCategoryDialog() {
    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '400px',

      data: { category: null },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadCategories();

        this.showMessage('Category added successfully');
      }
    });
  }

  openEditCategoryDialog(category: Category) {
    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '400px',

      data: { category },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadCategories();

        this.showMessage('Category updated successfully');
      }
    });
  }

  async deleteCategory(category: Category) {
    if (!category.id || category.isSystem) return;

    if (!confirm(`Delete category "${category.name}"? Items using it will need to be updated.`)) {
      return;
    }

    const success = await this.inventoryService.deleteCategory(category.id);

    if (success) {
      await this.loadCategories();

      this.showMessage('Category deleted successfully');
    } else {
      this.showMessage('Failed to delete category');
    }
  }

  openAddLocationDialog() {
    const dialogRef = this.dialog.open(LocationDialogComponent, {
      width: '400px',

      data: { location: null, userId: this.userId },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadLocations();

        this.showMessage('Location added successfully');
      }
    });
  }

  openEditLocationDialog(location: Location) {
    const dialogRef = this.dialog.open(LocationDialogComponent, {
      width: '400px',

      data: { location, userId: this.userId },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadLocations();

        this.showMessage('Location updated successfully');
      }
    });
  }

  async deleteLocation(location: Location) {
    if (!location.id) return;

    if (
      !confirm(
        `Delete location "${location.name}"? Items using this location will need to be updated.`,
      )
    ) {
      return;
    }

    const success = await this.inventoryService.deleteLocation(location.id);

    if (success) {
      await this.loadLocations();

      this.showMessage('Location deleted successfully');
    } else {
      this.showMessage('Failed to delete location');
    }
  }

  async exportInventory() {
    if (!this.userId) return;

    try {
      const items = await this.inventoryService.getItems();

      if (!items?.length) {
        this.showMessage('No items to export');

        return;
      }

      const csv = this.statisticsService.buildInventoryCsv(items);

      const fileName = `inventory_export_${toLocalDateString(new Date())}.csv`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;

      a.download = fileName;

      a.click();

      URL.revokeObjectURL(url);

      this.showMessage('Inventory exported');
    } catch (err) {
      console.error('Export error', err);

      this.showMessage('Export failed');
    }
  }

  async enableNotifications() {
    const granted = await this.notificationService.requestPermissions();

    this.pushSubscribed = await this.notificationService.isSubscribed();

    if (granted) {
      this.showMessage('Push notifications enabled');
    } else {
      this.showMessage('Could not enable push notifications');
    }
  }

  async disableNotifications() {
    await this.notificationService.unsubscribe();

    this.pushSubscribed = false;

    this.showMessage('Push notifications disabled');
  }

  async sendTestNotification() {
    const ok = await this.notificationService.sendTestNotification();

    this.showMessage(ok ? 'Test notification sent' : 'Failed to send test notification');
  }

  getLocationDisplay(location: Location): string {
    return location.subLocation ? `${location.name} - ${location.subLocation}` : location.name;
  }

  async signOut() {
    await this.notificationService.unsubscribe();
    await this.authService.logout();
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,

      horizontalPosition: 'center',

      verticalPosition: 'top',
    });
  }
}
