import { TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { AuthService } from './services/auth.service';

describe('App', () => {
  beforeEach(async () => {
    const mockAuthService = jasmine.createSpyObj(
      'AuthService',
      ['isAuthenticated', 'logout', 'getCurrentUser'],
      { authState$: new BehaviorSubject(false) },
    );
    (mockAuthService.isAuthenticated as jasmine.Spy).and.resolveTo(false);
    (mockAuthService.logout as jasmine.Spy).and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        provideRouter([]),
        provideHttpClient(),
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
