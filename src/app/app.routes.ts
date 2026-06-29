import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

// All authenticated routes are lazy-loaded so that the login screen, the
// Material theme + ZXing scanner do not all sit in the initial bundle.
export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/inventory-list/inventory-list').then((m) => m.InventoryList),
  },
  {
    path: 'meal-plan',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/meal-plan/meal-plan').then((m) => m.MealPlanComponent),
  },
  {
    path: 'item/add',
    canActivate: [authGuard],
    loadComponent: () => import('./components/item-form/item-form').then((m) => m.ItemForm),
  },
  {
    path: 'item/edit/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./components/item-form/item-form').then((m) => m.ItemForm),
  },
  {
    path: 'shopping-list',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/shopping-list/shopping-list').then((m) => m.ShoppingList),
  },
  {
    path: 'waste-tracking',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/waste-tracking/waste-tracking').then(
        (m) => m.WasteTrackingComponent,
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./components/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'recipe-manager',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/recipe-manager/recipe-manager.component').then(
        (m) => m.RecipeManagerComponent,
      ),
  },
  {
    path: 'receipt-scan',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/receipt-scan/receipt-scan.component').then(
        (m) => m.ReceiptScanComponent,
      ),
  },
  { path: '**', redirectTo: '/dashboard' },
];
