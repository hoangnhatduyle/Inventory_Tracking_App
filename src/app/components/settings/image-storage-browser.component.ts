import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ImageService } from '../../services/image.service';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface StoredImage {
  path: string;
  name: string;
  url: string;
  size?: number;
  lastModified?: Date;
}

@Component({
  selector: 'app-image-storage-browser',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <div class="image-storage-browser">
      <div class="browser-header">
        <div class="header-info">
          <mat-icon>photo_library</mat-icon>
          <div>
            <h3>Image Storage</h3>
            <p class="storage-info">{{ images.length }} image(s) stored</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-raised-button (click)="refreshImages()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
          <button mat-raised-button color="warn" (click)="deleteAllImages()" [disabled]="images.length === 0">
            <mat-icon>delete_sweep</mat-icon>
            Delete All
          </button>
        </div>
      </div>

      @if (isLoading) {
      <div class="loading-state">
        <p>Loading images...</p>
      </div>
      }

      @if (!isLoading && images.length === 0) {
      <div class="empty-state">
        <mat-icon>image_not_supported</mat-icon>
        <p>No images in storage</p>
        <p class="hint">Images captured from camera or gallery will appear here</p>
      </div>
      }

      @if (!isLoading && images.length > 0) {
      <div class="images-grid">
        @for (image of images; track image.path) {
        <div class="image-card">
          <div class="image-preview" (click)="viewImage(image)">
            <img [src]="image.url" [alt]="image.name">
            <div class="image-overlay">
              <mat-icon>zoom_in</mat-icon>
            </div>
          </div>
          <div class="image-info">
            <div class="image-name" [matTooltip]="image.name">{{ image.name }}</div>
            <div class="image-actions">
              <button mat-icon-button (click)="viewImage(image)" matTooltip="View">
                <mat-icon>visibility</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteImage(image)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [`
    .image-storage-browser {
      padding: 1rem 0;
    }

    .browser-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 1rem;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #1976d2;
      }

      h3 {
        margin: 0;
        font-size: 1.25rem;
      }

      .storage-info {
        margin: 0;
        color: #666;
        font-size: 0.875rem;
      }
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
    }

    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
      color: #666;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      .hint {
        font-size: 0.875rem;
        margin-top: 0.5rem;
      }
    }

    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
    }

    .image-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      transition: box-shadow 0.2s;

      &:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
    }

    .image-preview {
      position: relative;
      width: 100%;
      height: 150px;
      overflow: hidden;
      cursor: pointer;
      background: #f5f5f5;

      img {
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
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;

        mat-icon {
          color: white;
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }

      &:hover .image-overlay {
        opacity: 1;
      }
    }

    .image-info {
      padding: 0.5rem;
      background: white;
    }

    .image-name {
      font-size: 0.75rem;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.25rem;
    }

    .image-actions {
      display: flex;
      justify-content: space-between;
    }
  `]
})
export class ImageStorageBrowserComponent implements OnInit {
  images: StoredImage[] = [];
  isLoading = false;

  constructor(
    private imageService: ImageService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  async ngOnInit() {
    await this.refreshImages();
  }

  async refreshImages() {
    this.isLoading = true;
    this.images = [];

    try {
      // First, try to read from the inventory_images subdirectory
      try {
        const result = await Filesystem.readdir({
          path: 'inventory_images',
          directory: Directory.Data
        });

        console.log('Files in inventory_images:', result.files);

        // Filter for image files
        const imageFiles = result.files.filter(file => 
          file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        );

        // Load image URLs
        for (const file of imageFiles) {
          try {
            const fullPath = `inventory_images/${file.name}`;
            const url = await this.imageService.getImageUrl(fullPath);
            this.images.push({
              path: fullPath,
              name: file.name,
              url: url
            });
          } catch (error) {
            console.error(`Error loading image ${file.name}:`, error);
          }
        }
      } catch (dirError) {
        console.log('No inventory_images directory found, checking root directory');
        
        // Fallback: check root directory
        try {
          const result = await Filesystem.readdir({
            path: '',
            directory: Directory.Data
          });

          console.log('Files in root storage:', result.files);

          const imageFiles = result.files.filter(file => 
            file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          );

          for (const file of imageFiles) {
            try {
              const url = await this.imageService.getImageUrl(file.name);
              this.images.push({
                path: file.name,
                name: file.name,
                url: url
              });
            } catch (error) {
              console.error(`Error loading image ${file.name}:`, error);
            }
          }
        } catch (rootError) {
          console.error('Error reading root directory:', rootError);
        }
      }

      console.log(`Loaded ${this.images.length} images total`);
    } catch (error) {
      console.error('Error loading images:', error);
      this.snackBar.open('Failed to load images', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  async deleteImage(image: StoredImage) {
    if (!confirm(`Delete image "${image.name}"?\n\nThis will remove the file from storage. Any items referencing this image will lose their image.`)) {
      return;
    }

    try {
      await Filesystem.deleteFile({
        path: image.path,
        directory: Directory.Data
      });

      this.snackBar.open('Image deleted', 'Close', { duration: 2000 });
      await this.refreshImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      this.snackBar.open('Failed to delete image', 'Close', { duration: 3000 });
    }
  }

  async deleteAllImages() {
    if (!confirm(`Delete all ${this.images.length} images?\n\nThis cannot be undone and items will lose their images.`)) {
      return;
    }

    let deleted = 0;
    let failed = 0;

    for (const image of this.images) {
      try {
        await Filesystem.deleteFile({
          path: image.path,
          directory: Directory.Data
        });
        deleted++;
      } catch (error) {
        console.error(`Error deleting ${image.name}:`, error);
        failed++;
      }
    }

    this.snackBar.open(`Deleted ${deleted} image(s)${failed > 0 ? `, ${failed} failed` : ''}`, 'Close', { duration: 3000 });
    await this.refreshImages();
  }

  viewImage(image: StoredImage) {
    // Open image in a dialog
    this.dialog.open(ImageViewerDialog, {
      data: { image },
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'image-viewer-dialog'
    });
  }
}

// Simple image viewer dialog
@Component({
  selector: 'image-viewer-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="image-viewer">
      <div class="viewer-header">
        <h2>{{ data.image.name }}</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="viewer-content">
        <img [src]="data.image.url" [alt]="data.image.name">
      </div>
    </div>
  `,
  styles: [`
    .image-viewer {
      display: flex;
      flex-direction: column;
      max-width: 90vw;
      max-height: 90vh;
    }

    .viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #ddd;

      h2 {
        margin: 0;
        font-size: 1rem;
        word-break: break-all;
      }
    }

    .viewer-content {
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;

      img {
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
      }
    }
  `]
})
export class ImageViewerDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { image: StoredImage }) {}
}

import { Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
