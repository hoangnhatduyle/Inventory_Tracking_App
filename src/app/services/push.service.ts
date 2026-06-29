import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../core/api-client.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly api = inject(ApiClient);
  private registration: ServiceWorkerRegistration | null = null;

  private get vapidPublicKey(): string {
    return environment.vapidPublicKey ?? '';
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  async getPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  async isSubscribed(): Promise<boolean> {
    const reg = await this.ensureRegistration(false);
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }

  async subscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (!this.vapidPublicKey) {
      console.warn('[PushService] NG_APP_VAPID_PUBLIC_KEY is not configured');
      return false;
    }
    if (Notification.permission === 'denied') return false;

    const perm =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (perm !== 'granted') return false;

    const reg = await this.ensureRegistration(true);
    if (!reg) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as BufferSource,
      });
    }

    const json = sub.toJSON();
    const p256dh = json.keys?.['p256dh'];
    const auth = json.keys?.['auth'];
    if (!json.endpoint || !p256dh || !auth) {
      return false;
    }

    await this.api.post('/api/push/subscribe', {
      endpoint: json.endpoint,
      expirationTime: json.expirationTime ?? null,
      keys: {
        p256dh,
        auth,
      },
    });
    return true;
  }

  async unsubscribe(): Promise<void> {
    const reg = await this.ensureRegistration(false);
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try {
      await this.api.delete(
        `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
      );
    } catch {
      // Best effort - still remove the browser subscription locally.
    }
    await sub.unsubscribe();
  }

  async sendTestNotification(): Promise<void> {
    await this.api.post('/api/push/test', {});
  }

  private async ensureRegistration(register: boolean): Promise<ServiceWorkerRegistration | null> {
    if (this.registration) return this.registration;
    try {
      const existing = await navigator.serviceWorker.getRegistration('/sw-push/');
      if (existing) {
        this.registration = existing;
        return existing;
      }
      if (!register) return null;
      this.registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/sw-push/',
      });
      await navigator.serviceWorker.ready;
      return this.registration;
    } catch (err) {
      console.error('[PushService] service worker registration failed', err);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const buffer = new ArrayBuffer(raw.length);
    const output = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) {
      output[i] = raw.charCodeAt(i);
    }
    return output;
  }
}
