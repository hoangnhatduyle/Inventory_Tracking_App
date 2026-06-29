export interface InventoryItem {
  id?: number;
  // Supabase user UUID. Note: the server ignores client-provided values and
  // always uses `auth.uid()`; this field is kept for the client-side scoping
  // helpers (locations, shopping list, etc.) and audit logs only.
  userId: string;
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
  userId?: string | null;
  isSystem?: boolean;
}

export interface Location {
  id?: number;
  userId: string;
  name: string; // 'Fridge', 'Freezer', 'Pantry'
  subLocation?: string; // 'Top Shelf', 'Drawer 2', etc.
}

export interface ItemImage {
  id?: number;
  itemId: number;
  // Path inside the Supabase Storage bucket `inventory-images`, in the form
  // `<userId>/<scope>/<uuid>.<ext>`. Resolve to a viewable URL via
  // ImageService.getImageUrl(). Legacy components still call this `imagePath`.
  imagePath: string;
  storagePath?: string;
  imageData?: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface ShoppingListItem {
  id?: number;
  userId: string;
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
  userId: string;
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
  userId?: string;
  name: string;
  price?: number;
  wastedDate: string;
  reason: string;
}

export interface InventoryBatch {
  id?: number;
  itemId?: number;
  item_id?: number;
  quantity: number;
  expirationDate?: string | null;
  expiration_date?: string;
  purchaseDate?: string | null;
  purchase_date?: string;
  price?: number | null;
  notes?: string | null;
  createdAt?: string;
  created_at?: string;
}
