import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Recipe } from '../../models/statistics.model';

@Component({
  selector: 'app-recipe-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEditMode ? 'edit' : 'add' }}</mat-icon>
      {{ isEditMode ? 'Edit Recipe' : 'Add New Recipe' }}
    </h2>

    <mat-dialog-content>
      <form>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Recipe Name</mat-label>
          <input matInput [(ngModel)]="formData.name" name="name" required>
          <mat-icon matPrefix>restaurant_menu</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Ingredients (comma-separated)</mat-label>
          <textarea 
            matInput 
            [(ngModel)]="formData.ingredients" 
            name="ingredients" 
            rows="4"
            required
            placeholder="e.g., chicken, rice, onion, garlic"></textarea>
          <mat-icon matPrefix>shopping_basket</mat-icon>
        </mat-form-field>

        <div class="two-column">
          <mat-form-field appearance="outline">
            <mat-label>Prep Time</mat-label>
            <input matInput [(ngModel)]="formData.prepTime" name="prepTime" placeholder="e.g., 30 minutes">
            <mat-icon matPrefix>schedule</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Servings</mat-label>
            <input matInput type="number" [(ngModel)]="formData.servings" name="servings">
            <mat-icon matPrefix>people</mat-icon>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Instructions</mat-label>
          <textarea 
            matInput 
            [(ngModel)]="formData.instructions" 
            name="instructions" 
            rows="6"
            placeholder="Step-by-step cooking instructions..."></textarea>
          <mat-icon matPrefix>description</mat-icon>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button 
        mat-raised-button 
        color="primary" 
        (click)="onSave()"
        [disabled]="!isFormValid()">
        <mat-icon>save</mat-icon>
        {{ isEditMode ? 'Update' : 'Add' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }

    h2 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    mat-dialog-content {
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    @media (max-width: 600px) {
      .two-column {
        grid-template-columns: 1fr;
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class RecipeFormDialogComponent implements OnInit {
  isEditMode = false;
  formData = {
    name: '',
    ingredients: '',
    prepTime: '',
    servings: 4,
    instructions: ''
  };

  constructor(
    public dialogRef: MatDialogRef<RecipeFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { recipe: Recipe | null }
  ) {}

  ngOnInit() {
    if (this.data.recipe) {
      this.isEditMode = true;
      this.formData = {
        name: this.data.recipe.name,
        ingredients: this.data.recipe.ingredients,
        prepTime: this.data.recipe.prepTime || '',
        servings: this.data.recipe.servings || 4,
        instructions: this.data.recipe.instructions || ''
      };
    }
  }

  isFormValid(): boolean {
    return this.formData.name.trim().length > 0 && 
           this.formData.ingredients.trim().length > 0;
  }

  onSave() {
    if (!this.isFormValid()) {
      return;
    }

    const recipe: Partial<Recipe> = {
      name: this.formData.name.trim(),
      ingredients: this.formData.ingredients.trim(),
      prepTime: this.formData.prepTime.trim() || undefined,
      servings: this.formData.servings || undefined,
      instructions: this.formData.instructions.trim() || undefined
    };

    if (this.isEditMode && this.data.recipe?.id) {
      recipe.id = this.data.recipe.id;
    }

    this.dialogRef.close(recipe);
  }

  onCancel() {
    this.dialogRef.close();
  }
}
