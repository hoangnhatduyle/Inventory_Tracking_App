import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { MealPlanService } from '../../services/meal-plan.service';
import { MealPlan, MealType, WeekDay, MealOption, MealPlanSummary } from '../../models/meal-plan.model';
import { MealPlanDialogComponent } from './meal-plan-dialog/meal-plan-dialog';
import { RecipeManagerComponent } from '../recipe-manager/recipe-manager.component';
import { toLocalDateString } from '../../utils/date.utils';

@Component({
  selector: 'app-meal-plan',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    MatChipsModule,
    MatTooltipModule,
    RecipeManagerComponent,
    DragDropModule
  ],
  templateUrl: './meal-plan.html',
  styleUrl: './meal-plan.scss'
})
export class MealPlanComponent implements OnInit {
  userId: string | null = null;
  activeView: 'calendar' | 'meals' | 'summary' = 'calendar';
  calendarMode: 'weekly' | 'monthly' = 'weekly';
  loading = false;

  // Weekly. Initialized at declaration so `periodLabel` is never read before
  // ngOnInit sets them (the template renders during ngOnInit's first await).
  currentWeekStart: Date = this.getWeekStart(new Date());
  weekDays: WeekDay[] = [];
  weeklyMeals: MealPlan[] = [];

  // Monthly
  currentMonthYear: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  monthDays: (WeekDay | null)[][] = [];
  monthlyMeals: MealPlan[] = [];

  // Summary
  summary: MealPlanSummary | null = null;

  // Autocomplete source for dialog
  recipeOptions: MealOption[] = [];

  readonly mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

  constructor(
    private authService: AuthService,
    private mealPlanService: MealPlanService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.authService.getCurrentUser();
    if (!user) return;
    this.userId = user.id!;

    const today = new Date();
    this.currentWeekStart = this.getWeekStart(today);
    this.currentMonthYear = new Date(today.getFullYear(), today.getMonth(), 1);

    this.recipeOptions = await this.mealPlanService.getRecipeNames();

    this.buildWeekDays();
    this.buildMonthGrid();
    await this.loadWeeklyMeals();
  }

  // ---- View control ----

  async onViewToggle(): Promise<void> {
    if (this.activeView === 'summary' && !this.summary) {
      await this.loadSummary();
    }
  }

  // ---- Calendar navigation ----

  get periodLabel(): string {
    if (this.calendarMode === 'weekly') {
      const end = new Date(this.currentWeekStart);
      end.setDate(end.getDate() + 6);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const startStr = this.currentWeekStart.toLocaleDateString('en-US', opts);
      const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
      return `${startStr} – ${endStr}`;
    }
    return this.currentMonthYear.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  navigate(direction: -1 | 1): void {
    if (this.calendarMode === 'weekly') {
      this.currentWeekStart = new Date(this.currentWeekStart);
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + direction * 7);
      this.buildWeekDays();
      this.loadWeeklyMeals();
    } else {
      this.currentMonthYear = new Date(this.currentMonthYear);
      this.currentMonthYear.setMonth(this.currentMonthYear.getMonth() + direction);
      this.buildMonthGrid();
      this.loadMonthlyMeals();
    }
  }

  goToToday(): void {
    const today = new Date();
    this.currentWeekStart = this.getWeekStart(today);
    this.currentMonthYear = new Date(today.getFullYear(), today.getMonth(), 1);
    if (this.calendarMode === 'weekly') {
      this.buildWeekDays();
      this.loadWeeklyMeals();
    } else {
      this.buildMonthGrid();
      this.loadMonthlyMeals();
    }
  }

  async onCalendarModeChange(): Promise<void> {
    if (this.calendarMode === 'monthly' && this.monthlyMeals.length === 0) {
      await this.loadMonthlyMeals();
    }
  }

  onMonthDayClick(day: WeekDay): void {
    this.calendarMode = 'weekly';
    this.currentWeekStart = this.getWeekStart(day.date);
    this.buildWeekDays();
    this.loadWeeklyMeals();
  }

  // ---- Data loading ----

  async loadWeeklyMeals(): Promise<void> {
    if (!this.userId) return;
    this.loading = true;
    try {
      this.weeklyMeals = await this.mealPlanService.getMealsByWeek(
        toLocalDateString(this.currentWeekStart),
      );
    } finally {
      this.loading = false;
    }
  }

  async loadMonthlyMeals(): Promise<void> {
    if (!this.userId) return;
    this.loading = true;
    try {
      this.monthlyMeals = await this.mealPlanService.getMealsByMonth(
        this.currentMonthYear.getFullYear(),
        this.currentMonthYear.getMonth(),
      );
    } finally {
      this.loading = false;
    }
  }

  async loadSummary(): Promise<void> {
    if (!this.userId) return;
    this.loading = true;
    try {
      this.summary = await this.mealPlanService.getSummary();
    } finally {
      this.loading = false;
    }
  }

