import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

type ViewMode = 'login' | 'register' | 'reset';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  loginEmail = '';
  loginPassword = '';

  registerEmail = '';
  registerPassword = '';
  registerConfirmPassword = '';

  resetEmail = '';

  isLoading = false;
  viewMode: ViewMode = 'login';

  // Mirrors so the existing HTML templates that still reference `loginUsername`
  // / `registerUsername` keep compiling during the migration. Both setters
  // forward to the canonical email fields.
  get loginUsername(): string { return this.loginEmail; }
  set loginUsername(v: string) { this.loginEmail = v; }
  get registerUsername(): string { return this.registerEmail; }
  set registerUsername(v: string) { this.registerEmail = v; }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('reason') === 'session-expired') {
        this.showMessage('Your session expired - please sign in again.');
      }
    });
  }

  async onLogin() {
    if (!this.loginEmail || !this.loginPassword) {
      this.showMessage('Please enter your email and password');
      return;
    }
    this.isLoading = true;
    try {
      const result = await this.authService.login(this.loginEmail, this.loginPassword);
      if (result.success) {
        void this.router.navigate(['/dashboard']);
      } else {
        this.showMessage(result.message);
      }
    } catch {
      this.showMessage('Login failed. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async onRegister() {
    if (!this.registerEmail || !this.registerPassword) {
      this.showMessage('Please fill in all required fields');
      return;
    }
    if (this.registerPassword !== this.registerConfirmPassword) {
      this.showMessage('Passwords do not match');
      return;
    }
    if (this.registerPassword.length < 12) {
      this.showMessage('Password must be at least 12 characters long');
      return;
    }
    this.isLoading = true;
    try {
      const result = await this.authService.register(this.registerEmail, this.registerPassword);
      if (result.success) {
        this.showMessage(result.message);
        this.registerEmail = '';
        this.registerPassword = '';
        this.registerConfirmPassword = '';
        this.switchToLogin();
      } else {
        this.showMessage(result.message);
      }
    } catch {
      this.showMessage('Registration failed. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async onRequestReset() {
    if (!this.resetEmail) {
      this.showMessage('Please enter your email');
      return;
    }
    this.isLoading = true;
    try {
      const r = await this.authService.requestPasswordReset(this.resetEmail);
      this.showMessage(r.message);
      if (r.success) this.switchToLogin();
    } finally {
      this.isLoading = false;
    }
  }

  switchToRegister() { this.viewMode = 'register'; }
  switchToLogin() { this.viewMode = 'login'; }
  switchToReset() { this.viewMode = 'reset'; }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
