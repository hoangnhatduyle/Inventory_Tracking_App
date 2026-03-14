import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { ApiConfigService } from './api-config.service';
import { toLocalDateString } from '../utils/date.utils';

export interface AIExpirationSuggestion {
  days: number;
  note: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpirationAIService {
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly MONTHLY_LIMIT = 1000;
  private readonly MODEL = 'gpt-4.1-mini'; // Cost-efficient model

  constructor(
    private databaseService: DatabaseService,
    private apiConfigService: ApiConfigService
  ) {}

  /**
   * Check if user has reached their monthly AI request limit
   */
  async checkRateLimit(userId: number): Promise<{ allowed: boolean; usage: number; limit: number }> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayStr = toLocalDateString(firstDayOfMonth);

      // Query usage for current month (only count successful requests where responseDays is not null)
      const result = await this.databaseService.query(
        `SELECT COUNT(*) as count FROM ai_usage_log WHERE user_id = ? AND created_at >= ? AND response_days IS NOT NULL`,
        [userId, firstDayStr]
      );

      const usage = result.values?.[0]?.count || 0;
      const allowed = usage < this.MONTHLY_LIMIT;

      return { allowed, usage, limit: this.MONTHLY_LIMIT };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true, usage: 0, limit: this.MONTHLY_LIMIT }; // Allow on error
    }
  }

  /**
   * Log AI usage to database
   */
  private async logUsage(
    userId: number,
    requestType: string,
    itemName: string,
    responseDays: number | null,
    responseNote: string | null
  ): Promise<void> {
    try {
      await this.databaseService.run(
        `INSERT INTO ai_usage_log (user_id, request_type, item_name, response_days, response_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, requestType, itemName, responseDays, responseNote, new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error logging AI usage:', error);
    }
  }

  /**
   * Get AI-suggested expiration date for an item
   */
  async suggestExpiration(
    itemName: string,
    purchaseDate: Date,
    storageLocation: string | null,
    userId: number
  ): Promise<AIExpirationSuggestion> {
    // Check rate limit
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Monthly AI request limit reached (${rateLimitCheck.limit} requests/month). Try again next month.`);
    }

    // Validate API key is configured
    if (!this.apiConfigService.hasOpenaiApiKey()) {
      throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
    }

    try {
      const prompt = this.buildPrompt(itemName, purchaseDate, storageLocation);
      const response = await this.callOpenAI(prompt);
      const suggestion = this.parseResponse(response);

      // Log usage
      await this.logUsage(userId, 'expiration_suggestion', itemName, suggestion.days, suggestion.note);

      return suggestion;
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      // Log failed attempt
      await this.logUsage(userId, 'expiration_suggestion_failed', itemName, null, null);
      throw error;
    }
  }

  /**
   * Build the prompt for OpenAI
   */
  private buildPrompt(itemName: string, purchaseDate: Date, storageLocation: string | null): string {
    const dateStr = toLocalDateString(purchaseDate); // YYYY-MM-DD format
    
    let storageConditions = '';
    if (storageLocation) {
      // Try to infer storage type from location name
      const locationLower = storageLocation.toLowerCase();
      if (locationLower.includes('fridge') || locationLower.includes('refrigerat')) {
        storageConditions = 'Refrigerated';
      } else if (locationLower.includes('freezer')) {
        storageConditions = 'Frozen';
      } else if (locationLower.includes('pantry') || locationLower.includes('cupboard') || locationLower.includes('shelf')) {
        storageConditions = 'Room temperature (pantry)';
      } else {
        storageConditions = storageLocation;
      }
    } else {
      storageConditions = 'Not specified (assume typical storage for this item type)';
    }

    return `You are an expert in food safety and inventory management. Your task is to estimate or recommend an expiration date for grocery, food, or drink items when the actual expiration date is not available.

Follow these rules:
- Base recommendations on typical shelf life for the item type, storage conditions, and packaging.
- If the item is perishable (e.g., dairy, meat, fresh produce), assume refrigeration unless otherwise stated.
- Consider the storage location if provided, or assume typical storage for this item type
- If the item name is in Vietnamese, translate it to English first to make your assessment.
- If unsure, provide a conservative estimate to ensure safety.
- Do NOT make health claims or guarantee safety; include a disclaimer like: "This is an estimate. Always check for signs of spoilage."

Here's the item details:
- Item: ${itemName}
- Purchase Date: ${dateStr}
- Storage Conditions: ${storageConditions}
- Additional Notes: None

Please recommend an estimated expiration date for this item.

Expected Output: Return ONLY a valid JSON object with this exact format:
{
  "days": <number of days from the purchase date>,
  "note": "<brief reasoning/backup claim why the expiration date or any additional helpful information, max 150 characters>"
}

Example response:
{"days": 7, "note": "This is an estimate. Typical shelf life for refrigerated whole milk. Check for signs of spoilage."}

Return only the JSON object, no other text.`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const apiKey = this.apiConfigService.getOpenaiApiKey();
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
            role: 'system',
            content: 'You are a food safety expert that provides expiration estimates in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 1.0,
        max_completion_tokens: 150
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI] API error response:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[OpenAI] No content in response. Full data:', data);
      throw new Error('No response from OpenAI API');
    }

    return content;
  }

  /**
   * Parse OpenAI response
   */
  private parseResponse(response: string): AIExpirationSuggestion {
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (typeof parsed.days !== 'number' || parsed.days <= 0) {
        throw new Error('Invalid days value in response');
      }

      return {
        days: Math.round(parsed.days),
        note: (parsed.note || '').substring(0, 200) // Limit note length
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Response was:', response);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }
}
