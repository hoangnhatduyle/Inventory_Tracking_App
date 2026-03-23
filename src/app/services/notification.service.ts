import { Injectable } from '@angular/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { DatabaseService } from './database.service';
import { InventoryService } from './inventory.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(
    private db: DatabaseService,
    private inventoryService: InventoryService
  ) {}

  /** Parse date string (YYYY-MM-DD) as local date to avoid timezone issues */
  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async scheduleExpirationNotifications(userId: number): Promise<void> {
    try {
      console.log('🔔 Starting notification scheduling...');
      
      // Get all items with notifications enabled
      const items = await this.inventoryService.getItems(userId);
      console.log(`   Total items: ${items.length}`);
      
      const itemsWithNotifications = items.filter(item => item.notificationEnabled);
      console.log(`   Items with notifications enabled: ${itemsWithNotifications.length}`);

      // Cancel all existing notifications
      const pending = await LocalNotifications.getPending();
      console.log(`   Cancelling ${pending.notifications.length} existing notifications...`);
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }

      const notifications: any[] = [];
      const now = new Date();
      console.log(`   Current time: ${now.toLocaleString()}`);

      for (const item of itemsWithNotifications) {
        console.log(`\n   Processing: "${item.name}"`);
        console.log(`      Expiration date string: ${item.expirationDate}`);
        
        // Skip items without expiration date
        if (!item.expirationDate) {
          continue;
        }
        
        const expirationDate = this.parseLocalDate(item.expirationDate);
        expirationDate.setHours(9, 0, 0, 0); // Schedule for 9 AM local time
        console.log(`      Expiration date parsed: ${expirationDate.toLocaleString()}`);
        
        const notificationDate = new Date(expirationDate);
        notificationDate.setDate(expirationDate.getDate() - item.notificationDaysBefore);
        console.log(`      Notification date (${item.notificationDaysBefore} days before): ${notificationDate.toLocaleString()}`);

        // Only schedule if notification date is in the future
        if (notificationDate > now) {
          const daysUntil = Math.ceil((notificationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`      ✅ Scheduling advance warning (in ${daysUntil} days)`);
          notifications.push({
            id: item.id! * 3 + 1,
            title: 'Item Expiring Soon! 🍎',
            body: `${item.name} will expire on ${expirationDate.toLocaleDateString()}`,
            schedule: { at: notificationDate },
            sound: undefined,
            attachments: undefined,
            actionTypeId: '',
            extra: { itemId: item.id }
          });
        } else {
          console.log(`      ⏭️ Skipping advance warning (date in past)`);
        }

        // Also schedule a notification on expiration day
        if (expirationDate > now) {
          const daysUntil = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`      ✅ Scheduling expiration day alert (in ${daysUntil} days)`);
          notifications.push({
            id: item.id! * 3 + 2,
            title: 'Item Expired Today! ⚠️',
            body: `${item.name} expires today!`,
            schedule: { at: expirationDate },
            sound: undefined,
            attachments: undefined,
            actionTypeId: '',
            extra: { itemId: item.id }
          });
        } else {
          console.log(`      ⏭️ Skipping expiration day alert (already expired)`);
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`\n✅ Scheduled ${notifications.length} notifications`);
      } else {
        console.log('\n⚠️ No notifications to schedule');
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      throw error; // Re-throw to help with debugging
    }
  }

  async cancelNotification(itemId: number): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: [
          { id: itemId * 3 + 1 },
          { id: itemId * 3 + 2 }
        ]
      });
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async checkAndNotifyLowStock(itemId: number, itemName: string, percentage: number, threshold: number = 20): Promise<void> {
    try {
      // Only notify if stock is at or below the item's threshold (default 20%)
      if (percentage > threshold) return;

      // Debounce: check if we already sent a low-stock notification recently (within 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);
      const cutoffTime = twentyFourHoursAgo.toISOString();

      const recentNotificationQuery = `
        SELECT COUNT(*) as count FROM notification_log
        WHERE item_id = ? AND notification_date >= ? AND sent = 1
      `;
      const result = await this.db.query(recentNotificationQuery, [itemId, cutoffTime]);
      const recentCount = result.values?.[0]?.count || 0;

      // Skip if we've already notified in the last 24 hours
      if (recentCount > 0) {
        console.log(`Skipping low stock notification for ${itemName} (already sent within 24h)`);
        return;
      }

      const notificationId = itemId + 1000000; // Large offset for low stock notifications (no collision with expiry IDs)

      // Cancel existing low stock notification for this item
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });

      // Schedule immediate notification
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: 'Low Stock Alert! 📉',
          body: `${itemName} is running low (${percentage.toFixed(0)}% remaining). Consider adding to shopping list.`,
          schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: { itemId, type: 'low-stock' }
        }]
      });

      // Log the notification to prevent duplicate alerts within 24h
      const logQuery = `
        INSERT INTO notification_log (item_id, notification_date, sent)
        VALUES (?, ?, 1)
      `;
      await this.db.run(logQuery, [itemId, new Date().toISOString()]);

      console.log(`Low stock notification sent for ${itemName}`);
    } catch (error) {
      console.error('Error sending low stock notification:', error);
    }
  }

  async scheduleLowStockCheck(userId: number): Promise<void> {
    try {
      const items = await this.inventoryService.getItems(userId);

      for (const item of items) {
        if (item.initialQuantity && item.currentQuantity !== undefined) {
          const percentage = (item.currentQuantity / item.initialQuantity) * 100;
          const threshold = item.lowStockThreshold ?? 20; // Use item's threshold, default to 20%

          if (percentage <= threshold && percentage > 0) {
            await this.checkAndNotifyLowStock(item.id!, item.name, percentage, threshold);
          }
        }
      }
    } catch (error) {
      console.error('Error checking low stock:', error);
    }
  }

  async getPendingNotifications(): Promise<any[]> {
    try {
      const pending = await LocalNotifications.getPending();
      console.log('📅 Pending Notifications:', pending.notifications.length);
      
      // Sort by scheduled time
      const sorted = pending.notifications.sort((a, b) => {
        const timeA = a.schedule?.at ? new Date(a.schedule.at).getTime() : 0;
        const timeB = b.schedule?.at ? new Date(b.schedule.at).getTime() : 0;
        return timeA - timeB;
      });

      // Log each pending notification with details
      sorted.forEach((notif, index) => {
        const scheduledAt = notif.schedule?.at ? new Date(notif.schedule.at) : null;
        const now = new Date();
        const timeUntil = scheduledAt ? Math.round((scheduledAt.getTime() - now.getTime()) / (1000 * 60)) : null;
        
        console.log(`\n📬 Notification ${index + 1}:`);
        console.log(`   ID: ${notif.id}`);
        console.log(`   Title: ${notif.title}`);
        console.log(`   Body: ${notif.body}`);
        console.log(`   Scheduled: ${scheduledAt?.toLocaleString() || 'N/A'}`);
        if (timeUntil !== null) {
          if (timeUntil < 0) {
            console.log(`   ⚠️ Should have fired ${Math.abs(timeUntil)} minutes ago`);
          } else if (timeUntil < 60) {
            console.log(`   ⏰ Fires in ${timeUntil} minutes`);
          } else if (timeUntil < 1440) {
            console.log(`   ⏰ Fires in ${Math.round(timeUntil / 60)} hours`);
          } else {
            console.log(`   ⏰ Fires in ${Math.round(timeUntil / 1440)} days`);
          }
        }
      });

      return sorted;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }

  async scheduleTestNotification(minutesFromNow: number = 1): Promise<void> {
    try {
      const testDate = new Date(Date.now() + minutesFromNow * 60 * 1000);
      
      await LocalNotifications.schedule({
        notifications: [{
          id: 99999,
          title: '🧪 Test Notification',
          body: `This is a test notification scheduled for ${testDate.toLocaleTimeString()}`,
          schedule: { at: testDate },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: { type: 'test' }
        }]
      });

      console.log(`✅ Test notification scheduled for ${minutesFromNow} minute(s) from now`);
      console.log(`   Scheduled time: ${testDate.toLocaleString()}`);
      
      // Show pending notifications
      await this.getPendingNotifications();
    } catch (error) {
      console.error('Error scheduling test notification:', error);
    }
  }
}
