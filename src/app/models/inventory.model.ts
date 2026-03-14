export interface InventoryItem {
  id?: number;
  userId: number;
  name: string;
  categoryId: number;
  quantity: number;
  unit: string; // 'pieces', 'kg', 'lbs', 'liters', 'gallons', etc.
  purchaseDate: string;
  expirationDate: string;
  locationId: number;
  price?: number;
  notes?: string;
  notificationEnabled: boolean;
  allowNotification?: boolean; // Alias for notificationEnabled
  notificationDaysBefore: number; // Days before expiration to notify
  
  // Barcode tracking
  barcode?: string;
  
  // Usage tracking
  initialQuantity?: number; // Original amount when purchased
  currentQuantity?: number; // Remaining amount
  usageNotes?: string; // Notes about usage/consumption
  lowStockThreshold?: number; // Percentage threshold for low stock alert (default 20%)
  
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id?: number;
  name: string;
  icon?: string;
  color?: string;
}

export interface Location {
  id?: number;
  userId: number;
  name: string; // 'Fridge', 'Freezer', 'Pantry'
  subLocation?: string; // 'Top Shelf', 'Drawer 2', etc.
}

export interface ItemImage {
  id?: number;
  itemId: number;
  imagePath: string;
  imageData?: string; // Base64 encoded image data
  isPrimary: boolean;
  createdAt?: string;
}

export interface ShoppingListItem {
  id?: number;
  userId: number;
  name: string;
  quantity?: string;
  notes?: string;
  categoryId?: number;
  isPurchased: boolean;
  createdAt?: string;
}

export interface NotificationLog {
  id?: number;
  itemId: number;
  notificationDate: string;
  sent: boolean;
}

export interface BarcodeMapping {
  id?: number;
  barcode: string;
  itemName: string;
  categoryId: number;
  userId: number;
  createdAt?: string;
  suggestedShelfLifeDays?: number | null;
  aiNote?: string | null;
  price?: number | null;
  imagePath?: string | null;
  locationId?: number | null;
}

export interface UsageHistory {
  id?: number;
  itemId: number;
  amountUsed: number;
  remainingAmount: number;
  notes?: string;
  recordedAt: string;
}

export interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  count: number;
  percentage: number;
}

export interface LocationBreakdown {
  locationId: number;
  locationName: string;
  count: number;
  percentage: number;
}

export interface WastedItem {
  id: number;
  name: string;
  price?: number;
  wastedDate: string;
  reason: string;
}

export interface InventoryBatch {
  id?: number;
  itemId?: number;
  item_id?: number; // Database column name
  quantity: number;
  expirationDate?: string; // YYYY-MM-DD format
  expiration_date?: string; // Database column name
  purchaseDate?: string; // YYYY-MM-DD format
  purchase_date?: string; // Database column name
  price?: number; // Price per unit for this batch
  notes?: string; // Batch-specific notes
  createdAt?: string;
  created_at?: string; // Database column name
}
