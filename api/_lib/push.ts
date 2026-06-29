import webpush from 'web-push';
import { env } from './env.js';

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<void> {
  ensureConfigured();
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
  );
}

export async function sendPushToMany(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    try {
      await sendPush(sub, payload);
      sent++;
    } catch (err) {
      failed++;
      console.warn('[push] delivery failed', sub.endpoint, err);
    }
  }
  return { sent, failed };
}
