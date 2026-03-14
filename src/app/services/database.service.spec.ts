import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';

describe('DatabaseService - localStorage mode', () => {
  let service: DatabaseService;

  beforeEach(() => {
    // Initialize service without native SQLite plugin (will use localStorage)
    TestBed.configureTestingModule({
      providers: [
        { provide: DatabaseService, useValue: new (DatabaseService as any)(null) }
      ]
    });

    service = TestBed.inject(DatabaseService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('validateTableName - allowlist protection', () => {
    it('should throw for table names not in allowlist', () => {
      const invalidTableName = 'users; DROP TABLE inventory_items;--';

      expect(() => {
        (service as any).validateTableName(invalidTableName);
      }).toThrowError('Invalid table name');
    });

    it('should not throw for allowed table names', () => {
      const validTableName = 'inventory_items';

      expect(() => {
        (service as any).validateTableName(validTableName);
      }).not.toThrow();
    });

    it('should allow all canonical table names', () => {
      const validTables = [
        'inventory_items', 'inventory_batches', 'categories', 'locations',
        'shopping_list', 'wasted_items', 'recipes', 'barcode_mappings',
        'notification_log', 'ai_usage_log', 'usage_history', 'item_images'
      ];

      validTables.forEach(table => {
        expect(() => {
          (service as any).validateTableName(table);
        }).not.toThrow();
      });
    });
  });

  describe('localStorage parser - Math.max spread fix', () => {
    it('should handle INSERT with large table without stack overflow', async () => {
      // Set up localStorage with 1000 rows to test Math.max spread fix
      const db: any = { inventory_items: [] };
      for (let i = 1; i <= 1000; i++) {
        db.inventory_items.push({ id: i, name: `Item ${i}` });
      }
      localStorage.setItem('inventory_db', JSON.stringify(db));

      // Insert a new row - should use reduce instead of spread
      await service.run('INSERT INTO inventory_items (name) VALUES (?)', ['New Item']);

      const updatedDb = JSON.parse(localStorage.getItem('inventory_db') || '{}');
      expect(updatedDb.inventory_items.length).toBe(1001);
      // New row should have id = 1001
      expect(updatedDb.inventory_items[1000].id).toBe(1001);
    });
  });

  describe('localStorage parser - SUM() support', () => {
    it('should compute SUM of quantity column correctly', async () => {
      const db: any = {
        inventory_batches: [
          { id: 1, itemId: 1, quantity: 10 },
          { id: 2, itemId: 1, quantity: 5 },
          { id: 3, itemId: 1, quantity: 3 }
        ]
      };
      localStorage.setItem('inventory_db', JSON.stringify(db));

      // Query with SUM
      const result = await service.query(
        'SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_batches WHERE itemId = ?',
        [1]
      );

      expect(result.values).toBeDefined();
      expect(result.values?.[0]?.total).toBe(18);
    });

    it('should return 0 for SUM with no matching rows', async () => {
      const db: any = { inventory_batches: [] };
      localStorage.setItem('inventory_db', JSON.stringify(db));

      const result = await service.query(
        'SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_batches WHERE itemId = ?',
        [999]
      );

      expect(result.values?.[0]?.total).toBe(0);
    });
  });
});
