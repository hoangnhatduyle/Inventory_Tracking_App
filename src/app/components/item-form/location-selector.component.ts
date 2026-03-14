import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { Location } from '../../models/inventory.model';

@Component({
  selector: 'app-location-selector',
  standalone: true,
  imports: [CommonModule, NgIf, MatListModule, MatIconModule, MatButtonModule],
  template: `
    <div class="bottom-sheet-container">
      <div class="sheet-header">
        <h2>Select Location</h2>
      </div>
      
      <mat-nav-list *ngIf="locations.length > 0">
        <mat-list-item 
          *ngFor="let location of locations" 
          (click)="selectLocation(location)"
          class="location-item">
          <mat-icon matListItemIcon>kitchen</mat-icon>
          <div matListItemTitle>{{ location.name }}</div>
          <div matListItemLine *ngIf="location.subLocation">{{ location.subLocation }}</div>
        </mat-list-item>
      </mat-nav-list>

      <div *ngIf="locations.length === 0" class="empty-state">
        <mat-icon>location_off</mat-icon>
        <p>No locations added yet</p>
        <button mat-raised-button color="primary" (click)="goToSettings()">
          <mat-icon>add</mat-icon>
          Add Location in Settings
        </button>
      </div>
    </div>
  `,
  styles: [`
    .bottom-sheet-container {
      padding: 0;
    }

    .sheet-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      
      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
      }
    }

    mat-nav-list {
      padding: 0.5rem 0;
      max-height: 60vh;
      overflow-y: auto;
    }

    .location-item {
      min-height: 56px;
      cursor: pointer;
      
      &:hover {
        background: rgba(0, 0, 0, 0.04);
      }
      
      mat-icon {
        color: var(--primary-color);
      }
    }

    .empty-state {
      text-align: center;
      padding: 2rem 1rem;
      color: rgba(0, 0, 0, 0.6);
      
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: rgba(0, 0, 0, 0.3);
        margin-bottom: 1rem;
      }
      
      p {
        margin: 0 0 1rem 0;
        font-size: 1rem;
      }
      
      button {
        min-height: 44px;
        
        mat-icon {
          width: 20px;
          height: 20px;
          font-size: 20px;
          margin-right: 8px;
          color: white;
        }
      }
    }

    @media (prefers-color-scheme: dark) {
      .sheet-header {
        border-bottom-color: rgba(255, 255, 255, 0.12);
      }
      
      .location-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      
      .empty-state {
        color: rgba(255, 255, 255, 0.7);
        
        mat-icon {
          color: rgba(255, 255, 255, 0.3);
        }
      }
    }
  `]
})
export class LocationSelectorComponent implements OnInit {
  locations: Location[] = [];

  constructor(
    private bottomSheetRef: MatBottomSheetRef<LocationSelectorComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any,
    private inventoryService: InventoryService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.locations = await this.inventoryService.getLocations(this.data.userId);
  }

  selectLocation(location: Location) {
    this.bottomSheetRef.dismiss(location);
  }

  goToSettings() {
    this.bottomSheetRef.dismiss();
    this.router.navigate(['/settings']);
  }
}
