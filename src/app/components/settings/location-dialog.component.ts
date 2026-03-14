import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InventoryService } from '../../services/inventory.service';
import { Location } from '../../models/inventory.model';

@Component({
  selector: 'app-location-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.location ? 'Edit' : 'Add' }} Location</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Location Name</mat-label>
        <input matInput [(ngModel)]="locationName" placeholder="e.g., Fridge, Freezer, Pantry" required />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Sub-Location (Optional)</mat-label>
        <input matInput [(ngModel)]="subLocation" placeholder="e.g., Top Shelf, Drawer 2" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!locationName.trim()">
        {{ data.location ? 'Update' : 'Add' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    
    mat-dialog-content {
      min-width: 300px;
      padding: 20px 24px;
    }
  `]
})
export class LocationDialogComponent {
  locationName: string = '';
  subLocation: string = '';

  constructor(
    public dialogRef: MatDialogRef<LocationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { location: Location | null; userId: number },
    private inventoryService: InventoryService,
    private snackBar: MatSnackBar
  ) {
    if (data.location) {
      this.locationName = data.location.name;
      this.subLocation = data.location.subLocation || '';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  async onSave(): Promise<void> {
    if (!this.locationName.trim()) return;

    const location: Location = {
      userId: this.data.userId,
      name: this.locationName.trim(),
      subLocation: this.subLocation.trim() || undefined
    };

    let success = false;

    if (this.data.location && this.data.location.id) {
      // Update existing location
      location.id = this.data.location.id;
      success = await this.inventoryService.updateLocation(location);
    } else {
      // Add new location
      success = await this.inventoryService.addLocation(location);
    }

    if (success) {
      this.dialogRef.close(true);
    } else {
      this.snackBar.open('Failed to save location', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }
}
