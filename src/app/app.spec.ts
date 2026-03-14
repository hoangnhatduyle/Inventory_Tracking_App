import { TestBed, NO_ERRORS_SCHEMA } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { DatabaseService } from './services/database.service';
import { AuthService } from './services/auth.service';

describe('App', () => {
  beforeEach(async () => {
    const mockDbService = jasmine.createSpyObj('DatabaseService', ['initializeDatabase', 'query', 'run']);
    const mockAuthService = jasmine.createSpyObj(
      'AuthService',
      ['isAuthenticated', 'logout', 'getCurrentUser'],
      { authState$: new BehaviorSubject(false) }
    );

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: DatabaseService, useValue: mockDbService },
        { provide: AuthService, useValue: mockAuthService },
        provideRouter([])
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
