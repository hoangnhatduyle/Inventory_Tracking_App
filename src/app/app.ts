import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule } from '@angular/material/dialog';
import { AuthService } from './services/auth.service';
import { ConsoleLoggerService } from './services/console-logger.service';
import { environment } from '../environments/environment';

// Phones / small tablets get an overlay drawer that starts closed; larger
// screens keep the persistent side drawer.
const MOBILE_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    NgIf,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatDialogModule,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css', './styles/snackbar-styles.scss', './styles/animations.scss'],
})
export class App implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);

  title = 'Chắt Chiu';
  isAuthenticated = false;
  isMobile = false;
  isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  constructor() {
    this.breakpointObserver
      .observe(MOBILE_QUERY)
      .pipe(takeUntilDestroyed())
      .subscribe((result) => (this.isMobile = result.matches));

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => (this.isOnline = true));
      window.addEventListener('offline', () => (this.isOnline = false));
    }

    // Eagerly construct ConsoleLoggerService so it can patch console.* in dev.
    // In production its no-op behaviour is enforced inside the service itself.
    inject(ConsoleLoggerService);

    if (!environment.production) {
      console.log('App started');
    }

    this.authService.authState$.subscribe((authenticated) => {
      this.isAuthenticated = authenticated;
    });
  }

  async ngOnInit() {
    // No local DB to initialize anymore - persistence is the Vercel/Supabase API.
    const authenticated = await this.authService.isAuthenticated();
    if (!authenticated) {
      await this.authService.logout();
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }

  async logout() {
    await this.authService.logout();
    void this.router.navigate(['/login']);
  }

  // On phones the drawer is an overlay - close it after navigating.
  onNavigate() {
    if (this.isMobile && this.drawer) {
      void this.drawer.close();
    }
  }
}
