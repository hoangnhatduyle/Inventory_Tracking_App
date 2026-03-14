import { TestBed } from '@angular/core/testing';
import { WasteTrackingService } from './waste-tracking.service';
import { DatabaseService } from './database.service';

describe('WasteTrackingService', () => {
  let service: WasteTrackingService;
  let mockDb: jasmine.SpyObj<DatabaseService>;

  beforeEach(() => {
    mockDb = jasmine.createSpyObj('DatabaseService', ['query', 'run']);

    TestBed.configureTestingModule({
      providers: [
        WasteTrackingService,
        { provide: DatabaseService, useValue: mockDb }
      ]
    });

    service = TestBed.inject(WasteTrackingService);
  });

  describe('getWasteStatistics - wasteByMonth order', () => {
    it('should return wasteByMonth in chronological order (oldest to newest)', async () => {
      // Return wasted items spread across multiple months out of order
      mockDb.query.and.returnValue(Promise.resolve({
        values: [
          { id: 1, item_name: 'Item 1', wasted_date: '2025-12-15', category_id: 1, quantity: 2, unit: 'pieces', price: 5 },
          { id: 2, item_name: 'Item 2', wasted_date: '2026-01-20', category_id: 1, quantity: 1, unit: 'pieces', price: 3 },
          { id: 3, item_name: 'Item 3', wasted_date: '2025-11-10', category_id: 1, quantity: 3, unit: 'pieces', price: 10 },
          { id: 4, item_name: 'Item 4', wasted_date: '2026-03-05', category_id: 1, quantity: 1, unit: 'pieces', price: 2 }
        ]
      }));

      const stats = await service.getWasteStatistics(1);

      // wasteByMonth should be sorted chronologically
      const months = stats.wasteByMonth.map(m => m.month);
      const sortedMonths = [...months].sort();

      expect(months).toEqual(sortedMonths);
    });

    it('should return only the last 6 months', async () => {
      // Return items from 8 different months
      const dates = [
        '2025-08-01', '2025-09-15', '2025-10-20', '2025-11-10',
        '2025-12-15', '2026-01-20', '2026-02-10', '2026-03-05'
      ];

      const wastedItems = dates.map((date, idx) => ({
        id: idx + 1,
        item_name: `Item ${idx + 1}`,
        wasted_date: date,
        category_id: 1,
        quantity: 1,
        unit: 'pieces',
        price: 5
      }));

      mockDb.query.and.returnValue(Promise.resolve({ values: wastedItems }));

      const stats = await service.getWasteStatistics(1);

      // Should contain only the last 6 months (from 8 total)
      expect(stats.wasteByMonth.length).toBeLessThanOrEqual(6);
    });
  });
});
