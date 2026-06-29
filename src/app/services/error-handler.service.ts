import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorDialog } from '../components/error-dialog/error-dialog';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  /**
   * Show a detailed error dialog
   */
  showError(title: string, message: string, error?: unknown) {
    console.error(`[${title}]`, message, error);

    let details: string | undefined;
    if (error) {
      if (error instanceof Error) {
        details = error.stack || error.message;
      } else if (typeof error === 'string') {
        details = error;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
      ) {
        details = (error as { message: string }).message;
      } else {
        details = JSON.stringify(error, null, 2);
      }
    }

    this.dialog.open(ErrorDialog, {
      width: '450px',
      data: {
        title,
        message,
        details
      },
      disableClose: false,
      panelClass: 'error-dialog-panel'
    });
  }

  /**
   * Show a quick error snackbar (for minor errors)
   */
  showQuickError(message: string, duration: number = 3000) {
    this.snackBar.open(message, 'Close', {
      duration,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  /**
   * Handle common API/database errors
   */
  handleDataError(operation: string, error: unknown) {
    let userMessage = `Failed to ${operation}. Please try again.`;

    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message ?? '')
          : '';
    const errorMsg = rawMessage.toLowerCase();
    if (errorMsg.includes('network')) {
      userMessage = `Network error while trying to ${operation}. Please check your connection.`;
    } else if (errorMsg.includes('timeout')) {
      userMessage = `Request timed out while trying to ${operation}. Please try again.`;
    } else if (errorMsg.includes('permission')) {
      userMessage = `Permission denied. Unable to ${operation}.`;
    }

    this.showError(
      'Operation Failed',
      userMessage,
      error
    );
  }

  /**
   * Show a success message with green theme
   */
  showSuccess(message: string, duration: number = 3000) {
    this.snackBar.open(message, '✓', {
      duration,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  /**
   * Show a warning message
   */
  showWarning(message: string, duration: number = 4000) {
    this.snackBar.open(message, 'OK', {
      duration,
      panelClass: ['warning-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  /**
   * Show an info message
   */
  showInfo(message: string, duration: number = 3000) {
    this.snackBar.open(message, 'Close', {
      duration,
      panelClass: ['info-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