  // ---- Grid helpers ----

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private buildWeekDays(): void {
    const todayStr = toLocalDateString(new Date());
    this.weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateString(d);
      return {
        date: d,
        dateStr,
        label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        isToday: dateStr === todayStr
      };
    });
  }

  private buildMonthGrid(): void {
    const todayStr = toLocalDateString(new Date());
    const year = this.currentMonthYear.getFullYear();
    const month = this.currentMonthYear.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    const flat: (WeekDay | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        flat.push(null);
      } else {
        const d = new Date(year, month, dayNum);
        const dateStr = toLocalDateString(d);
        flat.push({ date: d, dateStr, label: String(dayNum), isToday: dateStr === todayStr });
      }
    }

    this.monthDays = [];
    for (let w = 0; w < flat.length / 7; w++) {
      this.monthDays.push(flat.slice(w * 7, w * 7 + 7));
    }
  }

  getMealsForCell(dateStr: string, mealType: MealType): MealPlan[] {
    return this.weeklyMeals.filter(m => m.planDate === dateStr && m.mealType === mealType);
  }

  getMealsForDay(dateStr: string): MealPlan[] {
    return this.monthlyMeals.filter(m => m.planDate === dateStr);
  }

  hasMealType(dateStr: string, mealType: MealType): boolean {
    return this.monthlyMeals.some(m => m.planDate === dateStr && m.mealType === mealType);
  }

  getMealNameForType(dateStr: string, mealType: MealType): string | null {
    const meal = this.monthlyMeals.find(m => m.planDate === dateStr && m.mealType === mealType);
    return meal ? meal.mealName : null;
  }

  mealTypeIcon(type: MealType): string {
    return { breakfast: 'wb_sunny', lunch: 'lunch_dining', dinner: 'dinner_dining' }[type];
  }

  // ---- Dialog actions ----

  openAddDialog(dateStr: string, mealType: MealType): void {
    if (!this.userId) return;
    const ref = this.dialog.open(MealPlanDialogComponent, {
      width: '480px',
      data: { entry: null, dateStr, mealType, recipeOptions: this.recipeOptions }
    });
    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      await this.mealPlanService.addMealPlan({ ...result, userId: this.userId! });
      if (!result.recipeId) {
        // Refresh autocomplete: the API auto-upserts custom meal names into
        // the user's recipe library on addMealPlan.
        this.recipeOptions = await this.mealPlanService.getRecipeNames();
      }
      await this.loadWeeklyMeals();
      if (this.calendarMode === 'monthly') await this.loadMonthlyMeals();
    });
  }

  openEditDialog(entry: MealPlan): void {
    const ref = this.dialog.open(MealPlanDialogComponent, {
      width: '480px',
      data: { entry, dateStr: entry.planDate, mealType: entry.mealType, recipeOptions: this.recipeOptions }
    });
    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      await this.mealPlanService.updateMealPlan({ ...entry, ...result });
      if (!result.recipeId) {
        this.recipeOptions = await this.mealPlanService.getRecipeNames();
      }
      await this.loadWeeklyMeals();
      if (this.calendarMode === 'monthly') await this.loadMonthlyMeals();
      if (this.activeView === 'summary') await this.loadSummary();
    });
  }

  async onToggleFavorite(entry: MealPlan, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.mealPlanService.toggleFavorite(entry);
    if (ok) {
      entry.isFavorite = !entry.isFavorite;
    } else {
      this.snackBar.open('Failed to update favorite', 'Close', { duration: 3000 });
    }
  }

  async onDeleteEntry(entry: MealPlan, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!confirm(`Remove "${entry.mealName}" from your meal plan?`)) return;
    const ok = await this.mealPlanService.deleteMealPlan(entry.id!);
    if (ok) {
      this.weeklyMeals = this.weeklyMeals.filter(m => m.id !== entry.id);
      this.monthlyMeals = this.monthlyMeals.filter(m => m.id !== entry.id);
      if (this.summary) {
        this.summary.favoriteMeals = this.summary.favoriteMeals.filter((m) => m.id !== entry.id);
        this.summary.recentMeals = this.summary.recentMeals.filter((m) => m.id !== entry.id);
      }
    } else {
      this.snackBar.open('Failed to delete meal', 'Close', { duration: 3000 });
    }
  }

  openSummaryEditDialog(entry: MealPlan): void {
    this.openEditDialog(entry);
  }

  async onMealDrop(event: CdkDragDrop<{ dateStr: string; mealType: MealType }>): Promise<void> {
    if (event.previousContainer === event.container) return;
    const entry: MealPlan = event.item.data;
    const { dateStr, mealType } = event.container.data;
    if (!confirm(`Copy "${entry.mealName}" to ${dateStr} (${mealType})?`)) {
      await this.loadWeeklyMeals();
      return;
    }
    await this.mealPlanService.addMealPlan({
      userId: this.userId!,
      planDate: dateStr,
      mealType,
      mealName: entry.mealName,
      recipeId: entry.recipeId ?? null,
      isFavorite: false,
      notes: entry.notes
    });
    await this.loadWeeklyMeals();
  }
}
