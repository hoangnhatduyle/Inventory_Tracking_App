import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../core/api-client.service';

interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
  contentType: string;
  expiresIn: number;
}

interface SignedRead {
  url: string;
  expiresIn: number;
}

// Web port: images live in the private Supabase Storage bucket
// `inventory-images`. Upload flow is two-step:
//   1. Browser asks /api/uploads/sign for a one-shot signed upload URL.
//   2. Browser PUTs the file directly to Supabase Storage at that URL.
// Reads go through /api/uploads/read which returns a short-lived signed URL
// the browser can put in an <img src>.
//
// Resolves audit findings related to BYO-key OpenAI receipt upload (C3) and
// file upload validation (L1, L3) - all validation now happens server-side.
@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly api = inject(ApiClient);

  private readonly MAX_BYTES = 5 * 1024 * 1024;
  private readonly ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  // Open the device camera or file picker. If a File is already in hand the
  // caller can pass it directly; otherwise we pop a hidden <input> to acquire
  // one. Returns the Supabase Storage path the file was uploaded to.
  async takePicture(file?: File, scope: 'items' | 'receipts' = 'items'): Promise<string | null> {
    const f = file ?? (await this.pickFile('camera'));
    if (!f) return null;
    return this.uploadFile(f, scope);
  }

  async selectFromGallery(
    file?: File,
    scope: 'items' | 'receipts' = 'items',
  ): Promise<string | null> {
    const f = file ?? (await this.pickFile('gallery'));
    if (!f) return null;
    return this.uploadFile(f, scope);
  }

  private pickFile(source: 'camera' | 'gallery'): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      if (source === 'camera') input.setAttribute('capture', 'environment');
      input.style.display = 'none';
      input.onchange = () => {
        const f = input.files?.[0];
        document.body.removeChild(input);
        resolve(f ?? null);
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  async uploadFile(file: File, scope: 'items' | 'receipts'): Promise<string | null> {
    if (!this.ALLOWED_TYPES.has(file.type)) {
      throw new Error('Only JPEG, PNG and WebP images are supported.');
    }
    if (file.size > this.MAX_BYTES) {
      throw new Error('Image must be 5 MB or smaller.');
    }

    const ext = this.extFromType(file.type);
    const sign = await this.api.post<SignedUpload>('/api/uploads/sign', {
      scope,
      contentType: file.type,
      ext,
    });

    const res = await fetch(sign.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Upload failed (HTTP ${res.status})`);
    }
    return sign.path;
  }

  async deleteImage(_imagePath: string): Promise<boolean> {
    // The /api/inventory/:id/images endpoint handles deletion (both row + blob)
    // and is invoked by InventoryService.deleteItemImage. This stand-alone
    // method is no longer needed on the web; kept for compatibility.
    return true;
  }

  async getImageUrl(imagePath: string): Promise<string> {
    if (!imagePath) return '';
    try {
      const r = await this.api.get<SignedRead>('/api/uploads/read', {
        query: { path: imagePath },
      });
      return r?.url ?? '';
    } catch {
      return '';
    }
  }

  getMimeTypeFromPath(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop() ?? 'jpg';
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return map[ext] ?? 'image/jpeg';
  }

  private extFromType(type: string): 'jpg' | 'png' | 'webp' {
    switch (type) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'jpg';
    }
  }
}
