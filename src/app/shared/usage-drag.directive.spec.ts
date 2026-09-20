import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { UsageDragDirective } from './usage-drag.directive';

@Component({
  standalone: true,
  imports: [UsageDragDirective],
  template: `<div
    id="bar"
    [appUsageDrag]="max"
    (dragPreview)="previews.push($event)"
    (dragEnd)="ended.push($event)"
    (dragReset)="resets = resets + 1"
  ></div>`,
})
class HostComponent {
  max = 100;
  previews: number[] = [];
  ended: number[] = [];
  resets = 0;
}

describe('UsageDragDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let bar: HTMLElement;

  const BAR_LEFT = 0;
  const BAR_WIDTH = 200; // 2px per percent

  const pointer = (type: string, percentOfBar: number) =>
    bar.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        button: 0,
        clientX: BAR_LEFT + (percentOfBar / 100) * BAR_WIDTH,
        bubbles: true,
      }),
    );

  const dragTo = (from: number, to: number) => {
    pointer('pointerdown', from);
    pointer('pointermove', to);
    pointer('pointerup', to);
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    bar = fixture.debugElement.query(By.css('#bar')).nativeElement;
    bar.style.width = `${BAR_WIDTH}px`;
    bar.style.display = 'block';
    bar.setPointerCapture = () => undefined;
    bar.releasePointerCapture = () => undefined;
    bar.hasPointerCapture = () => false;
  });

  it('snaps the dragged value to the nearest 5%', () => {
    dragTo(100, 47);
    expect(fixture.componentInstance.previews).toEqual([45]);
    expect(fixture.componentInstance.ended).toEqual([45]);
  });

  it('snaps up as well as down', () => {
    dragTo(100, 63);
    expect(fixture.componentInstance.ended).toEqual([65]);
  });

  it('can reach 0%', () => {
    dragTo(100, 1);
    expect(fixture.componentInstance.ended).toEqual([0]);
  });

  it('never exceeds the current value', () => {
    fixture.componentInstance.max = 60;
    fixture.detectChanges();
    dragTo(30, 90);
    // Dragging past the current value is "no change", not a raise.
    expect(fixture.componentInstance.ended).toEqual([]);
    expect(fixture.componentInstance.resets).toBe(1);
  });

  it('treats the right end as unchanged when the current value is not a multiple of 5', () => {
    fixture.componentInstance.max = 24;
    fixture.detectChanges();
    dragTo(10, 24);
    expect(fixture.componentInstance.ended).toEqual([]);
    expect(fixture.componentInstance.resets).toBe(1);
  });

  it('snaps below a non-multiple current value', () => {
    fixture.componentInstance.max = 24;
    fixture.detectChanges();
    dragTo(20, 9);
    expect(fixture.componentInstance.ended).toEqual([10]);
  });
});
