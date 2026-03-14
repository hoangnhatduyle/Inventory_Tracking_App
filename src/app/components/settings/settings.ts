import { Component, OnInit } from '@angular/core';
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
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { StatisticsService } from '../../services/statistics.service';
import { NotificationService } from '../../services/notification.service';
import { PinService } from '../../services/pin.service';
import { Location } from '../../models/inventory.model';
import { LocationDialogComponent } from './location-dialog.component';
import { PinDialogComponent } from './pin-dialog.component';
import { DataBrowserComponent } from './data-browser.component';
import { ConsoleViewerComponent } from './console-viewer.component';
import { ImageStorageBrowserComponent } from './image-storage-browser.component';
import { ConsoleLoggerService } from '../../services/console-logger.service';
import { DatabaseService } from '../../services/database.service';
import { ApiConfigService } from '../../services/api-config.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { toLocalDateString } from '../../utils/date.utils';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

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
    DataBrowserComponent,
    ConsoleViewerComponent,
    ImageStorageBrowserComponent
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  locations: Location[] = [];
  userId: number | null = null;
  currentUser: any = null;
  notificationsEnabled = true;

  // PIN protection state
  isAdminUnlocked = false;
  isPinSet = false;

  // API configuration
  openaiApiKey = '';
  showApiKeyInput = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private inventoryService: InventoryService,
    private statisticsService: StatisticsService,
    private notificationService: NotificationService,
    private consoleLogger: ConsoleLoggerService,
    private pinService: PinService,
    private databaseService: DatabaseService,
    public apiConfigService: ApiConfigService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  async ngOnInit() {
    this.userId = await this.authService.getCurrentUserId();
    this.currentUser = await this.authService.getCurrentUser();
    this.isPinSet = await this.pinService.isPinSet();
    // Load current API key
    this.openaiApiKey = this.apiConfigService.getOpenaiApiKey();
    if (this.userId) {
      await this.loadLocations();
    }
  }

  async loadLocations() {
    if (!this.userId) return;
    this.locations = await this.inventoryService.getLocations(this.userId);
  }

  openAddLocationDialog() {
    const dialogRef = this.dialog.open(LocationDialogComponent, {
      width: '400px',
      data: { location: null, userId: this.userId }
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
      data: { location, userId: this.userId }
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

    if (confirm(`Delete location "${location.name}"? Items using this location will need to be updated.`)) {
      const success = await this.inventoryService.deleteLocation(location.id);
      if (success) {
        await this.loadLocations();
        this.showMessage('Location deleted successfully');
      } else {
        this.showMessage('Failed to delete location');
      }
    }
  }

  navigateToRecipeManager() {
    this.router.navigate(['/recipe-manager']);
  }

  async exportInventory() {
    if (!this.userId) return;

    try {
      const csv = await this.statisticsService.exportInventoryData(this.userId);
      if (!csv) {
        this.showMessage('No data to export');
        return;
      }

      const fileName = `inventory_export_${toLocalDateString(new Date())}.csv`;

      // Check if running on native platform
      if (Capacitor.isNativePlatform()) {
        // Save to device's Documents or Downloads directory
        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: csv,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });

          console.log('File saved to:', result.uri);
          this.showMessage(`✓ File saved to Documents folder: ${fileName}`);
        } catch (fsError) {
          console.error('Filesystem error:', fsError);
          // Fallback to browser download
          this.downloadAsBrowser(csv, fileName);
        }
      } else {
        // Web browser - use standard download
        this.downloadAsBrowser(csv, fileName);
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showMessage('Error exporting data');
    }
  }

  private downloadAsBrowser(csv: string, fileName: string) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    this.showMessage('✓ Data exported successfully!');
  }

  async exportSQLiteDatabase(): Promise<void> {
    this.showMessage('Preparing backup export...');
    try {
      const EXPORT_TABLES = [
        'users', 'categories', 'locations', 'inventory_items',
        'inventory_batches', 'item_images', 'usage_history', 'shopping_list',
        'wasted_items', 'barcode_mappings', 'notification_log', 'recipes', 'ai_usage_log'
      ];

      const backupData: Record<string, any[]> = {};
      for (const tableName of EXPORT_TABLES) {
        let allRows: any[] = [];
        let page = 1;
        while (true) {
          const { rows } = await this.databaseService.getTableData(tableName, page, 1000, '');
          if (rows.length === 0) break;
          allRows = allRows.concat(rows);
          if (rows.length < 1000) break;
          page++;
        }
        backupData[tableName] = allRows;
      }

      const jsonData = JSON.stringify(backupData, null, 2);
      const fileName = `chatciu_backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: fileName, data: jsonData, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: 'Database Backup', url: uri, dialogTitle: 'Save backup file' });
      } else {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
      }

      this.showMessage('Database exported successfully!');
    } catch (error) {
      console.error('Backup export failed:', error);
      this.showMessage('Export failed: ' + (error as Error).message);
    }
  }

  importSQLiteDatabase(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.db,.sqlite';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!confirm('This will REPLACE all existing data with the backup. Are you sure?')) return;
      if (!confirm('Second confirmation: All current data will be deleted. This cannot be undone.')) return;

      try {
        this.showMessage('Restoring from backup...');

        const fileContent = await file.text();
        const backupData = JSON.parse(fileContent) as Record<string, any[]>;

        const TABLE_ORDER = [
          'users', 'categories', 'locations', 'inventory_items',
          'inventory_batches', 'item_images', 'usage_history', 'shopping_list',
          'wasted_items', 'barcode_mappings', 'notification_log', 'recipes', 'ai_usage_log'
        ];

        for (const tableName of TABLE_ORDER) {
          const rows = backupData[tableName];
          if (!rows || rows.length === 0) {
            await this.databaseService.clearTable(tableName);
            continue;
          }

          await this.databaseService.clearTable(tableName);
          for (const row of rows) {
            await this.databaseService.insertTableRow(tableName, row);
          }
        }

        this.showMessage('Database restored! Logging out in 2 seconds...');
        setTimeout(() => this.authService.logout(), 2000);
      } catch (error) {
        console.error('Backup import failed:', error);
        this.showMessage('Restore failed: ' + (error as Error).message);
      }
    };
    input.click();
  }

  async requestNotificationPermissions() {
    const granted = await this.notificationService.requestPermissions();
    if (granted) {
      this.notificationsEnabled = true;
      this.showMessage('Notification permissions granted');

      // Schedule notifications for existing items
      if (this.userId) {
        await this.notificationService.scheduleExpirationNotifications(this.userId);
        this.showMessage('Notifications scheduled for expiring items');
      }
    } else {
      this.showMessage('Notification permissions denied');
    }
  }

  async rescheduleNotifications() {
    if (!this.userId) return;

    await this.notificationService.scheduleExpirationNotifications(this.userId);
    this.showMessage('Notifications rescheduled successfully');
  }

  async viewPendingNotifications() {
    const pending = await this.notificationService.getPendingNotifications();
    this.showMessage(`Found ${pending.length} pending notification(s). Check console for details.`);
  }

  async scheduleTestNotification() {
    await this.notificationService.scheduleTestNotification(1);
    this.showMessage('Test notification scheduled for 1 minute from now. Check console for details.');
  }

  getLocationDisplay(location: Location): string {
    return location.subLocation
      ? `${location.name} - ${location.subLocation}`
      : location.name;
  }

  async unlockAdminSections() {
    const dialogRef = this.dialog.open(PinDialogComponent, {
      width: '400px',
      data: { isSettingPin: false, purpose: 'unlock' },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.isAdminUnlocked = true;
        this.showMessage('✓ Admin sections unlocked');
      }
    });
  }

  lockAdminSections() {
    this.isAdminUnlocked = false;
    this.showMessage('Admin sections locked');
  }

  async setupPin() {
    const dialogRef = this.dialog.open(PinDialogComponent, {
      width: '400px',
      data: { isSettingPin: true },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.isPinSet = true;
        this.showMessage('✓ PIN set successfully');
      }
    });
  }

  async changePin() {
    // Verify current PIN first
    const verifyDialogRef = this.dialog.open(PinDialogComponent, {
      width: '400px',
      data: { isSettingPin: false, purpose: 'change' },
      disableClose: true
    });

    verifyDialogRef.afterClosed().subscribe(async (verifyResult) => {
      if (verifyResult?.success) {
        // Current PIN verified, now get new PIN
        const newPinDialogRef = this.dialog.open(PinDialogComponent, {
          width: '400px',
          data: { isSettingPin: true, purpose: 'change' },
          disableClose: true
        });

        newPinDialogRef.afterClosed().subscribe((newPinResult) => {
          if (newPinResult?.success) {
            this.showMessage('✓ PIN changed successfully');
          }
        });
      }
    });
  }

  async removePin() {
    const dialogRef = this.dialog.open(PinDialogComponent, {
      width: '400px',
      data: { isSettingPin: false, purpose: 'remove' },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.success) {
        if (confirm('Remove PIN protection? Admin sections will be accessible to anyone.')) {
          await this.pinService.removePin();
          this.isPinSet = false;
          this.isAdminUnlocked = false;
          this.showMessage('PIN removed');
        }
      }
    });
  }

  saveOpenaiApiKey() {
    if (!this.openaiApiKey.trim()) {
      this.showMessage('Please enter an API key');
      return;
    }
    this.apiConfigService.setOpenaiApiKey(this.openaiApiKey);
    this.showMessage('OpenAI API key saved successfully');
    this.showApiKeyInput = false;
  }

  clearOpenaiApiKey() {
    if (confirm('Remove OpenAI API key? AI expiration suggestions will no longer work.')) {
      this.apiConfigService.clearOpenaiApiKey();
      this.openaiApiKey = '';
      this.showMessage('OpenAI API key removed');
    }
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
