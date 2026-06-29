export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlan {
  id?: number;
  userId?: string;
  planDate: string;
  mealType: MealType;
  mealName: string;
  recipeId?: number | null;
  isFavorite?: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealPlanSummary {
  totalMeals: number;
  filledSlots: number;
  totalSlots: number;
  breakdownByType: { breakfast: number; lunch: number; dinner: number };
  byMealType: { breakfast: number; lunch: number; dinner: number };
  mostFrequentMeals: Array<{ name: string; mealName: string; count: number }>;
  favoriteMeals: MealPlan[];
  thisWeekCount: number;
  currentStreak: number;
  recentMeals: MealPlan[];
  monthlyBreakdown: Array<{ month: string; count: number; percentage: number }>;
  daysWithPlans: number;
  averageMealsPerDay: number;
  emptySlots: number;
  completionRate: number;
}

export interface WeekDay {
  date: Date;
  dateStr: string;
  label: string;
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
