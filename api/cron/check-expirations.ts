import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_lib/cors.js';
import { withErrorHandler, ApiError } from '../_lib/errors.js';
import { env } from '../_lib/env.js';
import { serviceClient } from '../_lib/supabase.js';
import { sendPushToMany } from '../_lib/push.js';

type ExpiringRow = {
  id: number;
  user_id: string;
  name: string;
  expiration_date: string;
  notification_days_before: number | null;
  notification_enabled: boolean | null;
  last_notified_at: string | null;
};

function assertCronAuth(req: VercelRequest): void {
  const secret = env.cronSecret;
  if (!secret) {
    throw new ApiError('INTERNAL', 'CRON_SECRET is not configured');
  }
  const header = req.headers.authorization ?? '';
  if (header !== `Bearer ${secret}`) {
    throw new ApiError('UNAUTHORIZED', 'Invalid cron authorization');
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(expirationDate: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const exp = new Date(`${expirationDate}T00:00:00.000Z`);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default withErrorHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') {
    throw new ApiError('METHOD_NOT_ALLOWED', 'Allowed methods: GET');
  }
  assertCronAuth(req);

  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    return { skipped: true, reason: 'VAPID keys not configured' };
  }

  const db = serviceClient();
  const today = todayUtc();

  const { data: items, error } = await db
    .from('inventory_items')
    .select(
      'id, user_id, name, expiration_date, notification_days_before, notification_enabled, last_notified_at',
    )
    .not('expiration_date', 'is', null)
    .eq('notification_enabled', true);

  if (error) {
    throw new ApiError('INTERNAL', 'Failed to load expiring items', error);
  }

  const due = (items as ExpiringRow[] | null)?.filter((item) => {
    if (!item.expiration_date) return false;
    const notifyDays = item.notification_days_before ?? 3;
    const remaining = daysUntil(item.expiration_date);
    if (remaining < 0 || remaining > notifyDays) return false;
    if (item.last_notified_at && item.last_notified_at.slice(0, 10) === today) {
      return false;
    }
    return true;
  }) ?? [];

  const byUser = new Map<string, ExpiringRow[]>();
  for (const item of due) {
    const list = byUser.get(item.user_id) ?? [];
    list.push(item);
    byUser.set(item.user_id, list);
  }

  let usersNotified = 0;
  let pushesSent = 0;

  for (const [userId, userItems] of byUser.entries()) {
    const { data: subs, error: subErr } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (subErr || !subs?.length) continue;

    const count = userItems.length;
    const body =
      count === 1
        ? `${userItems[0].name} expires soon`
        : `${count} items expiring soon`;

    const { sent } = await sendPushToMany(subs, {
      title: count === 1 ? 'Item expiring soon' : `${count} items expiring soon`,
      body,
      url: '/inventory',
      tag: `expiring-${today}-${userId}`,
    });

    if (sent > 0) {
      usersNotified++;
      pushesSent += sent;
      const ids = userItems.map((i) => i.id);
      await db
        .from('inventory_items')
        .update({ last_notified_at: new Date().toISOString() })
        .in('id', ids);
    }
  }

  return {
    checked: items?.length ?? 0,
    due: due.length,
    usersNotified,
    pushesSent,
  };
});
