import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

/**
 * Camera-based barcode scanner using @zxing/browser.
 *
 * Returns the decoded barcode string when the dialog closes, or `null` if the
 * user cancelled / no camera is available.
 */
@Component({
  selector: 'app-barcode-scanner-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scanner">
      <h2>Scan a barcode</h2>
      <video #video class="scanner__video" muted playsinline></video>

      <p class="scanner__status" *ngIf="status">{{ status }}</p>

      <div class="scanner__actions">
        <button mat-button (click)="manualEntry()">Enter manually</button>
        <button mat-flat-button color="primary" (click)="cancel()">Cancel</button>
      </div>
    </div>
  `,
  styles: [
    `
      .scanner {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 280px;
      }
      .scanner__video {
        width: 100%;
        max-width: 480px;
        background: #000;
        border-radius: 8px;
        aspect-ratio: 4 / 3;
        object-fit: cover;
      }
      .scanner__status {
        margin: 0;
        font-size: 14px;
        color: #555;
      }
      .scanner__actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class BarcodeScannerDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<BarcodeScannerDialogComponent, string | null>);
  private reader: BrowserMultiFormatReader | null = null;
  private controls: IScannerControls | null = null;

  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  status = 'Requesting camera access…';

  async ngAfterViewInit(): Promise<void> {
    try {
      this.reader = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length) {
        this.status = 'No camera detected. Use "Enter manually".';
        return;
      }
      // Prefer a back-facing camera if labels expose orientation.
      const back =
        devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];

      this.controls = await this.reader.decodeFromVideoDevice(
        back.deviceId,
        this.videoRef.nativeElement,
        (result, err, controls) => {
          if (result) {
            controls.stop();
            this.dialogRef.close(result.getText());
          }
          // We intentionally ignore the periodic NotFoundException errors that
          // the scanner emits between frames.
        },
      );
      this.status = 'Point the camera at a barcode.';
    } catch (err) {
      console.error('[BarcodeScanner] camera error', err);
      this.status = 'Could not access camera. Use "Enter manually".';
    }
  }

  ngOnDestroy(): void {
    this.controls?.stop();
    this.controls = null;
    this.reader = null;
  }

  manualEntry(): void {
    const value = window.prompt('Enter barcode:');
    const trimmed = value?.trim() ?? '';
    this.dialogRef.close(trimmed || null);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
