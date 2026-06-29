import { InventoryItem } from './inventory.model';

// DashboardStatistics is the response shape from /api/statistics/dashboard
// after StatisticsService.getDashboardStatistics() hydrates the raw payload.
// All fields are required so templates can bind without null checks.
export interface DashboardStatistics {
  totalItems: number;
  totalValue: number;
  expiringCount: number;
  expiringSoon: InventoryItem[];
  expiredCount: number;
  lowStock: InventoryItem[];
  categoryBreakdown: CategoryStats[];
  locationBreakdown: LocationStats[];
  wastedItems: WastedItemStats[];
  totalWastedValue: number;
  totalSpentValue: number;
  waste30dCount: number;
  waste30dValue: number;
}

export interface CategoryStats {
  categoryName: string;
  count: number;
  totalValue: number;
}

export interface LocationStats {
  locationName: string;
  count: number;
}

export interface WastedItemStats {
  itemName: string;
  categoryName: string;
  timesWasted: number;
  totalValue: number;
}

export interface Recipe {
  id?: number;
  name: string;
  ingredients: string;
  ingredientsList?: string[];
  matchingItems?: string[];
  matchCount?: number;
  prepTime?: string;
  servings?: number;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
}
