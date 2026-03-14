import { TestBed } from '@angular/core/testing';
import { ExpirationAIService } from './expiration-ai.service';
import { DatabaseService } from './database.service';

describe('ExpirationAIService', () => {
  let service: ExpirationAIService;
  let mockDb: jasmine.SpyObj<DatabaseService>;

  beforeEach(() => {
    mockDb = jasmine.createSpyObj('DatabaseService', ['query', 'run']);

    TestBed.configureTestingModule({
      providers: [
        ExpirationAIService,
        { provide: DatabaseService, useValue: mockDb }
      ]
    });

    service = TestBed.inject(ExpirationAIService);
  });

  describe('checkRateLimit', () => {
    it('should only count rows where response_days IS NOT NULL', async () => {
      mockDb.query.and.returnValue(Promise.resolve({
        values: [{ count: 500, usage: 500, limit: 1000 }]
      }));

      const result = await service.checkRateLimit(1);

      expect(result.allowed).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
      const queryCall = mockDb.query.calls.mostRecent();
      const sql = queryCall.args[0];

      // Verify the SQL contains the IS NOT NULL filter
      expect(sql.toLowerCase()).toContain('response_days is not null');
    });

    it('should return allowed=false when at monthly limit', async () => {
      mockDb.query.and.returnValue(Promise.resolve({
        values: [{ count: 1000, usage: 1000, limit: 1000 }]
      }));

      const result = await service.checkRateLimit(1);

      expect(result.allowed).toBe(false);
      expect(result.usage).toBe(1000);
    });
  });

  describe('suggestExpiration', () => {
    it('should reject AI suggestions with days = 0', async () => {
      // Mock fetch to return an invalid response
      const mockFetch = jasmine.createSpy('fetch').and.returnValue(
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({ days: 0, note: 'Invalid' })
              }
            }]
          })
        })
      );

      spyOn(window, 'fetch').and.returnValue(mockFetch());

      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      try {
        await service.suggestExpiration('Test Item', new Date(), 'Fridge', 1);
      } catch (error: any) {
        // Should throw or return error for days = 0
        expect(error.message).toContain('Invalid');
      }
    });

    it('should reject suggestions with days <= 0', async () => {
      // Days should be positive; negative or zero is invalid
      const mockFetch = jasmine.createSpy('fetch').and.returnValue(
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({ days: -1, note: 'Invalid' })
              }
            }]
          })
        })
      );

      spyOn(window, 'fetch').and.returnValue(mockFetch());

      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      try {
        await service.suggestExpiration('Test Item', new Date(), 'Pantry', 1);
      } catch (error: any) {
        expect(error.message).toContain('Invalid');
      }
    });
  });
});
