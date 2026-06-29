import { inject, Injectable } from '@angular/core';
import { ApiClient, ApiClientError } from '../core/api-client.service';

export interface ExpirationSuggestion {
  days: number;
  note: string;
}

export interface AISuggestionRequest {
  itemName: string;
  categoryName?: string;
  storageLocation?: string;
  purchaseDate?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpirationAIService {
  private readonly api = inject(ApiClient);

  // POST /api/ai/expiration-suggest. The atomic monthly quota is enforced
  // server-side (see supabase/migrations/0002_ai_quota_function.sql).
  async suggestExpiration(req: AISuggestionRequest): Promise<ExpirationSuggestion> {
    try {
      return await this.api.post<ExpirationSuggestion>('/api/ai/expiration-suggest', req);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        throw new Error(
          'You have reached this month\'s AI suggestion limit. Please try again next month.',
        );
      }
      throw new Error('The AI suggestion service is unavailable right now.');
    }
  }
}
