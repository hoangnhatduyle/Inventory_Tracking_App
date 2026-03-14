import { Injectable } from '@angular/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './database.service';
import { BarcodeMapping } from '../models/inventory.model';

@Injectable({
  providedIn: 'root'
})
export class BarcodeService {
  constructor(private db: DatabaseService) { }

  private async startScanAndWaitForResult(timeoutMs = 30000): Promise<string | null> {
    return new Promise<string | null>(async (resolve, reject) => {
      let timeoutId: any;
      let scanListener: any;
      let scanCancelledListener: any;
      
      const cleanup = async () => {
        if (timeoutId) clearTimeout(timeoutId);
        try { if (scanListener) await scanListener.remove(); } catch (ignore) { }
        try { if (scanCancelledListener) await scanCancelledListener.remove(); } catch (ignore) { }
        try { await BarcodeScanner.stopScan(); } catch (ignore) { }
      };
      
      try {
        scanListener = await BarcodeScanner.addListener('barcodesScanned', async (evt: any) => {
          await cleanup();
          const barcodeValue = evt?.barcodes && evt.barcodes.length > 0 ? evt.barcodes[0].rawValue : null;
          resolve(barcodeValue || null);
        });
        
        scanCancelledListener = await BarcodeScanner.addListener('scanError', async (error: any) => {
          console.info('[BarcodeService] Scan cancelled or error:', error);
          await cleanup();
          resolve(null);
        });
        
        await BarcodeScanner.startScan();
        
        timeoutId = setTimeout(async () => {
          await cleanup();
          resolve(null);
        }, timeoutMs);
      } catch (err) {
        await cleanup();
        reject(err);
      }
    });
  }

  async requestPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') {
      console.warn('Barcode scanner not available on web platform');
      return false;
    }

    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      return camera === 'granted' || camera === 'limited';
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') {
      return false;
    }

    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      return camera === 'granted' || camera === 'limited';
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  async scanBarcode(): Promise<string | null> {
    if (Capacitor.getPlatform() === 'web') {
      // For web testing, return a mock barcode
      const mockBarcode = prompt('Enter barcode for testing:');
      return mockBarcode;
    }

    try {
      // Check permissions first
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Camera permission denied');
        }
      }

      // Start scanning - handle Android's Google Barcode Scanner module installation & fallbacks
      if (Capacitor.getPlatform() === 'android') {
        try {
          const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          console.info('[BarcodeService] isGoogleBarcodeScannerModuleAvailable:', available);

          if (!available) {
            console.info('[BarcodeService] Google Barcode module not available, attempting runtime install');
            const installListener = await BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', ev => {
              console.info('[BarcodeService] googleBarcode install progress', ev);
            });

            let installed = false;
            try {
              await BarcodeScanner.installGoogleBarcodeScannerModule();
              // Wait for completion by polling the check or using a short timeout
              const timeoutMs = 15000;
              const start = Date.now();
              while (Date.now() - start < timeoutMs) {
                const p = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
                if (p.available) { installed = true; break; }
                // small delay
                await new Promise(res => setTimeout(res, 600));
              }
            } catch (installErr) {
              console.error('[BarcodeService] installGoogleBarcodeScannerModule failed:', installErr);
            } finally {
              try { await installListener.remove(); } catch (e) { /* ignore */ }
            }

            if (!installed) {
              console.warn('[BarcodeService] Google Barcode module not installed; falling back to startScan()');
              // fallback to a UI-based scan that does not rely on the Play Services module
              try {
                const fallbackBarcode = await this.startScanAndWaitForResult();
                console.info('[BarcodeService] startScan fallback returned barcode:', fallbackBarcode);
                if (fallbackBarcode) return fallbackBarcode;
              } catch (fallbackErr) {
                console.error('[BarcodeService] startScan fallback failed:', fallbackErr);
                throw new Error('Google Barcode module not available and startScan fallback failed');
              }
            }
          }
        } catch (modErr) {
          console.error('[BarcodeService] Error while ensuring Google Barcode module:', modErr);
          // Not blocking - proceed and let scan() throw a clear error if not possible
        }
      }

      try {
        const result = await BarcodeScanner.scan();
        if (result.barcodes && result.barcodes.length > 0) {
          return result.barcodes[0].rawValue;
        }
        return null;
      } catch (scanErr: any) {
        // Check if user cancelled the scan
        if (scanErr?.message && scanErr.message.toLowerCase().includes('cancel')) {
          console.info('[BarcodeService] Scan cancelled by user');
          return null;
        }
        
        // If scan() fails because the google module is still missing, try startScan() fallback
        console.warn('[BarcodeService] scan() failed, attempting startScan fallback:', scanErr);
        try {
          return await this.startScanAndWaitForResult();
        } catch (fallbackErr) {
          console.error('[BarcodeService] startScan fallback also failed:', fallbackErr);
          throw scanErr; // rethrow original error so caller can handle
        }
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      throw error;
    }
  }

  async getBarcodeMapping(barcode: string, userId: number): Promise<BarcodeMapping | null> {
    try {
      const query = `SELECT * FROM barcode_mappings WHERE barcode = ? AND user_id = ?`;
      const result = await this.db.query(query, [barcode, userId]);

      if (result.values && result.values.length > 0) {
        const row = result.values[0];
        return {
          id: row.id,
          barcode: row.barcode,
          itemName: row.item_name,
          categoryId: row.category_id,
          userId: row.user_id,
          createdAt: row.created_at,
          suggestedShelfLifeDays: row.suggested_shelf_life_days || null,
          aiNote: row.ai_note || null,
          price: row.price || null,
          imagePath: row.image_path || null,
          locationId: row.location_id || null
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting barcode mapping:', error);
      return null;
    }
  }

  async saveBarcodeMapping(mapping: BarcodeMapping): Promise<boolean> {
    try {
      const query = `
        INSERT INTO barcode_mappings (barcode, item_name, category_id, user_id, suggested_shelf_life_days, ai_note, price, image_path, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(barcode) DO UPDATE SET
          item_name = excluded.item_name,
          category_id = excluded.category_id,
          user_id = excluded.user_id,
          suggested_shelf_life_days = excluded.suggested_shelf_life_days,
          ai_note = excluded.ai_note,
          price = excluded.price,
          image_path = excluded.image_path,
          location_id = excluded.location_id
      `;

      await this.db.run(query, [
        mapping.barcode,
        mapping.itemName,
        mapping.categoryId,
        mapping.userId,
        mapping.suggestedShelfLifeDays || null,
        mapping.aiNote || null,
        mapping.price || null,
        mapping.imagePath || null,
        mapping.locationId || null
      ]);

      return true;
    } catch (error) {
      console.error('Error saving barcode mapping:', error);
      return false;
    }
  }

  async searchByBarcode(barcode: string, userId: number): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM inventory_items 
        WHERE barcode = ? AND user_id = ?
        ORDER BY created_at DESC
      `;
      const result = await this.db.query(query, [barcode, userId]);
      return result.values || [];
    } catch (error) {
      console.error('Error searching by barcode:', error);
      return [];
    }
  }
}
