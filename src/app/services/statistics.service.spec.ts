import { TestBed } from '@angular/core/testing';
import { StatisticsService } from './statistics.service';
import { DatabaseService } from './database.service';
import { InventoryService } from './inventory.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let mockDb: jasmine.SpyObj<DatabaseService>;
  let mockInventory: jasmine.SpyObj<InventoryService>;

  beforeEach(() => {
    mockDb = jasmine.createSpyObj('DatabaseService', ['query', 'run']);
    mockInventory = jasmine.createSpyObj('InventoryService', [
      'getItems',
      'getCategories',
      'getLocations',
      'filterItems',
      'getAllRecipes'
    ]);

    TestBed.configureTestingModule({
      providers: [
        StatisticsService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventory }
      ]
    });

    service = TestBed.inject(StatisticsService);
  });

  describe('exportInventoryData - CSV injection protection', () => {
    it('should escape double-quotes in CSV fields', async () => {
      mockInventory.getItems.and.returnValue(Promise.resolve([
        {
          id: 1,
          name: 'Item with "quotes" inside',
          categoryId: 1,
          quantity: 5,
          unit: 'pieces',
          purchaseDate: '2026-03-01',
          expirationDate: '2026-04-01',
          locationId: 1,
          price: 10,
          notes: 'Test "note" here',
          notificationEnabled: false,
          notificationDaysBefore: 3
        } as any
      ]));

      mockInventory.getCategories.and.returnValue(Promise.resolve([
        { id: 1, name: 'Test Category' }
      ]));

      mockInventory.getLocations.and.returnValue(Promise.resolve([
        { id: 1, userId: 1, name: 'Kitchen' }
      ]));

      const csv = await service.exportInventoryData(1);

      // Double-quotes should be escaped as ""
      expect(csv).toContain('""quotes""');
      expect(csv).toContain('""note""');
    });

    it('should strip formula-injection prefixes from CSV fields', async () => {
      mockInventory.getItems.and.returnValue(Promise.resolve([
        {
          id: 1,
          name: '=HYPERLINK("http://evil.com","Click")',
          categoryId: 1,
          quantity: 5,
          unit: 'pieces',
          purchaseDate: '2026-03-01',
          expirationDate: '2026-04-01',
          locationId: 1,
          price: 10,
          notes: '+1+1',
          notificationEnabled: false,
          notificationDaysBefore: 3
        } as any
      ]));

      mockInventory.getCategories.and.returnValue(Promise.resolve([]));
      mockInventory.getLocations.and.returnValue(Promise.resolve([]));

      const csv = await service.exportInventoryData(1);

      // The equals sign and plus signs should be stripped
      expect(csv).not.toContain('"=HYPERLINK');
      expect(csv).not.toContain('"+1+1');
    });
  });

  describe('getDashboardStatistics - sort mutation', () => {
    it('should not mutate the original items array when sorting', async () => {
      const originalItems = [
        { id: 3, name: 'Item C', categoryId: 1, quantity: 1, expirationDate: '2026-03-20' } as any,
        { id: 1, name: 'Item A', categoryId: 1, quantity: 2, expirationDate: '2026-03-15' } as any,
        { id: 2, name: 'Item B', categoryId: 1, quantity: 3, expirationDate: '2026-03-18' } as any
      ];

      const originalOrder = JSON.stringify(originalItems.map(i => i.id));

      mockInventory.getItems.and.returnValue(Promise.resolve(originalItems));
      mockInventory.getCategories.and.returnValue(Promise.resolve([]));
      mockInventory.getLocations.and.returnValue(Promise.resolve([]));

      await service.getDashboardStatistics(1);

      const currentOrder = JSON.stringify(originalItems.map(i => i.id));
      expect(currentOrder).toBe(originalOrder);
    });
  });

  describe('getAllRecipes - null ingredients guard', () => {
    it('should handle recipes with null ingredients without throwing', async () => {
      mockDb.query.and.returnValue(Promise.resolve({
        values: [
          { id: 1, name: 'Recipe 1', ingredients: 'flour,sugar,eggs' },
          { id: 2, name: 'Recipe 2', ingredients: null },
          { id: 3, name: 'Recipe 3', ingredients: 'milk,bread' }
        ]
      }));

      const result = await service.getAllRecipes();

      expect(result.length).toBe(3);
      expect(result[1].ingredients).toBeNull();
    });
  });
});
