import { inject, Injectable } from '@angular/core';
import { ApiClient, ApiClientError } from '../core/api-client.service';

export interface ReceiptItem {
  name: string;
  quantity?: number;
  unit?: string;
  price?: number;
  // Legacy aliases used by the existing receipt-scan component.
  totalPrice?: number;
  categoryHint?: string;
  shelfLifeDaysHint?: number;
}

export interface ReceiptParseResult {
  items: ReceiptItem[];
}

// Conservative defaults the receipt-scan UI uses when the AI doesn't return a
// shelf-life hint. Identical to the values previously hardcoded in the SQLite
// version of this service.
const DEFAULT_EXPIRY_DAYS: Record<string, number> = {
  dairy: 14,
  produce: 7,
  meat: 3,
  seafood: 2,
  frozen: 90,
  pantry: 365,
  beverages: 90,
  snacks: 60,
  condiments: 180,
  bakery: 7,
  fruit: 7,
  other: 30,
};

@Injectable({ providedIn: 'root' })
export class ReceiptScanService {
  private readonly api = inject(ApiClient);

  getDefaultExpiryDays(categoryHint?: string | null): number {
    if (!categoryHint) return DEFAULT_EXPIRY_DAYS['other'];
    return DEFAULT_EXPIRY_DAYS[categoryHint.toLowerCase()] ?? DEFAULT_EXPIRY_DAYS['other'];
  }

  // The image must already exist in Supabase Storage (use ImageService.uploadFile
  // with scope 'receipts' first). The server fetches the object via its
  // service-role credentials before forwarding to the AI provider.
  //
  // The return value is an Array of items but also exposes a `.items` property
  // (it carries the same array) so callers can use whichever shape they
  // prefer; this dual access pattern is verified by the unit spec.
  async parseReceipt(imagePath: string): Promise<ReceiptParseResult & ReceiptItem[]> {
    try {
      const result = await this.api.post<ReceiptParseResult>('/api/ai/receipt-scan', {
        imagePath,
      });
      const items = result?.items ?? [];
      const hybrid = items.slice() as ReceiptItem[] & { items: ReceiptItem[] };
      hybrid.items = items;
      return hybrid as ReceiptParseResult & ReceiptItem[];
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        throw new Error(
          'You have reached this month\'s receipt-scan limit. Please try again next month.',
        );
      }
      throw new Error('The receipt scanner is unavailable right now.');
    }
  }
}
