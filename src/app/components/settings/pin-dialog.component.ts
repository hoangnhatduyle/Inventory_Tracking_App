import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { PinService } from '../../services/pin.service';

interface DialogData {
  isSettingPin: boolean;
  purpose?: 'unlock' | 'change' | 'remove' | 'verify';
}

@Component({
  selector: 'app-pin-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.isSettingPin ? 'vpn_key' : 'lock' }}</mat-icon>
      {{ data.isSettingPin ? 'Set PIN' : 'Enter PIN' }}
    </h2>

    <mat-dialog-content>
      <div class="pin-form">
        @if (data.isSettingPin) {
        <p class="instruction">
          {{ data.purpose === 'change' ? 'Enter your new PIN (4-6 digits)' : 'Create a 4-6 digit PIN to protect admin sections' }}
        </p>
        }
        @if (!data.isSettingPin) {
        <p class="instruction">
          {{ getPromptText() }}
        </p>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>PIN</mat-label>
          <input matInput
                 type="password"
                 [(ngModel)]="pin"
                 maxlength="6"
                 pattern="[0-9]*"
                 inputmode="numeric"
                 placeholder="Enter 4-6 digits"
                 (keyup.enter)="onSubmit()">
          <mat-icon matPrefix>dialpad</mat-icon>
        </mat-form-field>

        @if (data.isSettingPin) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Confirm PIN</mat-label>
          <input matInput
                 type="password"
                 [(ngModel)]="confirmPin"
                 maxlength="6"
                 pattern="[0-9]*"
                 inputmode="numeric"
                 placeholder="Re-enter PIN"
                 (keyup.enter)="onSubmit()">
          <mat-icon matPrefix>dialpad</mat-icon>
        </mat-form-field>
        }

        @if (errorMessage) {
        <p class="error-message">
          <mat-icon>error</mat-icon>
          {{ errorMessage }}
        </p>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding: 1rem;">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!isValid()">
        <mat-icon>{{ data.isSettingPin ? 'check' : 'lock_open' }}</mat-icon>
        {{ data.isSettingPin ? 'Set PIN' : 'Unlock' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;

      mat-icon {
        color: var(--primary-color, #4CAF50);
      }
    }

    .pin-form {
      padding: 0.5rem 0;
    }

    .instruction {
      margin: 0 0 1rem 0;
      color: rgba(0, 0, 0, 0.6);
      font-size: 0.9rem;
    }

    .full-width {
      width: 100%;
      margin-bottom: 0.5rem;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #f44336;
      font-size: 0.85rem;
      margin: 0.5rem 0 0 0;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    mat-dialog-actions {
      padding: 1rem 0 0 0;
      margin: 0;

      button {
        mat-icon {
          margin-right: 0.25rem;
        }
      }
    }
  `]
})
export class PinDialogComponent {
  pin = '';
  confirmPin = '';
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<PinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private pinService: PinService
  ) {}

  getPromptText(): string {
    switch (this.data.purpose) {
      case 'unlock':
        return 'Enter your PIN to unlock admin sections';
      case 'change':
        return 'Enter your current PIN to continue';
      case 'remove':
        return 'Enter your PIN to remove protection';
      case 'verify':
        return 'Enter your current PIN to verify';
      default:
        return 'Enter your PIN';
    }
  }

  isValid(): boolean {
    if (this.pin.length < 4) return false;
    if (this.data.isSettingPin && this.pin !== this.confirmPin) return false;
    return true;
  }

  onCancel() {
    this.dialogRef.close(null);
  }

  async onSubmit() {
    this.errorMessage = '';

    if (this.pin.length < 4) {
      this.errorMessage = 'PIN must be at least 4 digits';
      return;
    }

    if (this.data.isSettingPin) {
      // Setting a new PIN
      if (this.pin !== this.confirmPin) {
        this.errorMessage = 'PINs do not match';
        return;
      }

      await this.pinService.setPin(this.pin);
      this.dialogRef.close({ success: true, message: 'PIN set successfully' });
    } else {
      // Verifying existing PIN
      const isValid = await this.pinService.verifyPin(this.pin);
      if (isValid) {
        this.dialogRef.close({ success: true, message: 'Access granted' });
      } else {
        this.errorMessage = 'Incorrect PIN';
      }
    }
  }
}
