export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlan {
  id?: number;
  userId: number;
  planDate: string;        // YYYY-MM-DD
  mealType: MealType;
  mealName: string;
  recipeId?: number | null;
  isFavorite: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealPlanSummary {
  totalMeals: number;
  breakdownByType: { breakfast: number; lunch: number; dinner: number };
  mostFrequentMeals: Array<{ mealName: string; count: number }>;
  favoriteMeals: MealPlan[];
  thisWeekCount: number;
  currentStreak: number;
  recentMeals: MealPlan[];
  monthlyBreakdown: Array<{ month: string; count: number; percentage: number }>;
}

export interface WeekDay {
  date: Date;
  dateStr: string;    // YYYY-MM-DD
  label: string;      // e.g. "Mon 19"
  isToday: boolean;
}

export interface MealOption {
  label: string;
  recipeId: number | null;
}

export interface MealPlanDialogData {
  entry: MealPlan | null;
  dateStr: string;
  mealType: MealType;
  recipeOptions: MealOption[];
}
