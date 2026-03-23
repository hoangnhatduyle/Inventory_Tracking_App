import { Component, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatabaseService } from './services/database.service';
import { AuthService } from './services/auth.service';
import { ConsoleLoggerService } from './services/console-logger.service';

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
    MatDialogModule
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css', './styles/snackbar-styles.scss', './styles/animations.scss']
})
export class App implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;
  
  title = 'Chắt Chiu';
  isAuthenticated = false;

  constructor(
    private db: DatabaseService,
    private authService: AuthService,
    private consoleLogger: ConsoleLoggerService,
    private router: Router,
    private dialog: MatDialog
  ) {
    // Initialize console logger to start capturing logs
    console.log('🚀 App started - Console logging initialized');
    
    // Listen to auth state changes
    this.authService.authState$.subscribe(authenticated => {
      this.isAuthenticated = authenticated;
    });
  }

  async ngOnInit() {
    // Initialize database
    await this.db.initializeDatabase();

    // Call isAuthenticated() to check DB and emit the true initial state to authState$
    const authenticated = await this.authService.isAuthenticated();
    if (!authenticated) {
      await this.logout();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  async logout() {
    // authService.logout() emits to authState$, which updates isAuthenticated via subscription
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
