import { TestBed } from '@angular/core/testing';
import { InventoryService } from './inventory.service';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';
import { toLocalDateString, daysFromNow } from '../utils/date.utils';

describe('InventoryService', () => {
  let service: InventoryService;
  let mockDb: jasmine.SpyObj<DatabaseService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    mockDb = jasmine.createSpyObj('DatabaseService', ['query', 'run', 'beginTransaction', 'commitTransaction', 'rollbackTransaction']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['checkAndNotifyLowStock', 'scheduleLowStockCheck']);

    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: NotificationService, useValue: mockNotification }
      ]
    });

    service = TestBed.inject(InventoryService);
  });

  describe('filterItems - expiry bounds', () => {
    it('should exclude already-expired items from expiring-soon filter', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const yesterdayStr = toLocalDateString(yesterday);
      const tomorrowStr = toLocalDateString(tomorrow);

      mockDb.query.and.returnValue(Promise.resolve({
        values: [
          { id: 1, name: 'Expired', expirationDate: yesterdayStr, categoryId: 1 },
          { id: 2, name: 'Expiring Soon', expirationDate: tomorrowStr, categoryId: 1 }
        ]
      }));

      const result = await service.filterItems(1, undefined, undefined, 7);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Expiring Soon');
    });

    it('should include items expiring within the window', async () => {
      const today = new Date();
      const in3days = new Date(today);
      in3days.setDate(in3days.getDate() + 3);

      const in3daysStr = toLocalDateString(in3days);

      mockDb.query.and.returnValue(Promise.resolve({
        values: [
          { id: 1, name: 'Expiring in 3 days', expirationDate: in3daysStr, categoryId: 1 }
        ]
      }));

      const result = await service.filterItems(1, undefined, undefined, 7);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Expiring in 3 days');
    });
  });

  describe('initialQuantity - nullish coalescing', () => {
    it('should store initialQuantity = 0 without treating it as falsy', async () => {
      const item: any = {
        userId: 1,
        name: 'Zero Quantity Item',
        initialQuantity: 0,
        currentQuantity: 0,
        categoryId: 1,
        quantity: 0,
        unit: 'pieces',
        purchaseDate: toLocalDateString(new Date()),
        expirationDate: daysFromNow(10),
        locationId: 1,
        notificationEnabled: false,
        notificationDaysBefore: 3
      };

      mockDb.run.and.returnValue(Promise.resolve({ changes: { lastId: 1 } }));

      await service.addItem(item);

      const runCall = mockDb.run.calls.mostRecent();
      const params = runCall.args[1];

      // initialQuantity should be present in params (not skipped as falsy)
      expect(params).toContain(0);
    });
  });

  describe('deductFromBatchesFIFO - over-deduction protection', () => {
    it('should return false when deduction amount exceeds total batch stock', async () => {
      // Mock getBatches to return total quantity of 5
      spyOn(service, 'getBatches').and.returnValue(Promise.resolve([
        { id: 1, itemId: 1, quantity: 5, expirationDate: '2026-04-01' }
      ]));

      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      // Attempt to deduct 10 when only 5 available
      const result = await service.deductFromBatchesFIFO(1, 10);

      expect(result).toBe(false);
    });

    it('should successfully deduct when amount is within available stock', async () => {
      spyOn(service, 'getBatches').and.returnValue(Promise.resolve([
        { id: 1, itemId: 1, quantity: 10, expirationDate: '2026-04-01' }
      ]));

      mockDb.run.and.returnValue(Promise.resolve({ changes: { changes: 1 } }));
      mockDb.beginTransaction.and.returnValue(Promise.resolve());
      mockDb.commitTransaction.and.returnValue(Promise.resolve());

      const result = await service.deductFromBatchesFIFO(1, 5);

      expect(result).toBe(true);
    });
  });

  describe('deleteItem - transaction safety', () => {
    it('should call beginTransaction before deletion', async () => {
      mockDb.beginTransaction.and.returnValue(Promise.resolve());
      mockDb.commitTransaction.and.returnValue(Promise.resolve());
      mockDb.run.and.returnValue(Promise.resolve({ changes: { changes: 1 } }));

      await service.deleteItem(1);

      expect(mockDb.beginTransaction).toHaveBeenCalled();
    });

    it('should call commitTransaction on successful deletion', async () => {
      mockDb.beginTransaction.and.returnValue(Promise.resolve());
      mockDb.commitTransaction.and.returnValue(Promise.resolve());
      mockDb.run.and.returnValue(Promise.resolve({ changes: { changes: 1 } }));

      await service.deleteItem(1);

      expect(mockDb.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('markAsWasted - result checking', () => {
    it('should return false when deleteItem fails', async () => {
      spyOn(service, 'deleteItem').and.returnValue(Promise.resolve(false));

      const result = await service.markAsWasted(1);

      expect(result).toBe(false);
    });

    it('should return true when deleteItem succeeds', async () => {
      spyOn(service, 'deleteItem').and.returnValue(Promise.resolve(true));
      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      const result = await service.markAsWasted(1);

      expect(result).toBe(true);
    });
  });
});
