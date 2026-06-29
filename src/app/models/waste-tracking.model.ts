export interface WastedItem {
  id?: number;
  userId?: string;
  itemName: string;
  categoryId?: number | null;
  categoryName?: string;
  quantity: number;
  unit: string;
  price?: number | null;
  wastedDate: string;
}

export interface WasteStatistics {
  totalItemsWasted: number;
  totalValueLost: number;
  wasteByCategory: WasteCategoryStats[];
  wasteByMonth: WasteMonthStats[];
}

export interface WasteCategoryStats {
  categoryId: number;
  categoryName: string;
  itemsWasted: number;
  valueLost: number;
}

export interface WasteMonthStats {
  month: string;
  itemsWasted: number;
  valueLost: number;
}
