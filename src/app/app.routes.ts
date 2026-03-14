import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { InventoryList } from './components/inventory-list/inventory-list';
import { ItemForm } from './components/item-form/item-form';
import { ShoppingList } from './components/shopping-list/shopping-list';
import { WasteTrackingComponent } from './components/waste-tracking/waste-tracking';
import { Settings } from './components/settings/settings';
import { RecipeManagerComponent } from './components/recipe-manager/recipe-manager.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'inventory', component: InventoryList, canActivate: [authGuard] },
  { path: 'item/add', component: ItemForm, canActivate: [authGuard] },
  { path: 'item/edit/:id', component: ItemForm, canActivate: [authGuard] },
  { path: 'shopping-list', component: ShoppingList, canActivate: [authGuard] },
  { path: 'waste-tracking', component: WasteTrackingComponent, canActivate: [authGuard] },
  { path: 'settings', component: Settings, canActivate: [authGuard] },
  { path: 'recipe-manager', component: RecipeManagerComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/dashboard' }
];
