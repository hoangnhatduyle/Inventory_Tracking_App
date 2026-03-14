import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { StatisticsService } from '../../services/statistics.service';
import { Recipe } from '../../models/statistics.model';
import { RecipeFormDialogComponent } from '../../components/recipe-manager/recipe-form-dialog.component';

@Component({
  selector: 'app-recipe-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule
  ],
  template: `
    <div class="recipe-manager-container">
      <div class="header">
        <button mat-icon-button (click)="onBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Recipe Manager</h1>
        <button mat-fab color="primary" (click)="onAddRecipe()" class="fab-button">
          <mat-icon>add</mat-icon>
        </button>
      </div>

      <mat-card class="search-card">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Search recipes...</mat-label>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="filterRecipes()">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
      </mat-card>

      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <div class="recipes-list" *ngIf="!isLoading">
        <mat-card *ngFor="let recipe of pagedRecipes" class="recipe-card">
          <mat-card-content>
            <div class="recipe-header">
              <h2>{{ recipe.name }}</h2>
              <div class="recipe-actions">
                <button mat-icon-button (click)="onEditRecipe(recipe)" color="primary">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button (click)="onDeleteRecipe(recipe)" color="warn">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <div class="recipe-meta">
              <div class="meta-item">
                <mat-icon>schedule</mat-icon>
                <span>{{ recipe.prepTime }}</span>
              </div>
              <div class="meta-item">
                <mat-icon>restaurant</mat-icon>
                <span>{{ recipe.servings }} servings</span>
              </div>
            </div>

            <mat-divider></mat-divider>

            <div class="recipe-ingredients">
              <strong>Ingredients:</strong>
              <div class="ingredient-chips">
                <span *ngFor="let ingredient of getIngredientsList(recipe)" class="chip">
                  {{ ingredient }}
                </span>
              </div>
            </div>

            <div *ngIf="recipe.instructions" class="recipe-instructions">
              <strong>Instructions:</strong>
              <p>{{ recipe.instructions }}</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-paginator
          *ngIf="filteredRecipes.length > pageSize"
          [length]="filteredRecipes.length"
          [pageSize]="pageSize"
          [pageSizeOptions]="[12, 24, 48]"
          [pageIndex]="pageIndex"
          (page)="onPageChange($event)"
          aria-label="Select page">
        </mat-paginator>

        <div *ngIf="filteredRecipes.length === 0" class="empty-state">
          <mat-icon>menu_book</mat-icon>
          <p>No recipes found</p>
          <button mat-raised-button color="primary" (click)="onAddRecipe()">
            <mat-icon>add</mat-icon>
            Add Your First Recipe
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .recipe-manager-container {
      padding: 16px;
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      position: relative;
    }

    .header h1 {
      flex: 1;
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .fab-button {
      position: fixed !important;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
    }

    .search-card {
      margin-bottom: 16px;
    }

    .full-width {
      width: 100%;
    }

    .recipes-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 80px;
    }

    .recipe-card {
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .recipe-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .recipe-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .recipe-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      flex: 1;
    }

    .recipe-actions {
      display: flex;
      gap: 4px;
    }

    .recipe-meta {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(0, 0, 0, 0.6);
    }

    .meta-item mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    mat-divider {
      margin: 16px 0;
    }

    .recipe-ingredients {
      margin-bottom: 16px;
    }

    .recipe-ingredients strong {
      display: block;
      margin-bottom: 8px;
      color: rgba(0, 0, 0, 0.87);
    }

    .ingredient-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-block;
      padding: 4px 12px;
      background: #e0e0e0;
      border-radius: 16px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.87);
    }

    .recipe-instructions {
      margin-top: 16px;
    }

    .recipe-instructions strong {
      display: block;
      margin-bottom: 8px;
      color: rgba(0, 0, 0, 0.87);
    }

    .recipe-instructions p {
      margin: 0;
      color: rgba(0, 0, 0, 0.6);
      line-height: 1.5;
    }

    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: rgba(0, 0, 0, 0.54);
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .empty-state p {
      font-size: 16px;
      margin-bottom: 24px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
    }
  `]
})
export class RecipeManagerComponent implements OnInit {
  recipes: Recipe[] = [];
  filteredRecipes: Recipe[] = [];
  searchQuery = '';
  isLoading = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  pageSize = 12;
  pageIndex = 0;

  get pagedRecipes(): Recipe[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredRecipes.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  constructor(
    private router: Router,
    private statisticsService: StatisticsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadRecipes();
  }

  async loadRecipes() {
    this.isLoading = true;
    try {
      this.recipes = await this.statisticsService.getAllRecipes();
      this.filterRecipes();
    } catch (error) {
      this.snackBar.open('Failed to load recipes', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  filterRecipes() {
    if (!this.searchQuery.trim()) {
      this.filteredRecipes = [...this.recipes];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredRecipes = this.recipes.filter(recipe =>
        recipe.name.toLowerCase().includes(query) ||
        recipe.ingredients.toLowerCase().includes(query)
      );
    }
    this.pageIndex = 0;
    if (this.paginator) this.paginator.firstPage();
  }

  getIngredientsList(recipe: Recipe): string[] {
    return recipe.ingredients.split(',').map(i => i.trim());
  }

  onAddRecipe() {
    const dialogRef = this.dialog.open(RecipeFormDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      data: { recipe: null }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.statisticsService.addRecipe(result);
        if (success) {
          this.snackBar.open('Recipe added successfully!', 'Close', { duration: 3000 });
          await this.loadRecipes();
        } else {
          this.snackBar.open('Failed to add recipe', 'Close', { duration: 3000 });
        }
      }
    });
  }

  onEditRecipe(recipe: Recipe) {
    const dialogRef = this.dialog.open(RecipeFormDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      data: { recipe }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.statisticsService.updateRecipe(result);
        if (success) {
          this.snackBar.open('Recipe updated successfully!', 'Close', { duration: 3000 });
          await this.loadRecipes();
        } else {
          this.snackBar.open('Failed to update recipe', 'Close', { duration: 3000 });
        }
      }
    });
  }

  async onDeleteRecipe(recipe: Recipe) {
    if (confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
      const success = await this.statisticsService.deleteRecipe(recipe.id!);
      if (success) {
        this.snackBar.open('Recipe deleted successfully!', 'Close', { duration: 3000 });
        await this.loadRecipes();
      } else {
        this.snackBar.open('Failed to delete recipe', 'Close', { duration: 3000 });
      }
    }
  }

  onBack() {
    this.router.navigate(['/settings']);
  }
}
