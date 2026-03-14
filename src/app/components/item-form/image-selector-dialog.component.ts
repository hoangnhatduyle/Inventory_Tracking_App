import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

export interface ImageOption {
  imagePath: string;
  displayUrl: string;
}

export interface ImageSelectorDialogData {
  images: ImageOption[];
  itemName: string;
}

@Component({
  selector: 'app-image-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>image</mat-icon>
      Choose Image for {{ data.itemName }}
    </h2>
    <mat-dialog-content>
      <p class="subtitle">Select an image from previous items with this barcode:</p>
      <div class="image-grid">
        @for (image of data.images; track image.imagePath; let i = $index) {
        <div class="image-option"
             (click)="selectImage(image)">
          <img [src]="image.displayUrl" [alt]="'Option ' + (i + 1)">
          <div class="image-overlay">
            <mat-icon>check_circle</mat-icon>
          </div>
        </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <mat-icon>close</mat-icon>
        Cancel
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #6200ea;
      margin: 0;
      padding: 16px 24px;
    }

    .subtitle {
      color: rgba(0, 0, 0, 0.6);
      margin: 0 0 16px 0;
      font-size: 14px;
    }

    mat-dialog-content {
      padding: 0 24px 16px 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 16px;
    }

    .image-option {
      position: relative;
      aspect-ratio: 1;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .image-option:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(98, 0, 234, 0.3);
    }

    .image-option img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(98, 0, 234, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .image-option:hover .image-overlay {
      opacity: 1;
    }

    .image-overlay mat-icon {
      color: white;
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    mat-dialog-actions {
      padding: 8px 16px 16px 16px;
    }

    mat-dialog-actions button {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `]
})
export class ImageSelectorDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ImageSelectorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImageSelectorDialogData
  ) {}

  selectImage(image: ImageOption): void {
    this.dialogRef.close(image);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
