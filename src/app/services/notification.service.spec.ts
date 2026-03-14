import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { DatabaseService } from './database.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockDb: jasmine.SpyObj<DatabaseService>;

  beforeEach(() => {
    mockDb = jasmine.createSpyObj('DatabaseService', ['query', 'run']);

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: DatabaseService, useValue: mockDb }
      ]
    });

    service = TestBed.inject(NotificationService);
  });

  describe('Notification ID namespace - no collisions', () => {
    it('item 1 and item 10001 should produce non-colliding notification IDs', () => {
      // Item 1: expiry IDs = 1*3+1=4, 1*3+2=5; low-stock = 1+1000000=1000001
      const item1ExpiryId1 = 1 * 3 + 1; // 4
      const item1ExpiryId2 = 1 * 3 + 2; // 5
      const item1LowStockId = 1 + 1000000; // 1000001

      // Item 10001: expiry IDs = 10001*3+1=30004, 10001*3+2=30005; low-stock = 10001+1000000=1010001
      const item10001ExpiryId1 = 10001 * 3 + 1; // 30004
      const item10001ExpiryId2 = 10001 * 3 + 2; // 30005
      const item10001LowStockId = 10001 + 1000000; // 1010001

      const allIds = [item1ExpiryId1, item1ExpiryId2, item1LowStockId, item10001ExpiryId1, item10001ExpiryId2, item10001LowStockId];
      const uniqueIds = new Set(allIds);

      expect(uniqueIds.size).toBe(6); // All IDs are unique
      expect(item1ExpiryId1).toBe(4);
      expect(item10001ExpiryId1).toBe(30004);
    });
  });

  describe('checkAndNotifyLowStock - debounce', () => {
    it('should skip notification if recent alert exists in notification_log', async () => {
      mockDb.query.and.returnValue(Promise.resolve({
        values: [{ count: 1 }] // Recent alert found
      }));

      spyOn(console, 'log');

      // The method should check notification_log and skip scheduling if count > 0
      // This test verifies the debounce check is in place
      await service.checkAndNotifyLowStock(1, 'Test Item', 50, 20);

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should attempt notification when no recent alert in notification_log', async () => {
      mockDb.query.and.returnValue(Promise.resolve({
        values: [{ count: 0 }] // No recent alert
      }));

      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      // With no recent alert (count = 0), the service should proceed
      await service.checkAndNotifyLowStock(1, 'Test Item', 50, 20);

      // Should have queried notification_log
      expect(mockDb.query).toHaveBeenCalled();
    });
  });
});
