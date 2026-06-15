/**
 * Integration Test Suite for Coffee Shop Web Application
 * Verifies Auth, Role Guards, CRUD operations for Products & Orders.
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4000; // Use a distinct port for testing
process.env.PORT = PORT;

let serverProcess = null;
const baseUrl = `http://localhost:${PORT}`;

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for fetch requests that preserves session cookie
async function apiRequest(endpoint, options = {}, cookie = '') {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(cookie ? { 'Cookie': cookie } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const setCookie = response.headers.get('set-cookie');
  let body = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return {
    status: response.status,
    body,
    cookie: setCookie ? setCookie.split(';')[0] : cookie
  };
}

async function runTests() {
  console.log('\n==================================================');
  console.log('STARTING INTEGRATION TESTS...');
  console.log('==================================================\n');

  let testUserCookie = '';
  let adminCookie = '';
  let testProductId = null;
  let testOrderId = null;
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Guest Access and Endpoint Guards
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Guest Access & API Security Guards ---');
    
    // Get products as guest (allowed)
    const guestProducts = await apiRequest('/api/products');
    assert(guestProducts.status === 200, 'Guest can read products list');
    assert(Array.isArray(guestProducts.body), 'Products list is an array');

    // Try to view my orders as guest (denied)
    const guestOrders = await apiRequest('/api/orders/my');
    assert(guestOrders.status === 401, 'Guest cannot view order history (401 Unauthorized)');

    // Try to read admin orders queue as guest (denied)
    const guestAdminOrders = await apiRequest('/api/orders');
    assert(guestAdminOrders.status === 403, 'Guest cannot read admin orders queue (403 Forbidden)');

    // Try to create product as guest (denied)
    const guestAddProduct = await apiRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fail Coffee', price: 9.99, description: '...', category: 'Hot Drinks', image_url: '...' })
    });
    assert(guestAddProduct.status === 403, 'Guest cannot create new products (403 Forbidden)');

    // ----------------------------------------------------
    // TEST 2: Registration Validation & Execution
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Registration & Validation ---');
    
    // Register with short password (denied)
    const regShortPass = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'valid_user', password: '123' })
    });
    assert(regShortPass.status === 400, 'Registration rejects password < 6 chars');

    // Register with short username (denied)
    const regShortUser = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'us', password: 'validpassword123' })
    });
    assert(regShortUser.status === 400, 'Registration rejects username < 3 chars');

    // Register valid user
    const testUsername = `test_user_${Date.now()}`;
    const regSuccess = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: testUsername, password: 'testpassword' })
    });
    assert(regSuccess.status === 201, `Successful registration of user "${testUsername}"`);

    // Register duplicate user (denied)
    const regDuplicate = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: testUsername, password: 'testpassword' })
    });
    assert(regDuplicate.status === 400, 'Registration rejects duplicate username');

    // ----------------------------------------------------
    // TEST 3: User Authentication & Logged In User Capabilities
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Login and User Sessions ---');

    // Login with wrong password
    const loginWrongPass = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: testUsername, password: 'wrongpassword' })
    });
    assert(loginWrongPass.status === 400, 'Login fails with incorrect credentials');

    // Login successfully
    const loginSuccess = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: testUsername, password: 'testpassword' })
    });
    assert(loginSuccess.status === 200, 'Login succeeds with valid credentials');
    testUserCookie = loginSuccess.cookie;
    assert(!!testUserCookie, 'Session cookie received from server');

    // Check my identity
    const identity = await apiRequest('/api/auth/me', {}, testUserCookie);
    assert(identity.body.authenticated === true, 'Session is verified by /api/auth/me');
    assert(identity.body.user.username === testUsername, 'Authenticated username is correct');
    assert(identity.body.user.role === 'user', 'User role is default "user"');

    // View orders history (allowed, should be empty)
    const userOrders = await apiRequest('/api/orders/my', {}, testUserCookie);
    assert(userOrders.status === 200, 'Logged in user can read order history');
    assert(userOrders.body.length === 0, 'New user order history is empty');

    // Try to access admin area (denied)
    const userAdminOrders = await apiRequest('/api/orders', {}, testUserCookie);
    assert(userAdminOrders.status === 403, 'Normal user cannot access admin orders (403 Forbidden)');

    // ----------------------------------------------------
    // TEST 4: Administrator Operations (Products CRUD)
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Admin Auth & Products CRUD Operations ---');

    // Login as pre-seeded admin
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'adminpassword' })
    });
    assert(adminLogin.status === 200, 'Admin login successful');
    adminCookie = adminLogin.cookie;

    // Check admin identity
    const adminIdentity = await apiRequest('/api/auth/me', {}, adminCookie);
    assert(adminIdentity.body.user.role === 'admin', 'Admin role verified');

    // CRUD: Create Product
    const addProduct = await apiRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Pumpkin Latte',
        description: 'Warm espresso infused with sweet pumpkin spices and cream.',
        price: 5.95,
        category: 'Hot Drinks',
        image_url: '/images/pumpkin.png',
        available: true
      })
    }, adminCookie);
    assert(addProduct.status === 201, 'Admin can create new product');
    testProductId = addProduct.body.productId;
    assert(testProductId !== undefined, 'Created product ID returned in response');

    // CRUD: Read products list as guest, verify new product is visible
    const checkProductList = await apiRequest('/api/products');
    const pumpkin = checkProductList.body.find(p => p.id === testProductId);
    assert(!!pumpkin, 'New product is visible in the shop catalog');
    assert(pumpkin.price === 5.95, 'New product price matches input');

    // CRUD: Update Product details
    const updateProduct = await apiRequest(`/api/products/${testProductId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Glow Pumpkin Latte',
        description: 'Upgraded winter warm blend.',
        price: 6.25,
        category: 'Hot Drinks',
        image_url: '/images/pumpkin.png',
        available: true
      })
    }, adminCookie);
    assert(updateProduct.status === 200, 'Admin can update product details');

    // Verify update
    const checkProductListUpdated = await apiRequest('/api/products');
    const updatedPumpkin = checkProductListUpdated.body.find(p => p.id === testProductId);
    assert(updatedPumpkin.name === 'Glow Pumpkin Latte', 'Updated name is correct');
    assert(updatedPumpkin.price === 6.25, 'Updated price is correct');

    // ----------------------------------------------------
    // TEST 5: Order Checkout & Processing Workflow
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Checkout & Order Processing Queue ---');

    // User places order
    const checkoutResult = await apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          { productId: 1, quantity: 2 }, // 2x Mocha Gold
          { productId: testProductId, quantity: 1 } // 1x Glow Pumpkin Latte
        ]
      })
    }, testUserCookie);
    assert(checkoutResult.status === 201, 'User can place a checkout order');
    testOrderId = checkoutResult.body.orderId;
    assert(testOrderId !== undefined, 'Checkout returned order ID');

    // User reads order history
    const userOrdersAfterCheckout = await apiRequest('/api/orders/my', {}, testUserCookie);
    assert(userOrdersAfterCheckout.body.length === 1, 'Order is present in user order history');
    assert(userOrdersAfterCheckout.body[0].id === testOrderId, 'Order ID in history matches');
    assert(userOrdersAfterCheckout.body[0].status === 'pending', 'Initial order status is "pending"');

    // Admin views order queue
    const adminOrders = await apiRequest('/api/orders', {}, adminCookie);
    const orderInQueue = adminOrders.body.find(o => o.id === testOrderId);
    assert(!!orderInQueue, 'Order is present in admin queue');
    assert(orderInQueue.username === testUsername, 'Customer name is recorded correctly');

    // Admin updates order status (completed)
    const updateOrderStatus = await apiRequest(`/api/orders/${testOrderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' })
    }, adminCookie);
    assert(updateOrderStatus.status === 200, 'Admin can update order status to "completed"');

    // User verifies status update
    const userOrdersAfterUpdate = await apiRequest('/api/orders/my', {}, testUserCookie);
    assert(userOrdersAfterUpdate.body[0].status === 'completed', 'User sees status update in real-time');

    // ----------------------------------------------------
    // TEST 6: CRUD Delete
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Product Deletion ---');

    // CRUD: Delete product
    const deleteProductResult = await apiRequest(`/api/products/${testProductId}`, {
      method: 'DELETE'
    }, adminCookie);
    assert(deleteProductResult.status === 200, 'Admin can delete product');

    // Verify deletion
    const checkProductListDeleted = await apiRequest('/api/products');
    const deletedPumpkin = checkProductListDeleted.body.find(p => p.id === testProductId);
    assert(!deletedPumpkin, 'Deleted product is no longer present in shop catalog');

  } catch (error) {
    console.error('Fatal testing error:', error);
    failures++;
  }

  console.log('\n==================================================');
  if (failures === 0) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error(`🛑 TESTS FAILED WITH ${failures} ERRORS.`);
  }
  console.log('==================================================\n');

  // Terminate server and exit process
  serverProcess.kill();
  process.exit(failures > 0 ? 1 : 0);
}

// Start Server and trigger test runner
function startServer() {
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    stdio: 'inherit',
    env: { ...process.env, PORT: PORT }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start test server process:', err);
    process.exit(1);
  });

  // Give server 1.5 seconds to start up and initialize database tables
  setTimeout(runTests, 1500);
}

startServer();
