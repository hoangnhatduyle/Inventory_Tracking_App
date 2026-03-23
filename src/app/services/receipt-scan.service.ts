import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { ApiConfigService } from './api-config.service';
import { toLocalDateString } from '../utils/date.utils';

export interface ReceiptItem {
  name: string;
  totalPrice: number | null;
  unitPrice: number | null;
  quantity: number;
  categoryHint: string;
}

const DEFAULT_EXPIRY_DAYS: Record<string, number> = {
  'Dairy': 14,
  'Produce': 7,
  'Meat': 5,
  'Seafood': 3,
  'Frozen': 180,
  'Pantry': 365,
  'Beverages': 365,
  'Snacks': 180,
  'Household': 3650,
  'Other': 30
};

const RECEIPT_PARSE_PROMPT = `You are a grocery receipt parser. Extract all purchasable grocery/household items from this receipt image.
For each line item, return a JSON array:
[{
  "name": "cleaned item name (expand abbreviations, e.g. MINICOOKIE → Mini Cookies)",
  "total_price": total price for that line as a number (null if not visible),
  "unit_price": unit price if determinable (null if not),
  "quantity": quantity if visible as a number (default 1),
  "category_hint": one of: Dairy, Produce, Meat, Seafood, Frozen, Pantry, Beverages, Snacks, Household, Other
}]
Ignore non-item lines (subtotal, tax, total, savings, store info, payment info).
Return ONLY the JSON array, no other text.`;

@Injectable({
  providedIn: 'root'
})
export class ReceiptScanService {
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly MODEL = 'gpt-5-mini';
  private readonly MONTHLY_LIMIT = 1000; // Same limit as expiration AI service

  constructor(
    private databaseService: DatabaseService,
    private apiConfigService: ApiConfigService
  ) {}

  getDefaultExpiryDays(categoryHint: string): number {
    return DEFAULT_EXPIRY_DAYS[categoryHint] ?? DEFAULT_EXPIRY_DAYS['Other'];
  }

  /**
   * Check if user has reached their monthly receipt scan limit
   */
  private async checkRateLimit(userId: number): Promise<{ allowed: boolean; usage: number; limit: number }> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayStr = toLocalDateString(firstDayOfMonth);

      // Query usage for current month (only count successful requests where itemCount > 0)
      const result = await this.databaseService.query(
        `SELECT COUNT(*) as count FROM ai_usage_log WHERE user_id = ? AND request_type = 'receipt_scan' AND created_at >= ? AND response_days IS NOT NULL`,
        [userId, firstDayStr]
      );

      const usage = result.values?.[0]?.count || 0;
      const allowed = usage < this.MONTHLY_LIMIT;

      return { allowed, usage, limit: this.MONTHLY_LIMIT };
    } catch (error) {
      console.error('Error checking receipt scan rate limit:', error);
      return { allowed: true, usage: 0, limit: this.MONTHLY_LIMIT }; // Allow on error
    }
  }

  async parseReceipt(base64Image: string, userId: number): Promise<ReceiptItem[]> {
    // Check rate limit
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Monthly receipt scan limit reached (${rateLimitCheck.limit} scans/month). Try again next month.`);
    }

    if (!this.apiConfigService.hasOpenaiApiKey()) {
      throw new Error('Please configure your OpenAI API key in Settings → Features → API Configuration');
    }

    const apiKey = this.apiConfigService.getOpenaiApiKey();

    try {
      const response = await fetch(this.OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: RECEIPT_PARSE_PROMPT },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_completion_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || response.statusText;
        // Surface a clear message if the model doesn't support vision
        if (response.status === 400 && msg.toLowerCase().includes('image')) {
          throw new Error(`The model ${this.MODEL} does not support image input. Please check your OpenAI account.`);
        }
        throw new Error(`OpenAI API error: ${response.status} - ${msg}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI API');
      }

      const items = this.parseResponse(content);
      await this.logUsage(userId, items.length);
      return items;
    } catch (error) {
      console.error('[ReceiptScanService] parseReceipt failed:', error);
      await this.logUsage(userId, 0);
      throw error;
    }
  }

  private parseResponse(content: string): ReceiptItem[] {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not find item list in AI response. Try a clearer photo.');
    }

    const parsed = JSON.parse(jsonMatch[0]) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('No items found on receipt. Try a clearer photo.');
    }

    return parsed.map((item: any) => ({
      name: String(item.name || 'Unknown Item').trim(),
      totalPrice: typeof item.total_price === 'number' ? item.total_price : null,
      unitPrice: typeof item.unit_price === 'number' ? item.unit_price : null,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? Math.round(item.quantity) : 1,
      categoryHint: DEFAULT_EXPIRY_DAYS[item.category_hint] !== undefined ? item.category_hint : 'Other'
    }));
  }

  private async logUsage(userId: number, itemCount: number): Promise<void> {
    try {
      await this.databaseService.run(
        `INSERT INTO ai_usage_log (user_id, request_type, item_name, response_days, response_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, 'receipt_scan', `receipt (${itemCount} items)`, itemCount > 0 ? 1 : null, null, new Date().toISOString()]
      );
    } catch (err) {
      console.error('[ReceiptScanService] logUsage failed:', err);
    }
  }
}
