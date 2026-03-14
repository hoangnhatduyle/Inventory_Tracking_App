import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import * as CryptoJS from 'crypto-js';

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: jasmine.SpyObj<DatabaseService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockDb = jasmine.createSpyObj('DatabaseService', [
      'query',
      'run',
      'initializeDatabase'
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: Router, useValue: mockRouter }
      ]
    });

    service = TestBed.inject(AuthService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('register', () => {
    it('should register a new user with salted password hash', async () => {
      mockDb.query.and.returnValue(Promise.resolve({ values: [{ count: 0 }] }));
      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      const result = await service.register('testuser', 'password123');

      expect(result.success).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
      const insertCall = mockDb.run.calls.mostRecent();
      const hashedPassword = (insertCall.args as any[])[1][1];

      // Password should be in "salt:hash" format (with colon)
      expect(hashedPassword).toContain(':');
    });

    it('should reject duplicate usernames', async () => {
      mockDb.query.and.returnValue(Promise.resolve({ values: [{ count: 1 }] }));

      const result = await service.register('existing', 'password');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      const salt = 'test_salt_16_bytes';
      const password = 'password123';
      const hash = CryptoJS.SHA256(salt + password).toString();
      const storedHash = `${salt}:${hash}`;

      mockDb.query.and.returnValue(
        Promise.resolve({
          values: [
            {
              id: 1,
              username: 'testuser',
              password: storedHash,
              email: 'test@example.com',
              created_at: '2026-01-01'
            }
          ]
        })
      );
      mockDb.run.and.returnValue(Promise.resolve({ changes: { lastId: 1 } }));

      const result = await service.login('testuser', password);

      expect(result.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        jasmine.any(String),
        ['testuser']
      );
    });

    it('should reject incorrect password', async () => {
      mockDb.query.and.returnValue(
        Promise.resolve({
          values: [
            {
              id: 1,
              username: 'testuser',
              password: 'some_hash:another_hash',
              email: 'test@example.com'
            }
          ]
        })
      );

      const result = await service.login('testuser', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should auto-migrate legacy unsalted passwords to salted format', async () => {
      const plainPassword = 'password123';
      const legacyHash = CryptoJS.SHA256(plainPassword).toString();

      mockDb.query.and.returnValue(
        Promise.resolve({
          values: [
            {
              id: 1,
              username: 'testuser',
              password: legacyHash, // No colon = legacy format
              email: 'test@example.com',
              created_at: '2026-01-01'
            }
          ]
        })
      );
      mockDb.run.and.returnValue(Promise.resolve({ changes: { lastId: 1 } }));

      const result = await service.login('testuser', plainPassword);

      expect(result.success).toBe(true);
      // Should have called run() twice: once for session, once for password update
      const runCalls = mockDb.run.calls.all();
      expect(runCalls.length).toBeGreaterThan(1);
    });

    it('should clear password from currentUser after login', async () => {
      mockDb.query.and.returnValue(
        Promise.resolve({
          values: [
            {
              id: 1,
              username: 'testuser',
              password: 'hash:value',
              email: 'test@example.com'
            }
          ]
        })
      );
      mockDb.run.and.returnValue(Promise.resolve({ changes: { lastId: 1 } }));

      await service.login('testuser', 'password');
      const currentUser = await service.getCurrentUser();

      expect(currentUser?.password).toBe('');
    });
  });

  describe('logout', () => {
    it('should clear session and navigate to login', async () => {
      mockDb.query.and.returnValue(
        Promise.resolve({
          values: [{ id: 1, user_id: 1, token: 'token', expiresAt: '2026-04-14' }]
        })
      );
      mockDb.run.and.returnValue(Promise.resolve({ changes: {} }));

      await service.logout();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(localStorage.getItem('inventory_session')).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true with valid session token', async () => {
      const sessionData = {
        userId: 1,
        token: 'valid_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
      localStorage.setItem('inventory_session', JSON.stringify(sessionData));

      mockDb.query.and.returnValue(
        Promise.resolve({
          values: [
            {
              id: 1,
              username: 'testuser',
              password: 'hash',
              email: 'test@example.com'
            }
          ]
        })
      );

      const result = await service.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false with expired session', async () => {
      const sessionData = {
        userId: 1,
        token: 'expired_token',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };
      localStorage.setItem('inventory_session', JSON.stringify(sessionData));

      const result = await service.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false without session data', async () => {
      const result = await service.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
