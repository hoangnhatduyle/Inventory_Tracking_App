import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiClient } from '../core/api-client.service';
import { BarcodeMapping } from '../models/inventory.model';
import { BarcodeScannerDialogComponent } from '../components/barcode-scanner-dialog/barcode-scanner-dialog.component';

// Web port: native ML Kit barcode scanning is replaced with @zxing/browser.
// The scanner runs inside a MatDialog modal that owns the <video> element and
// stops the camera as soon as a code is decoded or the dialog closes.
@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private readonly api = inject(ApiClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  async requestPermissions(): Promise<boolean> {
    // Real permission prompts are handled implicitly by getUserMedia inside the
    // scanner dialog; this helper exists for API parity with the old service.
    return true;
  }

  async checkPermissions(): Promise<boolean> {
    return true;
  }

  async scanBarcode(): Promise<string | null> {
    const ref = this.dialog.open(BarcodeScannerDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
    });
    const result = await new Promise<string | null>((resolve) => {
      ref.afterClosed().subscribe((value) => resolve(value ?? null));
    });
    if (!result) {
      this.snackBar.open('Barcode scan cancelled', undefined, { duration: 2000 });
      return null;
    }
    return result;
  }

  async getBarcodeMapping(barcode: string): Promise<BarcodeMapping | null> {
    try {
      return await this.api.get<BarcodeMapping>(
        `/api/barcode-mappings/${encodeURIComponent(barcode)}`,
      );
    } catch {
      return null;
    }
  }

  async saveBarcodeMapping(mapping: BarcodeMapping): Promise<boolean> {
    try {
      await this.api.post('/api/barcode-mappings', mapping);
      return true;
    } catch {
      return false;
    }
  }

  async searchByBarcode(barcode: string): Promise<BarcodeMapping[]> {
    const m = await this.getBarcodeMapping(barcode);
    return m ? [m] : [];
  }
}
