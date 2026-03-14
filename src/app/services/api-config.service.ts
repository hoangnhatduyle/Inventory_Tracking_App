import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Service to manage API keys and sensitive configuration at runtime.
 * Keys are stored in localStorage and never committed to the repository.
 */
@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private readonly OPENAI_KEY_STORAGE = 'app_openai_api_key';
  private openaiApiKeySubject = new BehaviorSubject<string>(this.loadOpenaiKey());
  public openaiApiKey$ = this.openaiApiKeySubject.asObservable();

  constructor() {}

  /**
   * Get the current OpenAI API key
   */
  getOpenaiApiKey(): string {
    return this.openaiApiKeySubject.value;
  }

  /**
   * Set the OpenAI API key
   */
  setOpenaiApiKey(key: string): void {
    if (key && key.trim()) {
      localStorage.setItem(this.OPENAI_KEY_STORAGE, key.trim());
      this.openaiApiKeySubject.next(key.trim());
    } else {
      this.clearOpenaiApiKey();
    }
  }

  /**
   * Clear the OpenAI API key
   */
  clearOpenaiApiKey(): void {
    localStorage.removeItem(this.OPENAI_KEY_STORAGE);
    this.openaiApiKeySubject.next('');
  }

  /**
   * Check if OpenAI API key is configured
   */
  hasOpenaiApiKey(): boolean {
    return this.openaiApiKeySubject.value.length > 0;
  }

  /**
   * Load API key from localStorage
   */
  private loadOpenaiKey(): string {
    const stored = localStorage.getItem(this.OPENAI_KEY_STORAGE);
    return stored && stored.trim() ? stored.trim() : '';
  }
}
