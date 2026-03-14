import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('should redirect unauthenticated users to /login', async () => {
    authService.isAuthenticated.and.returnValue(Promise.resolve(false));
    router.createUrlTree.and.returnValue(new UrlTree());

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(result instanceof UrlTree).toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should allow authenticated users to access the route', async () => {
    authService.isAuthenticated.and.returnValue(Promise.resolve(true));

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(result).toBe(true);
  });
});
