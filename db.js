const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'coffee_shop.db');
const db = new sqlite3.Database(dbPath);

// Helper to run query with Promise
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Helper to get single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper to get all rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize tables and seed data
async function initDB() {
  // Create tables
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // Seed default admin
  const adminUsername = 'admin';
  const existingAdmin = await get('SELECT * FROM users WHERE username = ?', [adminUsername]);
  if (!existingAdmin) {
    const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
    await run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [adminUsername, adminPasswordHash, 'admin']
    );
    console.log('Seeded default admin account (username: admin, password: adminpassword)');
  }

  // Seed default products if empty
  const count = await get('SELECT COUNT(*) as count FROM products');
  if (count.count === 0) {
    const products = [
      {
        name: 'Mocha Gold',
        description: 'Rich espresso with dark chocolate syrup and velvety steamed milk.',
        price: 4.99,
        category: 'Hot Drinks',
        image_url: '/images/mocha_gold.png',
        available: 1
      },
      {
        name: 'Cold Brew Tonic',
        description: 'Slow-steeped cold brew over ice, paired with premium tonic water and citrus.',
        price: 5.49,
        category: 'Cold Drinks',
        image_url: '/images/cold_brew_tonic.png',
        available: 1
      },
      {
        name: 'Caramel Macchiato',
        description: 'Freshly pulled espresso layered over milk, sweet vanilla, and buttery caramel drizzle.',
        price: 5.25,
        category: 'Hot Drinks',
        image_url: '/images/caramel_macchiato.png',
        available: 1
      },
      {
        name: 'Pecan Croissant',
        description: 'Golden, flaky butter croissant baked with toasted pecans and caramel filling.',
        price: 3.99,
        category: 'Bakery',
        image_url: '/images/pecan_croissant.png',
        available: 1
      },
      {
        name: 'AeroPress Espresso',
        description: 'Intense and full-bodied single-origin espresso extracted under optimal AeroPress pressure.',
        price: 3.50,
        category: 'Hot Drinks',
        image_url: '/images/aeropress_espresso.png',
        available: 1
      }
    ];

    for (const p of products) {
      await run(
        'INSERT INTO products (name, description, price, category, image_url, available) VALUES (?, ?, ?, ?, ?, ?)',
        [p.name, p.description, p.price, p.category, p.image_url, p.available]
      );
    }
    console.log('Seeded default products');
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDB
};
