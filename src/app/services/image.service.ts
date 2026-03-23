import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  constructor() { }

  async takePicture(): Promise<string | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });

      return await this.saveImage(photo);
    } catch (error) {
      console.error('Error taking picture:', error);
      return null;
    }
  }

  async selectFromGallery(): Promise<string | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos
      });

      return await this.saveImage(photo);
    } catch (error) {
      console.error('Error selecting image:', error);
      return null;
    }
  }

  private async saveImage(photo: Photo): Promise<string | null> {
    try {
      if (!photo.webPath) {
        return null;
      }

      // Ensure directory exists (suppress error if already exists)
      try {
        await Filesystem.mkdir({
          path: 'inventory_images',
          directory: Directory.Data,
          recursive: true
        });
      } catch (mkdirErr) {
        // Directory already exists or permission issue
        // Log for debugging but don't throw—try to proceed
        const errMsg = (mkdirErr as any)?.message || String(mkdirErr);
        if (!errMsg.toLowerCase().includes('exists')) {
          console.warn('Directory creation warning (will retry on write):', mkdirErr);
        }
      }

      const ext = photo.format || 'jpg';
      const fileName = `inventory_${new Date().getTime()}.${ext}`;

      // Read the image as base64 (may return a data URI)
      const base64Data = await this.readAsBase64(photo);

      // If base64Data is a data URI like "data:image/jpeg;base64,AAA...", strip the prefix
      const base64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

      // Save to filesystem (data must be raw base64)
      await Filesystem.writeFile({
        path: `inventory_images/${fileName}`,
        data: base64,
        directory: Directory.Data
      });

      // Return relative path for use with getImageUrl
      return `inventory_images/${fileName}`;
    } catch (error) {
      console.error('Error saving image:', error);
      return null;
    }
  }

  private async readAsBase64(photo: Photo): Promise<string> {
    if (photo.base64String) {
      return photo.base64String;
    }

    // Fetch the photo, read as a blob, then convert to base64
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();

    return await this.convertBlobToBase64(blob) as string;
  }

  private convertBlobToBase64(blob: Blob): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
  }

  async deleteImage(imagePath: string): Promise<boolean> {
    await Filesystem.deleteFile({
      path: imagePath,
      directory: Directory.Data
    });
    return true;
  }

  async getImageUrl(imagePath: string): Promise<string> {
    try {
      // Read the file as base64
      const file = await Filesystem.readFile({
        path: imagePath,
        directory: Directory.Data
      });

      // file.data is either a string (base64) or Blob
      let base64Data: string;
      if (typeof file.data === 'string') {
        base64Data = file.data;
      } else {
        // If it's a Blob, convert to base64
        base64Data = await this.convertBlobToBase64(file.data as unknown as Blob) as string;
      }

      // Determine MIME type from file extension
      const mimeType = this.getMimeTypeFromPath(imagePath);
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      console.error('Error reading image:', error);
      return '';
    }
  }

  getMimeTypeFromPath(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop() || 'jpg';
    const mimeMap: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp'
    };
    return mimeMap[ext] || 'image/jpeg';
  }
}
