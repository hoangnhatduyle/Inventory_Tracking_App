import { inject, Injectable } from '@angular/core';
import { PushService } from './push.service';

// Web Push notifications for expiration alerts. Local Capacitor notifications
// were removed in the web migration; this service delegates to PushService for
// subscription management while keeping the legacy method names other
// components still call.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly push = inject(PushService);

  async requestPermissions(): Promise<boolean> {
    return this.push.subscribe();
  }

  async unsubscribe(): Promise<void> {
    await this.push.unsubscribe();
  }

  async sendTestNotification(): Promise<boolean> {
    try {
      await this.push.sendTestNotification();
      return true;
    } catch {
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    return this.push.isSubscribed();
  }

  isSupported(): boolean {
    return this.push.isSupported();
  }

  async scheduleExpirationNotifications(_userId?: string | null): Promise<void> {
    // Expiration alerts are delivered server-side via /api/cron/check-expirations.
    return;
  }

  async cancelNotification(_itemId: number): Promise<void> {
    return;
  }

  async cancelAllNotifications(): Promise<void> {
    return;
  }

  async checkAndNotifyLowStock(
    _itemId: number,
    _itemName: string,
    _percentage: number,
    _threshold = 20,
  ): Promise<void> {
    return;
  }

  async scheduleLowStockCheck(_userId?: string | null): Promise<void> {
    return;
  }

  async getPendingNotifications(): Promise<never[]> {
    return [];
  }

  async scheduleTestNotification(_minutesFromNow = 1): Promise<void> {
    await this.push.sendTestNotification();
  }
}
