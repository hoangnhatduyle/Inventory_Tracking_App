import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';

// Wraps an <img> tag so a caller can pass a *Supabase Storage path* (the value
// stored in inventory_items.item_images.image_path) without having to resolve
// it to a short-lived signed URL themselves. The resolution is cached for the
// lifetime of the component instance.
//
// Use this when you are rendering an image whose URL you have not already
// fetched. For lists where you batch-load and cache URLs (see inventory-list's
// itemImages Map), keep using the plain <img [src]="url"> pattern - that's
// fewer requests for large grids.
@Component({
  selector: 'app-signed-image',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      *ngIf="resolved; else fallbackTpl"
      [src]="resolved"
      [alt]="alt"
      [class]="cssClass"
      loading="lazy"
      decoding="async"
    />
    <ng-template #fallbackTpl>
      <span *ngIf="!path" class="signed-image--empty" [attr.aria-label]="alt"></span>
      <span *ngIf="path && !resolved && !errored" class="signed-image--loading" [attr.aria-label]="alt + ' (loading)'"></span>
      <span *ngIf="errored" class="signed-image--error" [attr.aria-label]="alt + ' (failed to load)'"></span>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      img {
        max-width: 100%;
        display: block;
      }
      .signed-image--empty,
      .signed-image--loading,
      .signed-image--error {
        display: inline-block;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.06);
      }
    `,
  ],
})
export class SignedImageComponent implements OnChanges {
  @Input() path: string | null = null;
  @Input() alt = '';
  @Input() cssClass = '';

  resolved: string | null = null;
  errored = false;

  private readonly images = inject(ImageService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Track which `path` was last requested so a stale resolution can't overwrite
  // a fresher one if the bound value changes while the previous fetch is still
  // in flight.
  private lastRequested: string | null = null;

  async ngOnChanges(changes: SimpleChanges) {
    if (!('path' in changes)) return;
    const wanted = this.path;
    this.lastRequested = wanted;
    this.errored = false;
    this.resolved = null;
    if (!wanted) {
      this.cdr.markForCheck();
      return;
    }
    try {
      const url = await this.images.getImageUrl(wanted);
      if (this.lastRequested !== wanted) return;
      if (url) {
        this.resolved = url;
      } else {
        this.errored = true;
      }
    } catch {
      if (this.lastRequested === wanted) {
        this.errored = true;
      }
    } finally {
      this.cdr.markForCheck();
    }
  }
}
