import { z } from 'zod';
import { dateString, optionalText, positiveNumber, requiredText } from './validation.js';

// ----- inventory ------------------------------------------------------------

export const inventoryItemCreate = z.object({
  name: requiredText(200),
  categoryId: z.coerce.number().int().positive(),
  quantity: positiveNumber,
  unit: requiredText(30),
  purchaseDate: dateString.optional().nullable(),
  expirationDate: dateString,
  locationId: z.coerce.number().int().positive().optional().nullable(),
  price: positiveNumber.optional().nullable(),
  notes: optionalText(1000),
  notificationEnabled: z.boolean().optional().default(true),
  notificationDaysBefore: z.coerce.number().int().min(0).max(365).optional().default(3),
  barcode: optionalText(120),
  initialQuantity: positiveNumber.optional().nullable(),
  currentQuantity: positiveNumber.optional().nullable(),
  lowStockThreshold: positiveNumber.optional().nullable(),
});
export type InventoryItemCreate = z.infer<typeof inventoryItemCreate>;

export const inventoryItemUpdate = inventoryItemCreate.partial();
export type InventoryItemUpdate = z.infer<typeof inventoryItemUpdate>;

// ----- batches --------------------------------------------------------------

export const batchCreate = z.object({
  itemId: z.coerce.number().int().positive(),
  quantity: positiveNumber,
  expirationDate: dateString.optional().nullable(),
  purchaseDate: dateString,
  price: positiveNumber.optional().nullable(),
  notes: optionalText(500),
});
export type BatchCreate = z.infer<typeof batchCreate>;

// ----- shopping list --------------------------------------------------------

export const shoppingItemCreate = z.object({
  name: requiredText(200),
  quantity: optionalText(60),
  notes: optionalText(500),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
});

export const shoppingItemUpdate = shoppingItemCreate.partial().extend({
  isPurchased: z.boolean().optional(),
});

// ----- locations ------------------------------------------------------------

export const locationCreate = z.object({
  name: requiredText(100),
  subLocation: optionalText(100),
});

export const locationUpdate = locationCreate.partial();

// ----- categories -----------------------------------------------------------

export const categoryCreate = z.object({
  name: requiredText(100),
  icon: optionalText(60),
  color: optionalText(30),
});

export const categoryUpdate = categoryCreate.partial();

// ----- meal plans -----------------------------------------------------------

export const mealType = z.enum(['breakfast', 'lunch', 'dinner']);

export const mealPlanCreate = z.object({
  planDate: dateString,
  mealType,
  mealName: requiredText(200),
  recipeId: z.coerce.number().int().positive().optional().nullable(),
  isFavorite: z.boolean().optional().default(false),
  notes: optionalText(500),
});

export const mealPlanUpdate = mealPlanCreate.partial();

// ----- recipes --------------------------------------------------------------

export const recipeCreate = z.object({
  name: requiredText(200),
  ingredients: requiredText(5000),
  prepTime: optionalText(50),
  servings: z.coerce.number().int().positive().optional().nullable(),
  instructions: optionalText(10000),
});

export const recipeUpdate = recipeCreate.partial();

// ----- waste ----------------------------------------------------------------

export const wasteCreate = z.object({
  itemName: requiredText(200),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  quantity: positiveNumber,
  unit: requiredText(30),
  price: positiveNumber.optional().nullable(),
  wastedDate: z.string().datetime().optional(),
});

// ----- AI -------------------------------------------------------------------

export const expirationSuggestRequest = z.object({
  itemName: requiredText(200),
  categoryName: optionalText(100),
  storageLocation: optionalText(100),
  purchaseDate: dateString.optional(),
});

export const receiptScanRequest = z.object({
  imagePath: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9-]+\/(items|receipts)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i, {
      message: 'imagePath must be <userId>/<scope>/<uuid>.<ext> within the bucket',
    }),
});

// ----- uploads --------------------------------------------------------------

export const signUploadRequest = z.object({
  scope: z.enum(['items', 'receipts']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  ext: z.enum(['jpg', 'jpeg', 'png', 'webp']),
});
