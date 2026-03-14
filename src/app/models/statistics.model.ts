export interface DashboardStatistics {
  totalItems: number;
  totalValue: number;
  expiringSoon: number;  // Alias for expiringIn3Days
  expiringIn3Days?: number;
  expiringInWeek?: number;
  expired: number;  // Alias for expiredItems
  expiredItems?: number;
  categoryBreakdown: CategoryStats[];
  locationBreakdown: LocationStats[];
  mostWastedItems: WastedItemStats[];
  wastedItems: WastedItemStats[];  // Alias for mostWastedItems
  recentItems: any[];
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
  ingredients: string; // Comma-separated string from database
  ingredientsList?: string[]; // Parsed array for matching logic
  matchingItems?: string[];
  matchCount?: number;
  prepTime: string;
  servings: number;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
}
