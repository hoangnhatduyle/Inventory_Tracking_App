# Inventory Tracking App

A comprehensive offline inventory tracking application for managing grocery inventory, expiration dates, and sending local notifications.

## Features

### Core Features
- ✅ User authentication with session management
- ✅ Add, edit, and delete inventory items
- ✅ Category management (Dairy, Produce, Meat, Seafood, Frozen, Pantry, etc.)
- ✅ Expiration date tracking with local notifications
- ✅ Quantity tracking with customizable units
- ✅ Location tracking (Fridge, Freezer, Pantry with sub-locations)
- ✅ Multiple images per item
- ✅ Search and filter inventory
- ✅ Shopping list with export
- ✅ Statistics dashboard
- ✅ Dark/Light mode
- ✅ Export/Import data (CSV)
- ✅ Recipe suggestions based on expiring items

## Tech Stack

- **Frontend**: Angular 18 + Angular Material
- **Mobile**: Capacitor (APK packaging)
- **Database**: SQLite (embedded, offline)
- **Authentication**: Local with encrypted passwords

## Quick Start

### Prerequisites
- Node.js 18+
- Angular CLI
- Android Studio (for APK builds)

### Installation

```bash
# Install dependencies
npm install

# Run development server
ng serve
```

Navigate to `http://localhost:4200/`

### Build for Production

```bash
# Build Angular app
ng build --configuration production

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Build APK in Android Studio
# Build > Build Bundle(s) / APK(s) > Build APK(s)
```

## APK Installation on Fire Max 11 Tablet

1. Build APK using steps above
2. Transfer APK to tablet
3. Enable "Install from Unknown Sources"
4. Install APK

## Usage

### First Time
1. Register an account
2. Set up storage locations
3. Grant notification permissions

### Add Items
1. Go to Inventory
2. Click "+" button
3. Fill in item details
4. Add images (optional)
5. Save

### Shopping List
1. Add items manually or from expired inventory
2. Check off purchased items
3. Export to text for offline use

### Dashboard
- View total items and value
- See expiring items
- Check category/location breakdown
- Get recipe suggestions

## Database Schema

- **users** - Authentication
- **sessions** - Session management
- **categories** - Item categories
- **locations** - Storage locations
- **inventory_items** - Main inventory
- **item_images** - Image references
- **shopping_list** - Shopping items
- **wasted_items** - Waste tracking

## Troubleshooting

**Database Issues**: Clear app data and restart

**Notifications Not Working**: Check permissions in device settings

**Build Failures**: 
```bash
rm -rf node_modules
npm install
ng cache clean
ng build
```

## Project Structure

```
src/app/
├── components/     # UI components
├── services/       # Business logic
├── models/         # Data models
├── guards/         # Route guards
└── theme.scss      # Material theme
```

## License
Personal use only.
