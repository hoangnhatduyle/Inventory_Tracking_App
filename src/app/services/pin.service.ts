import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class PinService {
  private readonly PIN_KEY = 'data_browser_pin';

  constructor() { }

  /** Check if a PIN has been set */
  async isPinSet(): Promise<boolean> {
    const { value } = await Preferences.get({ key: this.PIN_KEY });
    return value !== null && value !== '';
  }

  /** Set a new PIN */
  async setPin(pin: string): Promise<void> {
    await Preferences.set({ key: this.PIN_KEY, value: pin });
  }

  /** Verify the PIN */
  async verifyPin(pin: string): Promise<boolean> {
    const { value } = await Preferences.get({ key: this.PIN_KEY });
    return value === pin;
  }

  /** Remove the PIN */
  async removePin(): Promise<void> {
    await Preferences.remove({ key: this.PIN_KEY });
  }
}
