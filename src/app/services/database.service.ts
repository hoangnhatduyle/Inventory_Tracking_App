import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { toLocalDateString } from '../utils/date.utils';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;
  private isInitialized = false;
  private readonly DB_NAME = 'inventory_tracker.db';

  constructor() { }

  async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const platform = Capacitor.getPlatform();

      // For web platform, use a mock/localStorage implementation
      if (platform === 'web') {
        console.warn('Running on web - using localStorage fallback instead of SQLite.');
        console.warn('Note: For full functionality, test on Android device or emulator.');
        this.isInitialized = true;

        // Initialize localStorage mock database
        this.initializeLocalStorageFallback();
        return;
      }

      // For native platforms (Android/iOS)
      // Create connection
      this.db = await this.sqlite.createConnection(
        this.DB_NAME,
        false,
        'no-encryption',
        1,
        false
      );

      // Open database
      await this.db.open();

      // Create tables
      await this.createTables();

      // Insert default categories if they don't exist
      await this.insertDefaultCategories();

      // Run any schema migrations (e.g., shopping_list column updates)
      await this.migrateShoppingListSchema();
      
      // Run AI features migration
      await this.migrateAIFeaturesSchema();

      // Migrate existing items to batch tracking
      await this.migrateToBatchTracking();

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private initializeLocalStorageFallback(): void {
    // Initialize localStorage structure if not exists
    if (!localStorage.getItem('inventory_db')) {
      const initialDb = {
        users: [],
        sessions: [],
        categories: [
          { id: 1, name: 'Dairy', icon: '🥛', color: '#FFEB3B' },
          { id: 2, name: 'Produce', icon: '🥬', color: '#4CAF50' },
          { id: 3, name: 'Meat', icon: '🥩', color: '#F44336' },
          { id: 4, name: 'Seafood', icon: '🐟', color: '#03A9F4' },
          { id: 5, name: 'Frozen', icon: '❄️', color: '#00BCD4' },
          { id: 6, name: 'Pantry', icon: '🥫', color: '#FF9800' },
          { id: 7, name: 'Beverages', icon: '🥤', color: '#9C27B0' },
          { id: 8, name: 'Snacks', icon: '🍿', color: '#E91E63' },
          { id: 9, name: 'Condiments', icon: '🧂', color: '#795548' },
          { id: 10, name: 'Bakery', icon: '🍞', color: '#FFC107' },
          { id: 11, name: 'Fruit', icon: '🍎', color: '#F2B2B2' },
          { id: 12, name: 'Other', icon: '📦', color: '#9E9E9E' }
        ],
        locations: [],
        inventory_items: [],
        item_images: [],
        shopping_list: [],
        notification_log: [],
        wasted_items: [],
        barcode_mappings: [],
        usage_history: [],
        ai_usage_log: []
      };
      localStorage.setItem('inventory_db', JSON.stringify(initialDb));
    }
    console.log('LocalStorage fallback initialized');
  }

  private async createTables(): Promise<void> {
    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,

      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,

      // Categories table
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT,
        color TEXT
      );`,

      // Locations table
      `CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        sub_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,

      // Inventory items table
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        purchase_date DATE,
        expiration_date DATE NOT NULL,
        location_id INTEGER NOT NULL,
        price REAL,
        notes TEXT,
        notification_enabled INTEGER DEFAULT 1,
        notification_days_before INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (location_id) REFERENCES locations(id)
      );`,

      // Item images table
      `CREATE TABLE IF NOT EXISTS item_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );`,

      // Shopping list table (updated to reflect the UI model)
      `CREATE TABLE IF NOT EXISTS shopping_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        quantity TEXT,
        notes TEXT,
        category_id INTEGER,
        is_purchased INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`,

      // Notification log table
      `CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        notification_date DATETIME NOT NULL,
        sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );`,

      // Wasted items tracking table (for statistics)
      `CREATE TABLE IF NOT EXISTS wasted_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        price REAL,
        wasted_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`,

      // Barcode mappings table (learn-as-you-go barcode database)
      `CREATE TABLE IF NOT EXISTS barcode_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        item_name TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,

      // Usage history table (track consumption over time)
      `CREATE TABLE IF NOT EXISTS usage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        amount_used REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        notes TEXT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );`,

      // Recipes table (global recipe database)
      `CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ingredients TEXT NOT NULL,
        prep_time TEXT,
        servings INTEGER,
        instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,

      // Inventory batches table (track multiple batches per item)
      `CREATE TABLE IF NOT EXISTS inventory_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        expiration_date DATE,
        purchase_date DATE NOT NULL,
        price REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );`
    ];

    for (const query of queries) {
      await this.db.execute(query);
    }

    // Add new columns to existing inventory_items table (for upgrades)
    await this.upgradeInventoryItemsTable();
    
    // Pre-populate recipes table
    await this.populateRecipes();
  }

  private async migrateShoppingListSchema(): Promise<void> {
    try {
      // Only run on native platforms where SQLite is used
      if (Capacitor.getPlatform() === 'web') return;

      const info = await this.db.query(`PRAGMA table_info(shopping_list);`);
      const cols = (info.values || []).map((c: any) => c.name);

      // If 'is_purchased' doesn't exist but 'purchased' does, add column and migrate values
      if (cols.includes('purchased') && !cols.includes('is_purchased')) {
        await this.db.run(`ALTER TABLE shopping_list ADD COLUMN is_purchased INTEGER DEFAULT 0;`);
        await this.db.run(`UPDATE shopping_list SET is_purchased = purchased WHERE purchased IS NOT NULL;`);
      }

      // If 'notes' doesn't exist, add
      if (!cols.includes('notes')) {
        await this.db.run(`ALTER TABLE shopping_list ADD COLUMN notes TEXT;`);
      }

      // If 'unit' exists or 'purchased' exists, create a new table with the updated schema
      const hasUnit = cols.includes('unit');
      const hasPurchased = cols.includes('purchased');
      const hasIsPurchased = cols.includes('is_purchased');

      if (hasUnit || hasPurchased || !hasIsPurchased) {
        // Create a temporary table with the desired new schema
        await this.db.run(`
          CREATE TABLE IF NOT EXISTS shopping_list_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity TEXT,
            notes TEXT,
            category_id INTEGER,
            is_purchased INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (category_id) REFERENCES categories(id)
          );
        `);

        // Copy existing data and transform fields
        const purchasedExpr = hasIsPurchased ? 'COALESCE(is_purchased, purchased, 0)' : 'COALESCE(purchased, 0)';
        // Build quantity expression: if unit exists, combine quantity and unit into a string
        const quantityExpr = hasUnit
          ? "CASE WHEN unit IS NOT NULL AND unit != '' THEN (CAST(quantity AS TEXT) || ' ' || unit) ELSE CAST(quantity AS TEXT) END"
          : 'CAST(quantity AS TEXT)';

        await this.db.run(`
          INSERT INTO shopping_list_temp (id, user_id, name, quantity, notes, category_id, is_purchased, created_at)
          SELECT id, user_id, name, ${quantityExpr}, COALESCE(notes, ''), category_id, ${purchasedExpr}, created_at
          FROM shopping_list;
        `);

        // Drop old table and rename temp table
        await this.db.run(`DROP TABLE IF EXISTS shopping_list;`);
        await this.db.run(`ALTER TABLE shopping_list_temp RENAME TO shopping_list;`);
      }

      // If 'quantity' is REAL and needs to be TEXT, ensure compatibility (SQLite is dynamic typed so we skip altering types)
    } catch (error) {
      console.warn('Shopping list schema migration skipped or failed:', error);
    }
  }

  private async migrateAIFeaturesSchema(): Promise<void> {
    try {
      // Only run on native platforms where SQLite is used
      if (Capacitor.getPlatform() === 'web') {
        // For web, add to localStorage structure
        const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
        if (!db.ai_usage_log) {
          db.ai_usage_log = [];
          localStorage.setItem('inventory_db', JSON.stringify(db));
        }
        return;
      }

      // Create ai_usage_log table if it doesn't exist
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS ai_usage_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          request_type TEXT NOT NULL,
          item_name TEXT,
          response_days INTEGER,
          response_note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      // Create indexes for better query performance
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_items(user_id);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory_items(expiration_date);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_batches_item ON inventory_batches(item_id);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(expiration_date);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_wasted_user ON wasted_items(user_id);`);

      // Add new columns to barcode_mappings if they don't exist
      const barcodeInfo = await this.db.query(`PRAGMA table_info(barcode_mappings);`);
      const barcodeCols = (barcodeInfo.values || []).map((c: any) => c.name);

      if (!barcodeCols.includes('suggested_shelf_life_days')) {
        await this.db.run(`ALTER TABLE barcode_mappings ADD COLUMN suggested_shelf_life_days INTEGER;`);
      }

      if (!barcodeCols.includes('ai_note')) {
        await this.db.run(`ALTER TABLE barcode_mappings ADD COLUMN ai_note TEXT;`);
      }

      if (!barcodeCols.includes('price')) {
        await this.db.run(`ALTER TABLE barcode_mappings ADD COLUMN price REAL;`);
      }

      if (!barcodeCols.includes('image_path')) {
        await this.db.run(`ALTER TABLE barcode_mappings ADD COLUMN image_path TEXT;`);
      }

      if (!barcodeCols.includes('location_id')) {
        await this.db.run(`ALTER TABLE barcode_mappings ADD COLUMN location_id INTEGER;`);
      }

      console.log('AI features schema migration completed');
    } catch (error) {
      console.warn('AI features schema migration skipped or failed:', error);
    }
  }

  private async migrateToBatchTracking(): Promise<void> {
    try {
      console.log('Starting batch tracking migration...');
      
      // For native platforms, convert existing items to batches
      const result = await this.db.query(`
        SELECT id, quantity, current_quantity, expiration_date, purchase_date, price 
        FROM inventory_items 
        WHERE id NOT IN (SELECT DISTINCT item_id FROM inventory_batches)
          AND (quantity > 0 OR current_quantity > 0)
      `);

      console.log(`Found ${result.values?.length || 0} items to migrate`);

      if (result.values && result.values.length > 0) {
        for (const item of result.values) {
          const qty = item.quantity || item.current_quantity || 0;
          if (qty > 0) {
            console.log(`Migrating item ${item.id} with quantity ${qty}`);
            await this.db.run(`
              INSERT INTO inventory_batches (item_id, quantity, expiration_date, purchase_date, price, notes)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              item.id,
              qty,
              item.expiration_date || null,
              item.purchase_date || toLocalDateString(new Date()),
              item.price || null,
              'Initial batch (migrated)'
            ]);
          }
        }
        console.log(`✓ Successfully migrated ${result.values.length} items to batch tracking`);
      } else {
        console.log('No items need migration (already have batches or quantity is 0)');
      }
    } catch (error) {
      console.error('Batch tracking migration failed with error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  }

  private async populateRecipes(): Promise<void> {
    try {
      // Only run on native platforms where SQLite is used
      if (Capacitor.getPlatform() === 'web') {
        // For web, add to localStorage structure
        const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
        if (!db.recipes || db.recipes.length === 0) {
          db.recipes = [
            { id: 1, name: 'Vegetable Stir Fry', ingredients: 'produce,vegetables,broccoli,carrots,peppers', prep_time: '15 min', servings: 4, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 2, name: 'Chicken Salad', ingredients: 'chicken,meat,lettuce,produce,tomatoes', prep_time: '20 min', servings: 2, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 3, name: 'Pasta with Cream Sauce', ingredients: 'pasta,pantry,cream,dairy,cheese', prep_time: '25 min', servings: 4, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 4, name: 'Fish Tacos', ingredients: 'fish,seafood,tortillas,lettuce,produce', prep_time: '30 min', servings: 3, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 5, name: 'Smoothie Bowl', ingredients: 'fruit,produce,yogurt,dairy,berries,banana', prep_time: '10 min', servings: 1, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 6, name: 'Beef Stew', ingredients: 'beef,meat,potatoes,carrots,produce,onions', prep_time: '90 min', servings: 6, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 7, name: 'Greek Salad', ingredients: 'tomatoes,cucumber,produce,cheese,dairy,olives', prep_time: '15 min', servings: 4, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 8, name: 'Grilled Cheese Sandwich', ingredients: 'bread,bakery,cheese,dairy,butter', prep_time: '10 min', servings: 1, instructions: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ];
          localStorage.setItem('inventory_db', JSON.stringify(db));
        }
        return;
      }

      // Check if recipes already exist
      const result = await this.db.query(`SELECT COUNT(*) as count FROM recipes;`);
      const count = result.values?.[0]?.count || 0;

      if (count === 0) {
        // Pre-populate with 8 default recipes
        const defaultRecipes = [
          { name: 'Vegetable Stir Fry', ingredients: 'produce,vegetables,broccoli,carrots,peppers', prep_time: '15 min', servings: 4, instructions: '' },
          { name: 'Chicken Salad', ingredients: 'chicken,meat,lettuce,produce,tomatoes', prep_time: '20 min', servings: 2, instructions: '' },
          { name: 'Pasta with Cream Sauce', ingredients: 'pasta,pantry,cream,dairy,cheese', prep_time: '25 min', servings: 4, instructions: '' },
          { name: 'Fish Tacos', ingredients: 'fish,seafood,tortillas,lettuce,produce', prep_time: '30 min', servings: 3, instructions: '' },
          { name: 'Smoothie Bowl', ingredients: 'fruit,produce,yogurt,dairy,berries,banana', prep_time: '10 min', servings: 1, instructions: '' },
          { name: 'Beef Stew', ingredients: 'beef,meat,potatoes,carrots,produce,onions', prep_time: '90 min', servings: 6, instructions: '' },
          { name: 'Greek Salad', ingredients: 'tomatoes,cucumber,produce,cheese,dairy,olives', prep_time: '15 min', servings: 4, instructions: '' },
          { name: 'Grilled Cheese Sandwich', ingredients: 'bread,bakery,cheese,dairy,butter', prep_time: '10 min', servings: 1, instructions: '' }
        ];

        for (const recipe of defaultRecipes) {
          await this.db.run(
            `INSERT INTO recipes (name, ingredients, prep_time, servings, instructions) VALUES (?, ?, ?, ?, ?)`,
            [recipe.name, recipe.ingredients, recipe.prep_time, recipe.servings, recipe.instructions]
          );
        }

        console.log('Pre-populated 8 default recipes');
      }
    } catch (error) {
      console.warn('Recipe population skipped or failed:', error);
    }
  }

  private async upgradeInventoryItemsTable(): Promise<void> {
    try {
      // Check if new columns exist, add them if not
      const columnsToAdd = [
        'barcode TEXT',
        'initial_quantity REAL',
        'current_quantity REAL',
        'usage_notes TEXT',
        'low_stock_threshold REAL DEFAULT 20'
      ];

      for (const column of columnsToAdd) {
        const columnName = column.split(' ')[0];
        try {
          // Try to add the column (will fail silently if it already exists)
          await this.db.execute(`ALTER TABLE inventory_items ADD COLUMN ${column}`);
          console.log(`Added column ${columnName} to inventory_items`);
        } catch (error) {
          // Column already exists, ignore error
        }
      }
    } catch (error) {
      console.error('Error upgrading inventory_items table:', error);
    }
  }

  private async insertDefaultCategories(): Promise<void> {
    const categories = [
      { name: 'Dairy', icon: '🥛', color: '#FFEB3B' },
      { name: 'Produce', icon: '🥬', color: '#4CAF50' },
      { name: 'Meat', icon: '🥩', color: '#F44336' },
      { name: 'Seafood', icon: '🐟', color: '#03A9F4' },
      { name: 'Frozen', icon: '❄️', color: '#00BCD4' },
      { name: 'Pantry', icon: '🥫', color: '#FF9800' },
      { name: 'Beverages', icon: '🥤', color: '#9C27B0' },
      { name: 'Snacks', icon: '🍿', color: '#E91E63' },
      { name: 'Condiments', icon: '🧂', color: '#795548' },
      { name: 'Bakery', icon: '🍞', color: '#FFC107' },
      { name: 'Fruit', icon: '🍎', color: '#F2B2B2' },
      { name: 'Other', icon: '📦', color: '#9E9E9E' }
    ];

    for (const category of categories) {
      const checkQuery = `SELECT COUNT(*) as count FROM categories WHERE name = ?`;
      const result = await this.db.query(checkQuery, [category.name]);

      if (result.values && result.values[0].count === 0) {
        const insertQuery = `INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)`;
        await this.db.run(insertQuery, [category.name, category.icon, category.color]);
      }
    }
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }

    // Use localStorage fallback for web
    if (Capacitor.getPlatform() === 'web') {
      return this.executeLocalStorageQuery(sql, params);
    }

    return await this.db.query(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }

    // Use localStorage fallback for web
    if (Capacitor.getPlatform() === 'web') {
      return this.executeLocalStorageQuery(sql, params);
    }

    return await this.db.run(sql, params);
  }

  async execute(sql: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }

    // Use localStorage fallback for web
    if (Capacitor.getPlatform() === 'web') {
      return this.executeLocalStorageQuery(sql, []);
    }

    return await this.db.execute(sql);
  }

  async beginTransaction(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }

    // For web, transactions are implicit (in-memory operations are atomic)
    if (Capacitor.getPlatform() === 'web') {
      // No-op for web
      return;
    }

    await this.db.execute('BEGIN TRANSACTION');
  }

  async commit(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }

    // For web, transactions are implicit
    if (Capacitor.getPlatform() === 'web') {
      // No-op for web
      return;
    }

    await this.db.execute('COMMIT');
  }

  async rollback(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }

    // For web, transactions are implicit
    if (Capacitor.getPlatform() === 'web') {
      // No-op for web
      return;
    }

    await this.db.execute('ROLLBACK');
  }

  getDatabase(): SQLiteDBConnection {
    return this.db;
  }

  private executeLocalStorageQuery(sql: string, params: any[]): any {
    const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');

    // Simple SQL parser for basic operations
    const sqlLower = sql.toLowerCase().trim();

    // SELECT queries
    if (sqlLower.startsWith('select')) {
      return this.handleSelect(db, sql, params);
    }

    // INSERT queries
    if (sqlLower.startsWith('insert')) {
      return this.handleInsert(db, sql, params);
    }

    // UPDATE queries
    if (sqlLower.startsWith('update')) {
      return this.handleUpdate(db, sql, params);
    }

    // DELETE queries
    if (sqlLower.startsWith('delete')) {
      return this.handleDelete(db, sql, params);
    }

    return { values: [] };
  }

  private handleSelect(db: any, sql: string, params: any[]): any {
    // Extract table name
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) return { values: [] };

    const tableName = fromMatch[1];
    let results = db[tableName] || [];

    // Handle WHERE clause with multiple conditions
    if (params.length > 0 && sql.toLowerCase().includes('where')) {
      const whereStart = sql.toLowerCase().indexOf('where') + 5;
      const whereEnd = sql.toLowerCase().search(/\s+(order by|limit|offset|group by)/) > whereStart
        ? sql.toLowerCase().search(/\s+(order by|limit|offset|group by)/)
        : sql.length;
      const whereClause = sql.substring(whereStart, whereEnd).trim();

      // Handle IN clause: WHERE field IN (?, ?, ?)
      const inMatch = whereClause.match(/(\w+)\s+IN\s*\(\s*\?\s*(,\s*\?\s*)*\)/i);
      if (inMatch) {
        const field = inMatch[1];
        results = results.filter((row: any) => params.includes(row[field]));
      } else {
        // Handle multiple conditions with AND: WHERE field1 = ? AND field2 = ?
        const conditions = whereClause.split(/\s+AND\s+/i);

        results = results.filter((row: any) => {
          let paramIndex = 0;
          return conditions.every((condition) => {
            const match = condition.match(/(\w+)\s*=\s*\?/i);
            if (match) {
              const field = match[1];
              const matches = row[field] === params[paramIndex];
              paramIndex++;
              return matches;
            }
            return true;
          });
        });
      }
    }

    // Handle ORDER BY clause
    const orderByMatch = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s+$)/i);
    if (orderByMatch) {
      const orderByClause = orderByMatch[1];
      const orderPairs = orderByClause.split(',').map((pair) => {
        const match = pair.trim().match(/(\w+)\s+(ASC|DESC)?/i);
        if (match) {
          return { field: match[1], direction: (match[2] || 'ASC').toUpperCase() };
        }
        return null;
      }).filter((pair) => pair !== null);

      results.sort((a: any, b: any) => {
        for (const order of orderPairs) {
          if (!order) continue;
          const aVal = a[order.field];
          const bVal = b[order.field];

          if (aVal < bVal) return order.direction === 'ASC' ? -1 : 1;
          if (aVal > bVal) return order.direction === 'ASC' ? 1 : -1;
        }
        return 0;
      });
    }

    // Handle LIMIT clause
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      results = results.slice(0, limit);
    }

    // Handle OFFSET clause
    const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
    if (offsetMatch) {
      const offset = parseInt(offsetMatch[1]);
      results = results.slice(offset);
    }

    // Handle COUNT queries
    if (sql.toLowerCase().includes('count(*)')) {
      return { values: [{ count: results.length }] };
    }

    // Handle SUM queries
    const sumMatch = sql.match(/SELECT\s+(?:COALESCE\()?SUM\((\w+)\)(?:,\s*0\))?\s+(?:as\s+(\w+)\s+)?FROM/i);
    if (sumMatch) {
      const col = sumMatch[1];
      const alias = sumMatch[2] || 'total';
      const total = results.reduce((acc: number, r: any) => acc + (Number(r[col]) || 0), 0);
      return { values: [{ [alias]: total }] };
    }

    return { values: results };
  }

  private handleInsert(db: any, sql: string, params: any[]): any {
    const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
    if (!tableMatch) return { changes: { lastId: 0 } };

    const tableName = tableMatch[1];
    const columnsMatch = sql.match(/\(([^)]+)\)/);

    if (!columnsMatch) return { changes: { lastId: 0 } };

    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const newRow: any = {};

    // Generate ID (use reduce instead of spread to avoid call stack issues)
    const maxId = db[tableName]?.length > 0
      ? db[tableName].reduce((max: number, r: any) => Math.max(max, r.id || 0), 0)
      : 0;
    newRow.id = maxId + 1;

    // Map params to columns
    columns.forEach((col, index) => {
      newRow[col] = params[index];
    });

    // Add timestamp if needed
    if (!newRow.created_at) {
      newRow.created_at = new Date().toISOString();
    }

    db[tableName] = db[tableName] || [];
    db[tableName].push(newRow);

    localStorage.setItem('inventory_db', JSON.stringify(db));

    return { changes: { lastId: newRow.id } };
  }

  private handleUpdate(db: any, sql: string, params: any[]): any {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) return { changes: {} };

    const tableName = tableMatch[1];
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);

    if (!whereMatch || !db[tableName]) return { changes: {} };

    const whereField = whereMatch[1];
    const whereValue = params[params.length - 1];
    db[tableName] = db[tableName].map((row: any) => {
      if (row[whereField] === whereValue) {
        // Update fields
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
        if (setMatch) {
          const setPart = setMatch[1].replace(/\s+/g, ' ').trim(); // Normalize whitespace

          // Handle CASE WHEN expressions (no parameter binding)
          if (setPart.toLowerCase().includes('case')) {
            const caseMatch = setPart.match(/(\w+)\s*=\s*(CASE\s+.+?END)/i);
            if (caseMatch) {
              const field = caseMatch[1].trim();
              const caseExpr = caseMatch[2].trim();

              // Simple CASE WHEN evaluation
              if (caseExpr.toLowerCase().includes('when') && caseExpr.toLowerCase().includes('then')) {
                // Parse: CASE WHEN condition THEN value ELSE value END
                const whenMatch = caseExpr.match(/WHEN\s+(\w+)\s*=\s*(\d+)\s+THEN\s+(\d+)\s+ELSE\s+(\d+)/i);
                if (whenMatch) {
                  const [, checkField, checkVal, thenVal, elseVal] = whenMatch;
                  row[field] = row[checkField.toLowerCase()] === parseInt(checkVal) ? parseInt(thenVal) : parseInt(elseVal);
                }
              }
            }
          } else {
            // Handle regular SET assignments with parameters
            const setPairs = setPart.split(',');
            let paramIndex = 0;
            
            setPairs.forEach((pair) => {
              const trimmedPair = pair.trim();
              // Skip non-parameter assignments like "updated_at = CURRENT_TIMESTAMP"
              if (!trimmedPair.includes('=')) return;
              
              const [field, expr] = trimmedPair.split('=').map(s => s.trim());
              
              // Only assign if expression is a parameter placeholder
              if (expr === '?') {
                row[field] = params[paramIndex];
                paramIndex++;
              }
            });
          }
        }
        row.updated_at = new Date().toISOString();
      }
      return row;
    });

    localStorage.setItem('inventory_db', JSON.stringify(db));
    return { changes: {} };
  }

  private handleDelete(db: any, sql: string, params: any[]): any {
    const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
    if (!tableMatch) return { changes: {} };

    const tableName = tableMatch[1];

    if (sql.toLowerCase().includes('where')) {
      const whereStart = sql.toLowerCase().indexOf('where') + 5;
      const whereClause = sql.substring(whereStart).trim();

      // Handle IN clause: WHERE field IN (?, ?, ?)
      const inMatch = whereClause.match(/(\w+)\s+IN\s*\(\s*\?\s*(,\s*\?\s*)*\)/i);
      if (inMatch && db[tableName]) {
        const field = inMatch[1];
        db[tableName] = db[tableName].filter((row: any) => !params.includes(row[field]));
      } else {
        // Handle single condition: WHERE field = ?
        const whereMatch = whereClause.match(/(\w+)\s*=\s*\?/i);
        if (whereMatch && db[tableName]) {
          const field = whereMatch[1];
          db[tableName] = db[tableName].filter((row: any) => row[field] !== params[0]);
        }
      }
    } else {
      // Delete all
      db[tableName] = [];
    }

    localStorage.setItem('inventory_db', JSON.stringify(db));
    return { changes: {} };
  }

  // ===== Data Browser Methods =====

  /** Tables to hide from the data browser */
  private readonly HIDDEN_TABLES = ['sessions'];

  /** Allowed tables for data browser operations (whitelist for SQL injection prevention) */
  private readonly ALLOWED_TABLES = new Set([
    'users',
    'inventory_items', 'inventory_batches', 'categories', 'locations',
    'shopping_list', 'wasted_items', 'recipes', 'barcode_mappings',
    'notification_log', 'ai_usage_log', 'usage_history', 'item_images'
  ]);

  /** Validate table name against allowlist */
  private validateTableName(tableName: string): void {
    if (!this.ALLOWED_TABLES.has(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
  }

  /** Get list of all table names (excluding hidden ones) */
  async getTableNames(): Promise<string[]> {
    if (Capacitor.getPlatform() === 'web') {
      const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
      return Object.keys(db).filter(t => !this.HIDDEN_TABLES.includes(t));
    }

    const result = await this.db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`);
    const tables = (result.values || []).map((r: any) => r.name);
    return tables.filter((t: string) => !this.HIDDEN_TABLES.includes(t));
  }

  /** Get column info for a table */
  async getTableSchema(tableName: string): Promise<{ name: string; type: string; notnull: boolean; pk: boolean }[]> {
    this.validateTableName(tableName);
    if (Capacitor.getPlatform() === 'web') {
      const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
      const rows = db[tableName] || [];
      if (rows.length === 0) {
        // Infer from known schema
        const defaultColumns: Record<string, string[]> = {
          users: ['id', 'username', 'password', 'email', 'created_at'],
          categories: ['id', 'name', 'icon', 'color'],
          locations: ['id', 'user_id', 'name', 'sub_location', 'created_at'],
          inventory_items: ['id', 'user_id', 'name', 'category_id', 'quantity', 'unit', 'purchase_date', 'expiration_date', 'location_id', 'price', 'notes', 'notification_enabled', 'notification_days_before', 'created_at', 'updated_at', 'barcode', 'initial_quantity', 'current_quantity'],
          item_images: ['id', 'item_id', 'image_path', 'is_primary', 'created_at'],
          shopping_list: ['id', 'user_id', 'name', 'quantity', 'notes', 'category_id', 'is_purchased', 'created_at'],
          notification_log: ['id', 'item_id', 'notification_date', 'sent', 'created_at'],
          wasted_items: ['id', 'user_id', 'item_name', 'category_id', 'quantity', 'unit', 'price', 'wasted_date'],
          barcode_mappings: ['id', 'barcode', 'item_name', 'category_id', 'user_id', 'created_at', 'suggested_shelf_life_days', 'ai_note'],
          usage_history: ['id', 'item_id', 'amount_used', 'remaining_amount', 'notes', 'recorded_at'],
          ai_usage_log: ['id', 'user_id', 'request_type', 'item_name', 'response_days', 'response_note', 'created_at']
        };
        const cols = defaultColumns[tableName] || ['id'];
        return cols.map(name => ({ name, type: 'TEXT', notnull: false, pk: name === 'id' }));
      }
      // Infer from first row
      const firstRow = rows[0];
      return Object.keys(firstRow).map(name => ({
        name,
        type: typeof firstRow[name] === 'number' ? 'INTEGER' : 'TEXT',
        notnull: false,
        pk: name === 'id'
      }));
    }

    const result = await this.db.query(`PRAGMA table_info(${tableName});`);
    return (result.values || []).map((r: any) => ({
      name: r.name,
      type: r.type || 'TEXT',
      notnull: r.notnull === 1,
      pk: r.pk === 1
    }));
  }

  /** Get paginated table data with optional search */
  async getTableData(tableName: string, page: number = 1, pageSize: number = 20, search: string = ''): Promise<{ rows: any[]; total: number }> {
    this.validateTableName(tableName);
    const offset = (page - 1) * pageSize;

    if (Capacitor.getPlatform() === 'web') {
      const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
      let rows = db[tableName] || [];

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        rows = rows.filter((row: any) =>
          Object.values(row).some(val =>
            val !== null && val !== undefined && String(val).toLowerCase().includes(searchLower)
          )
        );
      }

      const total = rows.length;
      const paginatedRows = rows.slice(offset, offset + pageSize);
      return { rows: paginatedRows, total };
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
    if (search) {
      const schema = await this.getTableSchema(tableName);
      const searchConditions = schema.map(col => `CAST(${col.name} AS TEXT) LIKE ?`).join(' OR ');
      countSql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${searchConditions}`;
    }
    const searchParams = search ? Array(await this.getTableSchema(tableName).then(s => s.length)).fill(`%${search}%`) : [];
    const countResult = await this.db.query(countSql, searchParams);
    const total = countResult.values?.[0]?.count || 0;

    // Get paginated data
    let dataSql = `SELECT * FROM ${tableName}`;
    if (search) {
      const schema = await this.getTableSchema(tableName);
      const searchConditions = schema.map(col => `CAST(${col.name} AS TEXT) LIKE ?`).join(' OR ');
      dataSql = `SELECT * FROM ${tableName} WHERE ${searchConditions}`;
    }
    dataSql += ` LIMIT ? OFFSET ?`;
    const dataParams = search ? [...searchParams, pageSize, offset] : [pageSize, offset];
    const dataResult = await this.db.query(dataSql, dataParams);

    return { rows: dataResult.values || [], total };
  }

  /** Update a row in a table */
  async updateTableRow(tableName: string, id: number, data: Record<string, any>): Promise<boolean> {
    this.validateTableName(tableName);
    try {
      // Remove id from data to prevent updating primary key
      const updateData = { ...data };
      delete (updateData as any).id;

      if (Capacitor.getPlatform() === 'web') {
        const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
        const rows = db[tableName] || [];
        const index = rows.findIndex((r: any) => r.id === id);
        if (index !== -1) {
          rows[index] = { ...rows[index], ...updateData, updated_at: new Date().toISOString() };
          db[tableName] = rows;
          localStorage.setItem('inventory_db', JSON.stringify(db));
          return true;
        }
        return false;
      }

      const columns = Object.keys(updateData);
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = columns.map(col => updateData[col]);
      values.push(id);

      await this.db.run(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, values);
      return true;
    } catch (error) {
      console.error('Error updating row:', error);
      return false;
    }
  }

  /** Delete a row from a table */
  async deleteTableRow(tableName: string, id: number): Promise<boolean> {
    this.validateTableName(tableName);
    try {
      if (Capacitor.getPlatform() === 'web') {
        const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
        const rows = db[tableName] || [];
        db[tableName] = rows.filter((r: any) => r.id !== id);
        localStorage.setItem('inventory_db', JSON.stringify(db));
        return true;
      }

      await this.db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error('Error deleting row:', error);
      return false;
    }
  }

  /** Insert a row with specific values (including ID) - for database restore */
  async insertTableRow(tableName: string, data: Record<string, any>): Promise<boolean> {
    this.validateTableName(tableName);
    try {
      if (Capacitor.getPlatform() === 'web') {
        const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
        const rows = db[tableName] || [];
        rows.push(data);
        db[tableName] = rows;
        localStorage.setItem('inventory_db', JSON.stringify(db));
        return true;
      }

      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.join(', ');
      const values = columns.map(col => data[col]);

      await this.run(
        `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
        values
      );
      return true;
    } catch (error) {
      console.error(`Error inserting row into ${tableName}:`, error);
      return false;
    }
  }

  /** Clear all data from a table */
  async clearTable(tableName: string): Promise<boolean> {
    this.validateTableName(tableName);
    try {
      if (Capacitor.getPlatform() === 'web') {
        const db = JSON.parse(localStorage.getItem('inventory_db') || '{}');
        db[tableName] = [];
        localStorage.setItem('inventory_db', JSON.stringify(db));
        return true;
      }

      await this.run(`DELETE FROM ${tableName}`);
      return true;
    } catch (error) {
      console.error(`Error clearing table ${tableName}:`, error);
      return false;
    }
  }

  // ==================== Inventory Batches Methods ====================

  private mapBatchRow(row: any): any {
    if (!row) return row;
    return {
      id: row.id,
      itemId: row.item_id ?? row.itemId,
      quantity: row.quantity,
      expirationDate: row.expiration_date ?? row.expirationDate,
      purchaseDate: row.purchase_date ?? row.purchaseDate,
      notes: row.notes,
      createdAt: row.created_at ?? row.createdAt
    };
  }

  /** Get all batches for a specific item */
  async getBatchesByItem(itemId: number): Promise<any[]> {
    const result = await this.query(
      `SELECT * FROM inventory_batches WHERE item_id = ? ORDER BY expiration_date ASC, created_at ASC`,
      [itemId]
    );
    return (result.values || []).map((row: any) => this.mapBatchRow(row));
  }

  /** Add a new batch */
  async addBatch(batch: any): Promise<number> {
    const result = await this.run(
      `INSERT INTO inventory_batches (item_id, quantity, expiration_date, purchase_date, price, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [batch.itemId, batch.quantity, batch.expirationDate, batch.purchaseDate, batch.price, batch.notes]
    );
    return result.changes?.lastId || 0;
  }

  /** Update a batch */
  async updateBatch(batch: any): Promise<boolean> {
    const result = await this.run(
      `UPDATE inventory_batches
       SET quantity = ?, expiration_date = ?, purchase_date = ?, price = ?, notes = ?
       WHERE id = ?`,
      [batch.quantity, batch.expirationDate, batch.purchaseDate, batch.price, batch.notes, batch.id]
    );
    return (result.changes?.changes || 0) > 0;
  }

  /** Delete a batch */
  async deleteBatch(batchId: number): Promise<boolean> {
    const result = await this.run(
      `DELETE FROM inventory_batches WHERE id = ?`,
      [batchId]
    );
    return (result.changes?.changes || 0) > 0;
  }

  /** Delete all batches for an item */
  async deleteBatchesByItem(itemId: number): Promise<boolean> {
    const result = await this.run(
      `DELETE FROM inventory_batches WHERE item_id = ?`,
      [itemId]
    );
    return (result.changes?.changes || 0) > 0;
  }

  /** Get total quantity across all batches for an item */
  async getTotalBatchQuantity(itemId: number): Promise<number> {
    const result = await this.query(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_batches WHERE item_id = ?`,
      [itemId]
    );
    return result.values?.[0]?.total || 0;
  }

  /** Get earliest expiration date across all batches for an item */
  async getEarliestBatchExpiration(itemId: number): Promise<string | null> {
    const result = await this.query(
      `SELECT expiration_date FROM inventory_batches 
       WHERE item_id = ? AND expiration_date IS NOT NULL 
       ORDER BY expiration_date ASC LIMIT 1`,
      [itemId]
    );
    return result.values?.[0]?.expiration_date || null;
  }
}

