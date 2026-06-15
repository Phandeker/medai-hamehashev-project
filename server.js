const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
db.initDB()
  .then(() => console.log('Database initialized successfully.'))
  .catch(err => console.error('Database initialization failed:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'latte-art-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using https in production
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Route Guards Middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  next();
}

// Authentication API
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim().length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username must be >= 3 chars, password >= 6 chars.' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username.trim(), hashedPassword, 'user']
    );

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({
      message: 'Login successful.',
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login process failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful.' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        username: req.session.username,
        role: req.session.role
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Products Public API (Read all or active)
app.get('/api/products', async (req, res) => {
  try {
    // Admins see all products (including unavailable), regular guests see only available ones
    const isAdmin = req.session && req.session.role === 'admin';
    let products;
    if (isAdmin) {
      products = await db.all('SELECT * FROM products');
    } else {
      products = await db.all('SELECT * FROM products WHERE available = 1');
    }
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// Products Admin CRUD (Create, Update, Delete)
app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, description, price, category, image_url, available } = req.body;
  if (!name || !description || price === undefined || !category || !image_url) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number.' });
  }

  try {
    const isAvail = (available === undefined || available === true || available == 1) ? 1 : 0;
    const result = await db.run(
      'INSERT INTO products (name, description, price, category, image_url, available) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), description.trim(), parsedPrice, category.trim(), image_url.trim(), isAvail]
    );
    res.status(201).json({ message: 'Product created successfully.', productId: result.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, image_url, available } = req.body;
  if (!name || !description || price === undefined || !category || !image_url) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number.' });
  }

  try {
    const isAvail = (available === true || available == 1) ? 1 : 0;
    const result = await db.run(
      'UPDATE products SET name = ?, description = ?, price = ?, category = ?, image_url = ?, available = ? WHERE id = ?',
      [name.trim(), description.trim(), parsedPrice, category.trim(), image_url.trim(), isAvail, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ message: 'Product updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.run('DELETE FROM products WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// Orders APIs
// Place Order (User)
app.post('/api/orders', requireAuth, async (req, res) => {
  const { items } = req.body; // Array of { productId, quantity }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    // Verify items and calculate total price
    let totalPrice = 0;
    const itemsWithDetails = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || parseInt(item.quantity) <= 0) {
        return res.status(400).json({ error: 'Invalid item parameters.' });
      }

      const product = await db.get('SELECT * FROM products WHERE id = ?', [item.productId]);
      if (!product) {
        return res.status(400).json({ error: `Product with ID ${item.productId} not found.` });
      }
      if (!product.available) {
        return res.status(400).json({ error: `Product "${product.name}" is currently unavailable.` });
      }

      const qty = parseInt(item.quantity);
      totalPrice += product.price * qty;
      itemsWithDetails.push({
        product_id: product.id,
        quantity: qty,
        price: product.price
      });
    }

    // Insert order in database
    // 1. Create order
    const orderResult = await db.run(
      'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)',
      [req.session.userId, totalPrice, 'pending']
    );
    const orderId = orderResult.id;

    // 2. Insert items
    for (const item of itemsWithDetails) {
      await db.run(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    res.status(201).json({ message: 'Order placed successfully.', orderId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process order.' });
  }
});

// Get User's own orders
app.get('/api/orders/my', requireAuth, async (req, res) => {
  try {
    const orders = await db.all(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.userId]
    );

    // Fetch items for each order
    for (const order of orders) {
      order.items = await db.all(
        `SELECT oi.*, p.name as product_name, p.image_url 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
    }

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch your orders.' });
  }
});

// Get All Orders (Admin)
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await db.all(
      `SELECT o.*, u.username 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       ORDER BY o.created_at DESC`
    );

    for (const order of orders) {
      order.items = await db.all(
        `SELECT oi.*, p.name as product_name, p.image_url 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
    }

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch all orders.' });
  }
});

// Update Order Status (Admin)
app.patch('/api/orders/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'completed', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const result = await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ message: 'Order status updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// Wildcard fallback to serve index.html for SPA frontend routing support
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`Coffee shop server running on http://localhost:${PORT}`);
});
