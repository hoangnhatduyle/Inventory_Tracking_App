import { Component } from '@angular/core';
import { Router } from '@angular/router';
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
    MatSnackBarModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // Login form
  loginUsername = '';
  loginPassword = '';

  // Register form
  registerUsername = '';
  registerPassword = '';
  registerConfirmPassword = '';
  registerEmail = '';

  isLoading = false;
  viewMode: 'login' | 'register' = 'login';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  async onLogin() {
    if (!this.loginUsername || !this.loginPassword) {
      this.showMessage('Please fill in all fields');
      return;
    }

    this.isLoading = true;
    try {
      const result = await this.authService.login(this.loginUsername, this.loginPassword);

      if (result.success) {
        this.showMessage('Login successful!');
        this.router.navigate(['/dashboard']);
      } else {
        this.showMessage(result.message);
      }
    } catch (error) {
      this.showMessage('Login failed: ' + (error as Error).message);
    } finally {
      this.isLoading = false;
    }
  }

  async onRegister() {
    if (!this.registerUsername || !this.registerPassword) {
      this.showMessage('Please fill in required fields');
      return;
    }

    if (this.registerPassword !== this.registerConfirmPassword) {
      this.showMessage('Passwords do not match');
      return;
    }

    if (this.registerPassword.length < 6) {
      this.showMessage('Password must be at least 6 characters long');
      return;
    }

    this.isLoading = true;
    try {
      const result = await this.authService.register(
        this.registerUsername,
        this.registerPassword,
        this.registerEmail
      );

      if (result.success) {
        this.showMessage('Registration successful! Please login.');
        // Clear register form
        this.registerUsername = '';
        this.registerPassword = '';
        this.registerConfirmPassword = '';
        this.registerEmail = '';
        this.switchToLogin();
      } else {
        this.showMessage(result.message);
      }
    } catch (error) {
      this.showMessage('Registration failed: ' + (error as Error).message);
    } finally {
      this.isLoading = false;
    }
  }

  switchToRegister() {
    this.viewMode = 'register';
  }

  switchToLogin() {
    this.viewMode = 'login';
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
