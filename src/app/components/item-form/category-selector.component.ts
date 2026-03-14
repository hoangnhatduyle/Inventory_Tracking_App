import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { InventoryService } from '../../services/inventory.service';
import { Category } from '../../models/inventory.model';

@Component({
  selector: 'app-category-selector',
  standalone: true,
  imports: [CommonModule, MatListModule, MatIconModule],
  template: `
    <div class="bottom-sheet-container">
      <div class="sheet-header">
        <h2>Select Category</h2>
      </div>
      <mat-nav-list>
        <mat-list-item 
          *ngFor="let category of categories" 
          (click)="selectCategory(category)"
          class="category-item">
          <mat-icon matListItemIcon>{{ category.icon }}</mat-icon>
          <div matListItemTitle>{{ category.name }}</div>
        </mat-list-item>
      </mat-nav-list>
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

    .category-item {
      min-height: 56px;
      cursor: pointer;
      
      &:hover {
        background: rgba(0, 0, 0, 0.04);
      }
      
      mat-icon {
        color: var(--primary-color);
      }
    }

    @media (prefers-color-scheme: dark) {
      .sheet-header {
        border-bottom-color: rgba(255, 255, 255, 0.12);
      }
      
      .category-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  `]
})
export class CategorySelectorComponent implements OnInit {
  categories: Category[] = [];

  constructor(
    private bottomSheetRef: MatBottomSheetRef<CategorySelectorComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any,
    private inventoryService: InventoryService
  ) {}

  async ngOnInit() {
    this.categories = await this.inventoryService.getCategories();
  }

  selectCategory(category: Category) {
    this.bottomSheetRef.dismiss(category);
  }

  getCategoryIcon(categoryName: string): string {
    const iconMap: { [key: string]: string } = {
      'Fruits': 'apple',
      'Vegetables': 'eco',
      'Meat': 'lunch_dining',
      'Dairy': 'breakfast_dining',
      'Grains': 'grain',
      'Beverages': 'local_cafe',
      'Snacks': 'cookie',
      'Frozen': 'ac_unit',
      'Condiments': 'water_drop',
      'Bakery': 'bakery_dining',
      'Other': 'category'
    };
    return iconMap[categoryName] || 'category';
  }
}
