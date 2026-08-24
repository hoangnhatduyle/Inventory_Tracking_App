import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
} from '@angular/core';

const MIN_DRAG_DISTANCE_PX = 4;

@Directive({
  selector: '[appUsageDrag]',
  standalone: true,
})
export class UsageDragDirective {
  @Input('appUsageDrag') maxPercentage = 100;

  @Output() dragPreview = new EventEmitter<number>();
  @Output() dragEnd = new EventEmitter<number>();
  @Output() dragReset = new EventEmitter<void>();

  @HostBinding('class.usage-drag-active') isDragging = false;
  @HostBinding('style.touchAction') touchAction = 'none';

  private pointerId: number | null = null;
  private startClientX = 0;
  private maxMovementPx = 0;
  private lastPercentage = 0;

  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    this.pointerId = event.pointerId;
    this.startClientX = event.clientX;
    this.maxMovementPx = 0;
    this.lastPercentage = this.computePercentage(event.clientX);
    this.isDragging = true;
    this.el.nativeElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || event.pointerId !== this.pointerId) return;

    this.maxMovementPx = Math.max(this.maxMovementPx, Math.abs(event.clientX - this.startClientX));
    this.lastPercentage = this.computePercentage(event.clientX);
    this.dragPreview.emit(this.lastPercentage);
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging || event.pointerId !== this.pointerId) return;
    this.finishDrag(event.pointerId);
  }

  @HostListener('pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    if (!this.isDragging || event.pointerId !== this.pointerId) return;
    this.finishDrag(event.pointerId, true);
  }

  private finishDrag(pointerId: number, cancelled = false): void {
    this.isDragging = false;
    if (this.el.nativeElement.hasPointerCapture(pointerId)) {
      this.el.nativeElement.releasePointerCapture(pointerId);
    }
    this.pointerId = null;

    const changed = this.lastPercentage !== Math.round(this.maxPercentage);
    const movedEnough = this.maxMovementPx >= MIN_DRAG_DISTANCE_PX;

    if (!cancelled && changed && movedEnough) {
      this.dragEnd.emit(this.lastPercentage);
    } else {
      this.dragReset.emit();
    }
  }

  private computePercentage(clientX: number): number {
    const rect = this.el.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) return Math.round(this.maxPercentage);
    const raw = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(Math.max(raw, 0), this.maxPercentage);
    return Math.round(clamped);
  }
}
