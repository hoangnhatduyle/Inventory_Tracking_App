import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MealPlan, MealType, MealOption, MealPlanDialogData } from '../../../models/meal-plan.model';

@Component({
  selector: 'app-meal-plan-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatSlideToggleModule
  ],
  templateUrl: './meal-plan-dialog.html',
  styleUrl: './meal-plan-dialog.scss'
})
export class MealPlanDialogComponent implements OnInit {
  isEditMode = false;

  formData = {
    planDate: '',
    mealType: 'breakfast' as MealType,
    mealName: '',
    recipeId: null as number | null,
    isFavorite: false,
    notes: ''
  };

  filteredOptions: MealOption[] = [];

  readonly mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

  constructor(
    public dialogRef: MatDialogRef<MealPlanDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MealPlanDialogData
  ) {}

  ngOnInit(): void {
    this.filteredOptions = this.data.recipeOptions.slice();

    if (this.data.entry) {
      this.isEditMode = true;
      const e = this.data.entry;
      this.formData = {
        planDate: e.planDate,
        mealType: e.mealType,
        mealName: e.mealName,
        recipeId: e.recipeId ?? null,
        isFavorite: e.isFavorite ?? false,
        notes: e.notes ?? ''
      };
    } else {
      this.formData.planDate = this.data.dateStr;
      this.formData.mealType = this.data.mealType;
    }
  }

  onMealNameChange(value: string): void {
    const query = value.toLowerCase();
    this.filteredOptions = this.data.recipeOptions.filter(
      opt => opt.label.toLowerCase().includes(query)
    );
    // Clear recipe link when user types manually
    this.formData.recipeId = null;
  }

  onOptionSelected(option: MealOption): void {
    this.formData.mealName = option.label;
    this.formData.recipeId = option.recipeId;
  }

  mealTypeIcon(type: MealType): string {
    return { breakfast: 'wb_sunny', lunch: 'lunch_dining', dinner: 'dinner_dining' }[type];
  }

  isFormValid(): boolean {
    return this.formData.mealName.trim().length > 0 && this.formData.planDate.length > 0;
  }

  onSave(): void {
    if (!this.isFormValid()) return;
    this.dialogRef.close({
      planDate: this.formData.planDate,
      mealType: this.formData.mealType,
      mealName: this.formData.mealName.trim(),
      recipeId: this.formData.recipeId,
      isFavorite: this.formData.isFavorite,
      notes: this.formData.notes.trim() || undefined
    } as Partial<MealPlan>);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
