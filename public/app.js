// ==========================================================================
// MCS | Moka coffee shop SPA Core Application Script
// ==========================================================================

// Application State
const state = {
  user: null, // { username, role }
  products: [], // Loaded from API
  cart: [], // [{ id, name, price, qty, image_url }]
  currentView: 'shop',
  activeAdminTab: 'products'
};

// 1. Toast Notification Manager
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  // Force a reflow to trigger transition
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// 2. Shopping Cart Operations
function loadCartFromStorage() {
  const stored = localStorage.getItem('mcs_cart');
  if (stored) {
    try {
      state.cart = JSON.parse(stored);
    } catch (e) {
      state.cart = [];
    }
  }
  updateCartBadge();
}

function saveCartToStorage() {
  localStorage.setItem('mcs_cart', JSON.stringify(state.cart));
  updateCartBadge();
  renderCartDrawer();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
  badge.textContent = totalQty;
  if (totalQty > 0) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      image_url: product.image_url
    });
  }

  saveCartToStorage();
  showToast('Added to bag', `${product.name} has been added to your shopping bag.`, 'success');
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter(i => i.id !== productId);
  }
  saveCartToStorage();
}

function removeFromCart(productId) {
  const item = state.cart.find(i => i.id === productId);
  state.cart = state.cart.filter(i => i.id !== productId);
  saveCartToStorage();
  if (item) {
    showToast('Removed from bag', `${item.name} has been removed.`, 'info');
  }
}

function clearCart() {
  state.cart = [];
  saveCartToStorage();
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items-container');
  const totalPriceEl = document.getElementById('cart-total-price');

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
          <i class="fa-solid fa-mug-saucer"></i>
          <p>Your bag is empty. Let's add some coffee!</p>
          <button class="btn btn-accent btn-sm" id="btn-back-to-shop">Browse Menu</button>
      </div>
    `;
    totalPriceEl.textContent = '₪0.00';

    document.getElementById('btn-back-to-shop')?.addEventListener('click', () => {
      toggleCartDrawer(false);
      window.location.hash = '#shop';
    });
    return;
  }

  let html = '';
  let total = 0;

  state.cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    html += `
      <div class="cart-item">
          <img src="${item.image_url}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=150'">
          <div class="cart-item-details">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-price">₪${item.price.toFixed(2)}</div>
              <div class="cart-item-qty">
                  <button class="qty-btn" onclick="updateCartQty(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                  <span class="qty-val">${item.qty}</span>
                  <button class="qty-btn" onclick="updateCartQty(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
              </div>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
              <i class="fa-solid fa-trash-can"></i>
          </button>
      </div>
    `;
  });

  container.innerHTML = html;
  totalPriceEl.textContent = `₪${total.toFixed(2)}`;
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (open) {
    renderCartDrawer();
    drawer.classList.add('active');
    overlay.classList.add('active');
  } else {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
  }
}

// 3. User Authentication State & Header UI Update
async function fetchUserSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      state.user = data.user;
    } else {
      state.user = null;
    }
    updateHeaderUI();
  } catch (error) {
    console.error('Failed to get user session', error);
    state.user = null;
    updateHeaderUI();
  }
}

function updateHeaderUI() {
  const linkOrders = document.getElementById('link-orders');
  const linkAdmin = document.getElementById('link-admin');
  const linkAuth = document.getElementById('link-auth');
  const linkLogout = document.getElementById('link-logout');
  const userGreeting = document.getElementById('user-greeting');

  if (state.user) {
    linkAuth.classList.add('hidden');
    linkLogout.classList.remove('hidden');
    linkOrders.classList.remove('hidden');

    userGreeting.textContent = `Hello, ${state.user.username}`;
    userGreeting.classList.remove('hidden');

    if (state.user.role === 'admin') {
      linkAdmin.classList.remove('hidden');
    } else {
      linkAdmin.classList.add('hidden');
    }
  } else {
    linkAuth.classList.remove('hidden');
    linkLogout.classList.add('hidden');
    linkOrders.classList.add('hidden');
    linkAdmin.classList.add('hidden');
    userGreeting.classList.add('hidden');
  }
}

// 4. View Rendering Controllers
async function handleNavigation() {
  const hash = window.location.hash || '#shop';
  const main = document.getElementById('main-content');

  // Close menus
  document.getElementById('nav-menu').classList.remove('active');

  // Update navigation link highlights
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Guarding Checks (Protected Pages)
  if (hash === '#orders' && !state.user) {
    showToast('Sign In Required', 'Please log in to view your orders.', 'error');
    window.location.hash = '#auth';
    return;
  }

  if (hash === '#admin' && (!state.user || state.user.role !== 'admin')) {
    showToast('Access Denied', 'Administrators only. Redirecting to Shop.', 'error');
    window.location.hash = '#shop';
    return;
  }

  // Handle Logout Trigger
  if (hash === '#logout') {
    await performLogout();
    return;
  }

  // Load views
  if (hash === '#shop') {
    state.currentView = 'shop';
    await renderShop();
  } else if (hash === '#auth') {
    state.currentView = 'auth';
    renderAuth();
  } else if (hash === '#orders') {
    state.currentView = 'orders';
    await renderOrders();
  } else if (hash === '#admin') {
    state.currentView = 'admin';
    await renderAdmin();
  }
}

// A. RENDER SHOP VIEW
async function renderShop() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <section class="hero-section" style="background-image: linear-gradient(180deg, rgba(10, 8, 7, 0.4) 0%, var(--bg-main) 100%), url('https://images.unsplash.com/photo-1498804103079-a6351b050096?q=80&w=1200');">
        <div class="hero-overlay"></div>
        <div class="hero-content">
            <span class="hero-tagline">Premium Coffee Roasters</span>
            <h1 class="hero-title">Crafted Brews, Exceptional Flavors</h1>
            <p class="hero-desc">Indulge in artisanal coffees and homemade baked goodies, prepared daily by master baristas.</p>
            <a href="#menu-anchor" class="btn btn-primary" id="btn-hero-explore">Browse Menu <i class="fa-solid fa-arrow-down"></i></a>
        </div>
    </section>
    <div class="shop-container" id="menu-anchor">
        <div class="filter-bar">
            <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" class="search-input" id="search-input" placeholder="Search coffee, tea, pastries...">
            </div>
            <div class="category-filters" id="category-filters">
                <button class="category-btn active" data-category="All">All Menu</button>
                <button class="category-btn" data-category="Hot Drinks">Hot Drinks</button>
                <button class="category-btn" data-category="Cold Drinks">Cold Drinks</button>
                <button class="category-btn" data-category="Bakery">Bakery</button>
            </div>
        </div>
        <div class="product-grid" id="product-grid">
            <div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; color: var(--text-secondary);">Grinding coffee beans...</p>
            </div>
        </div>
    </div>
  `;

  // Bind hero button scroll
  document.getElementById('btn-hero-explore').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('menu-anchor').scrollIntoView({ behavior: 'smooth' });
  });

  // Load products
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderProductGrid();
  } catch (error) {
    document.getElementById('product-grid').innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--danger);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 1rem;"></i>
          <h3>Failed to load menu</h3>
          <p>We couldn't connect to the coffee machine. Please refresh the page.</p>
      </div>
    `;
  }

  // Setup filters
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', filterAndRenderProducts);

  const filterBtns = document.querySelectorAll('.category-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      filterAndRenderProducts();
    });
  });
}

function filterAndRenderProducts() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  const activeCategory = document.querySelector('.category-btn.active').dataset.category;

  const filtered = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery);
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  renderProductGrid(filtered);
}

function renderProductGrid(items = state.products) {
  const grid = document.getElementById('product-grid');
  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-secondary);">
          <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 3rem; margin-bottom: 1rem;"></i>
          <h3>No items found</h3>
          <p>Try searching for something else or choosing another category.</p>
      </div>
    `;
    return;
  }

  let html = '';
  items.forEach(p => {
    const isAvailable = p.available == 1 || p.available === true;
    const actionButton = isAvailable ? `
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); addToCart(${p.id})">
          Add to Bag <i class="fa-solid fa-plus"></i>
      </button>
    ` : `
      <span class="badge badge-cancelled" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="event.stopPropagation();">
          <i class="fa-solid fa-circle-xmark"></i> Unavailable
      </span>
    `;

    html += `
      <div class="product-card" onclick="openProductDetails(${p.id})" style="cursor: pointer; ${isAvailable ? '' : 'opacity: 0.75;'}">
          <div class="product-card-img-wrapper">
              <img src="${p.image_url}" alt="${p.name}" class="product-card-img" onerror="this.src='https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=400'">
              <span class="product-card-tag">${p.category}</span>
          </div>
          <div class="product-card-content">
              <h3 class="product-card-title">${p.name}</h3>
              <p class="product-card-desc">${p.description}</p>
              <div class="product-card-footer">
                  <span class="product-card-price">₪${p.price.toFixed(2)}</span>
                  ${actionButton}
              </div>
          </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

// Product Details Modal Logic
let detailQty = 1;

function openProductDetails(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  detailQty = 1;

  const modal = document.getElementById('product-details-modal');
  const body = document.getElementById('product-details-body');
  const isAvailable = product.available == 1 || product.available === true;
  
  body.innerHTML = `
    <div class="product-detail-layout" style="${isAvailable ? '' : 'opacity: 0.9;'}">
        <div class="product-detail-hero">
            <img src="${product.image_url}" alt="${product.name}" class="product-detail-img" onerror="this.src='https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=600'">
            <div class="product-detail-overlay"></div>
            <span class="product-detail-category">${product.category}</span>
        </div>
        <div class="product-detail-content">
            <div class="product-detail-header">
                <h2 class="product-detail-name">${product.name}</h2>
                <span class="product-detail-price">₪${product.price.toFixed(2)}</span>
            </div>
            <p class="product-detail-desc">${product.description}</p>
            <div class="product-detail-footer">
                ${isAvailable ? `
                  <div class="detail-qty-selector">
                      <button class="qty-btn" id="detail-qty-minus"><i class="fa-solid fa-minus"></i></button>
                      <span class="qty-val" id="detail-qty-val">1</span>
                      <button class="qty-btn" id="detail-qty-plus"><i class="fa-solid fa-plus"></i></button>
                  </div>
                  <button class="btn btn-primary" id="btn-detail-add" style="flex: 1;">
                      Add to Bag • <span id="detail-total-price">₪${product.price.toFixed(2)}</span>
                  </button>
                ` : `
                  <span class="badge badge-cancelled btn-full" style="text-align: center; justify-content: center; padding: 0.75rem; font-size: 0.9rem;">
                      <i class="fa-solid fa-circle-xmark"></i> Currently Unavailable
                  </span>
                `}
            </div>
        </div>
    </div>
  `;

  // Bind quantity change events in detail modal only if available
  if (isAvailable) {
    const qtyVal = document.getElementById('detail-qty-val');
    const totalPriceEl = document.getElementById('detail-total-price');
    
    document.getElementById('detail-qty-minus').addEventListener('click', () => {
      if (detailQty > 1) {
        detailQty--;
        qtyVal.textContent = detailQty;
        totalPriceEl.textContent = `₪${(product.price * detailQty).toFixed(2)}`;
      }
    });

    document.getElementById('detail-qty-plus').addEventListener('click', () => {
      detailQty++;
      qtyVal.textContent = detailQty;
      totalPriceEl.textContent = `₪${(product.price * detailQty).toFixed(2)}`;
    });

    document.getElementById('btn-detail-add').addEventListener('click', () => {
      const existing = state.cart.find(item => item.id === product.id);
      if (existing) {
        existing.qty += detailQty;
      } else {
        state.cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          qty: detailQty,
          image_url: product.image_url
        });
      }
      saveCartToStorage();
      showToast('Added to bag', `${detailQty}x ${product.name} added to your bag.`, 'success');
      closeProductDetailsModal();
    });
  }

  modal.classList.add('active');
}

function closeProductDetailsModal() {
  document.getElementById('product-details-modal').classList.remove('active');
}

// Password Peek Helper Functions
function getPasswordValue(inputEl) {
  if (!inputEl) return '';
  return inputEl.dataset.realValue !== undefined ? inputEl.dataset.realValue : inputEl.value;
}

function clearPasswordInput(inputEl) {
  if (!inputEl) return;
  inputEl.value = '';
  inputEl.dataset.realValue = '';
}

function enablePasswordPeek(inputEl) {
  if (!inputEl) return;
  inputEl.type = 'text';
  inputEl.style.letterSpacing = '0.05em';

  let realPassword = '';
  let maskTimeout = null;

  inputEl.dataset.realValue = '';

  inputEl.addEventListener('input', (e) => {
    const value = inputEl.value;
    const selectionStart = inputEl.selectionStart;

    if (maskTimeout) {
      clearTimeout(maskTimeout);
      maskTimeout = null;
    }

    if (value === '') {
      realPassword = '';
      inputEl.dataset.realValue = '';
      return;
    }

    let newRealPassword = '';
    let typedIndex = -1;

    for (let i = 0; i < value.length; i++) {
      const char = value.charAt(i);
      if (char === '•') {
        newRealPassword += realPassword.charAt(i) || '';
      } else {
        newRealPassword += char;
        typedIndex = i;
      }
    }

    if (value.length < realPassword.length && typedIndex === -1) {
      const diff = realPassword.length - value.length;
      newRealPassword = realPassword.slice(0, selectionStart) + realPassword.slice(selectionStart + diff);
    }

    realPassword = newRealPassword;
    inputEl.dataset.realValue = realPassword;

    if (typedIndex !== -1) {
      let displayValue = '';
      for (let i = 0; i < realPassword.length; i++) {
        if (i === typedIndex) {
          displayValue += realPassword.charAt(i);
        } else {
          displayValue += '•';
        }
      }
      inputEl.value = displayValue;
      inputEl.setSelectionRange(selectionStart, selectionStart);

      maskTimeout = setTimeout(() => {
        inputEl.value = '•'.repeat(realPassword.length);
        inputEl.setSelectionRange(selectionStart, selectionStart);
      }, 1000);
    } else {
      inputEl.value = '•'.repeat(realPassword.length);
      inputEl.setSelectionRange(selectionStart, selectionStart);
    }
  });

  inputEl.addEventListener('copy', e => e.preventDefault());
  inputEl.addEventListener('cut', e => e.preventDefault());
}

// B. RENDER AUTH VIEW
function renderAuth() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-tabs">
                <div class="auth-tab active" id="tab-login">Login</div>
                <div class="auth-tab" id="tab-register">Register</div>
            </div>
            <div class="auth-form-wrapper">
                <form id="auth-form" novalidate>
                    <div class="form-group">
                        <label for="auth-username">Username *</label>
                        <input type="text" id="auth-username" required placeholder="e.g. espresso_fan">
                        <span class="validation-error" id="err-auth-username"></span>
                    </div>
                    <div class="form-group">
                        <label for="auth-password">Password *</label>
                        <input type="password" id="auth-password" required placeholder="••••••••">
                        <span class="validation-error" id="err-auth-password"></span>
                    </div>
                    <div class="form-group hidden" id="group-confirm-password">
                        <label for="auth-confirm-password">Confirm Password *</label>
                        <input type="password" id="auth-confirm-password" placeholder="••••••••">
                        <span class="validation-error" id="err-auth-confirm-password"></span>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full" id="btn-auth-submit">Sign In</button>
                </form>
            </div>
        </div>
    </div>
  `;

  let mode = 'login'; // 'login' or 'register'

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const confirmGroup = document.getElementById('group-confirm-password');
  const submitBtn = document.getElementById('btn-auth-submit');
  const authForm = document.getElementById('auth-form');

  tabLogin.addEventListener('click', () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    confirmGroup.classList.add('hidden');
    submitBtn.textContent = 'Sign In';
    clearValidationErrors();
    clearPasswordInput(document.getElementById('auth-password'));
    clearPasswordInput(document.getElementById('auth-confirm-password'));
  });

  tabRegister.addEventListener('click', () => {
    mode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    confirmGroup.classList.remove('hidden');
    submitBtn.textContent = 'Create Account';
    clearValidationErrors();
    clearPasswordInput(document.getElementById('auth-password'));
    clearPasswordInput(document.getElementById('auth-confirm-password'));
  });

  // Enable Password Peek on inputs
  enablePasswordPeek(document.getElementById('auth-password'));
  enablePasswordPeek(document.getElementById('auth-confirm-password'));

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (validateAuthForm(mode)) {
      const username = document.getElementById('auth-username').value;
      const password = getPasswordValue(document.getElementById('auth-password'));

      if (mode === 'login') {
        await performLogin(username, password);
      } else {
        await performRegister(username, password);
      }
    }
  });
}

function clearValidationErrors() {
  document.getElementById('err-auth-username').textContent = '';
  document.getElementById('err-auth-password').textContent = '';
  const confirmErr = document.getElementById('err-auth-confirm-password');
  if (confirmErr) confirmErr.textContent = '';
}

// Client side validation for Login/Register
function validateAuthForm(mode) {
  clearValidationErrors();
  let isValid = true;

  const usernameVal = document.getElementById('auth-username').value.trim();
  const passwordVal = getPasswordValue(document.getElementById('auth-password'));

  if (!usernameVal) {
    document.getElementById('err-auth-username').textContent = 'Username is required.';
    isValid = false;
  } else if (usernameVal.length < 3) {
    document.getElementById('err-auth-username').textContent = 'Username must be at least 3 characters.';
    isValid = false;
  }

  if (!passwordVal) {
    document.getElementById('err-auth-password').textContent = 'Password is required.';
    isValid = false;
  } else if (passwordVal.length < 6) {
    document.getElementById('err-auth-password').textContent = 'Password must be at least 6 characters.';
    isValid = false;
  }

  if (mode === 'register') {
    const confirmPasswordVal = getPasswordValue(document.getElementById('auth-confirm-password'));
    if (!confirmPasswordVal) {
      document.getElementById('err-auth-confirm-password').textContent = 'Please confirm your password.';
      isValid = false;
    } else if (passwordVal !== confirmPasswordVal) {
      document.getElementById('err-auth-confirm-password').textContent = 'Passwords do not match.';
      isValid = false;
    }
  }

  return isValid;
}

async function performLogin(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      state.user = data.user;
      updateHeaderUI();
      showToast('Welcome Back!', `Logged in as ${data.user.username}`, 'success');
      window.location.hash = '#shop';
    } else {
      showToast('Login Failed', data.error || 'Invalid username or password.', 'error');
    }
  } catch (error) {
    showToast('Network Error', 'Failed to communicate with the server.', 'error');
  }
}

async function performRegister(username, password) {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Account Created!', 'Please sign in with your new credentials.', 'success');
      // Switch tabs to login
      document.getElementById('tab-login').click();
    } else {
      showToast('Registration Failed', data.error || 'Failed to register.', 'error');
    }
  } catch (error) {
    showToast('Network Error', 'Failed to communicate with the server.', 'error');
  }
}

async function performLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    state.user = null;
    updateHeaderUI();
    showToast('Signed Out', 'You have been successfully logged out.', 'info');
    window.location.hash = '#shop';
  } catch (error) {
    console.error('Logout error', error);
  }
}

// C. RENDER ORDERS VIEW
async function renderOrders() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="orders-container">
        <div class="view-header">
            <h2>Your Order History</h2>
        </div>
        <div id="orders-list">
            <div style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            </div>
        </div>
    </div>
  `;

  try {
    const res = await fetch('/api/orders/my');
    if (!res.ok) throw new Error('Failed to fetch orders');
    const orders = await res.json();

    const list = document.getElementById('orders-list');
    if (orders.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 4rem; background-color: var(--bg-glass); border: 1px solid var(--border-glass); border-radius: var(--radius-md);">
            <i class="fa-solid fa-mug-saucer" style="font-size: 3.5rem; color: var(--accent-dark); margin-bottom: 1rem;"></i>
            <h3>No orders yet</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Your coffee journeys start here! Place your first order today.</p>
            <a href="#shop" class="btn btn-primary">Visit Shop</a>
        </div>
      `;
      return;
    }

    let html = '';
    orders.forEach(order => {
      const date = new Date(order.created_at).toLocaleString();
      let statusBadge = `<span class="badge badge-pending"><i class="fa-solid fa-clock"></i> Preparing</span>`;
      if (order.status === 'completed') {
        statusBadge = `<span class="badge badge-completed"><i class="fa-solid fa-circle-check"></i> Ready to Pick Up</span>`;
      } else if (order.status === 'cancelled') {
        statusBadge = `<span class="badge badge-cancelled"><i class="fa-solid fa-circle-xmark"></i> Cancelled</span>`;
      }

      let itemsHtml = '';
      order.items.forEach(item => {
        itemsHtml += `
          <div class="order-item-row">
              <img src="${item.image_url}" alt="${item.product_name}" onerror="this.src='https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=150'">
              <div class="order-item-qty-name">${item.quantity}x ${item.product_name}</div>
              <div class="order-item-row-price">₪${(item.price * item.quantity).toFixed(2)}</div>
          </div>
        `;
      });

      html += `
        <div class="order-card">
            <div class="order-card-header">
                <div class="order-meta">
                    <div>Order ID: <span class="order-id-label">#CS-${order.id}</span></div>
                    <div>Date: <span>${date}</span></div>
                </div>
                ${statusBadge}
            </div>
            <div class="order-items-list">
                ${itemsHtml}
            </div>
            <div class="order-card-footer">
                <span class="order-total-lbl">Total Paid:</span>
                <span class="order-total-val">₪${order.total_price.toFixed(2)}</span>
            </div>
        </div>
      `;
    });

    list.innerHTML = html;
  } catch (error) {
    document.getElementById('orders-list').innerHTML = `
      <div style="text-align: center; color: var(--danger); padding: 3rem;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 1rem;"></i>
          <p>Failed to retrieve orders. Please check your credentials.</p>
      </div>
    `;
  }
}

// D. RENDER ADMIN VIEW
async function renderAdmin() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="shop-container">
        <div class="view-header">
            <h2>Admin Operations Portal</h2>
            <button class="btn btn-primary" id="btn-add-product-modal">
                <i class="fa-solid fa-plus"></i> Add New Product
            </button>
        </div>
        <div class="admin-tabs">
            <div class="admin-tab active" id="admin-tab-products">Products Database</div>
            <div class="admin-tab" id="admin-tab-orders">Orders Queue</div>
        </div>
        <div id="admin-panel-content">
            <div style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            </div>
        </div>
    </div>
  `;

  // Bind Admin Tabs
  const tabProducts = document.getElementById('admin-tab-products');
  const tabOrders = document.getElementById('admin-tab-orders');

  tabProducts.addEventListener('click', () => {
    state.activeAdminTab = 'products';
    tabProducts.classList.add('active');
    tabOrders.classList.remove('active');
    loadAdminProducts();
  });

  tabOrders.addEventListener('click', () => {
    state.activeAdminTab = 'orders';
    tabOrders.classList.add('active');
    tabProducts.classList.remove('active');
    loadAdminOrders();
  });

  // Add Product Button
  document.getElementById('btn-add-product-modal').addEventListener('click', () => {
    openProductModal();
  });

  // Initial load
  if (state.activeAdminTab === 'products') {
    tabProducts.click();
  } else {
    tabOrders.click();
  }
}

// Admin Sub-Views: Products
async function loadAdminProducts() {
  const content = document.getElementById('admin-panel-content');
  content.innerHTML = `<div style="text-align: center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i></div>`;

  try {
    const res = await fetch('/api/products');
    state.products = await res.json();

    let html = `
      <div class="table-wrapper">
          <table>
              <thead>
                  <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Available</th>
                      <th>Actions</th>
                  </tr>
              </thead>
              <tbody>
    `;

    state.products.forEach(p => {
      const availText = p.available ?
        `<span class="badge badge-completed" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;"><i class="fa-solid fa-check"></i> Yes</span>` :
        `<span class="badge badge-cancelled" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;"><i class="fa-solid fa-xmark"></i> No</span>`;

      html += `
        <tr>
            <td>
                <img src="${p.image_url}" class="td-product-img" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=100'">
            </td>
            <td style="font-weight: 600;">${p.name}</td>
            <td>${p.category}</td>
            <td style="font-weight: 600; color: var(--primary);">₪${p.price.toFixed(2)}</td>
            <td>${availText}</td>
            <td class="td-actions">
                <button class="btn btn-secondary btn-sm" onclick="openProductModal(${p.id})">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </td>
        </tr>
      `;
    });

    html += `
              </tbody>
          </table>
      </div>
    `;
    content.innerHTML = html;
  } catch (error) {
    content.innerHTML = `<p style="color: var(--danger); text-align: center;">Failed to load products database.</p>`;
  }
}

// Admin Sub-Views: Orders
async function loadAdminOrders() {
  const content = document.getElementById('admin-panel-content');
  content.innerHTML = `<div style="text-align: center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i></div>`;

  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();

    if (orders.length === 0) {
      content.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-secondary);"><p>No orders in the system.</p></div>`;
      return;
    }

    let html = `
      <div class="table-wrapper">
          <table>
              <thead>
                  <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items Ordered</th>
                      <th>Total</th>
                      <th>Status Queue</th>
                  </tr>
              </thead>
              <tbody>
    `;

    orders.forEach(order => {
      const date = new Date(order.created_at).toLocaleString();
      let itemsList = '';
      order.items.forEach(item => {
        itemsList += `<div>${item.quantity}x ${item.product_name}</div>`;
      });

      html += `
        <tr>
            <td style="font-weight: 700;">#CS-${order.id}</td>
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${date}</td>
            <td style="font-weight: 600;">${order.username}</td>
            <td style="font-size: 0.9rem;">${itemsList}</td>
            <td style="font-weight: 700; color: var(--primary);">₪${order.total_price.toFixed(2)}</td>
            <td>
                <select class="table-select" onchange="updateOrderStatus(${order.id}, this.value)">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Preparing</option>
                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Ready / Complete</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
        </tr>
      `;
    });

    html += `
              </tbody>
          </table>
      </div>
    `;
    content.innerHTML = html;
  } catch (error) {
    content.innerHTML = `<p style="color: var(--danger); text-align: center;">Failed to load orders queue.</p>`;
  }
}

// Update Order status
async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      showToast('Order Status Updated', `Order #CS-${orderId} is now ${newStatus}.`, 'success');
      loadAdminOrders();
    } else {
      const err = await res.json();
      showToast('Update Failed', err.error || 'Could not update status.', 'error');
    }
  } catch (error) {
    showToast('Network Error', 'Failed to contact server.', 'error');
  }
}

// Delete Product
async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to remove this coffee product from the database?')) return;

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Product Deleted', 'Item has been removed from catalog.', 'success');
      loadAdminProducts();
    } else {
      const err = await res.json();
      showToast('Delete Failed', err.error || 'Could not delete item.', 'error');
    }
  } catch (error) {
    showToast('Network Error', 'Failed to contact server.', 'error');
  }
}

// 5. Product Add/Edit Modal Manager (Admin)
function openProductModal(productId = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('product-form');

  // Clear inputs
  document.getElementById('product-id').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-category').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-description').value = '';
  document.getElementById('product-image').value = '';
  document.getElementById('product-available').checked = true;

  clearProductValidationErrors();

  if (productId) {
    title.textContent = 'Edit Coffee Product';
    const product = state.products.find(p => p.id === productId);
    if (product) {
      document.getElementById('product-id').value = product.id;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-category').value = product.category;
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-description').value = product.description;
      document.getElementById('product-image').value = product.image_url;
      document.getElementById('product-available').checked = product.available == 1;
    }
  } else {
    title.textContent = 'Add New Coffee Product';
  }

  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

function clearProductValidationErrors() {
  document.getElementById('err-product-name').textContent = '';
  document.getElementById('err-product-category').textContent = '';
  document.getElementById('err-product-price').textContent = '';
  document.getElementById('err-product-description').textContent = '';
  document.getElementById('err-product-image').textContent = '';
}

// Client side validation for product save
function validateProductForm() {
  clearProductValidationErrors();
  let isValid = true;

  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const priceVal = document.getElementById('product-price').value;
  const description = document.getElementById('product-description').value.trim();
  const image = document.getElementById('product-image').value.trim();

  if (!name) {
    document.getElementById('err-product-name').textContent = 'Product name is required.';
    isValid = false;
  }
  if (!category) {
    document.getElementById('err-product-category').textContent = 'Please choose a category.';
    isValid = false;
  }

  const price = parseFloat(priceVal);
  if (!priceVal) {
    document.getElementById('err-product-price').textContent = 'Price is required.';
    isValid = false;
  } else if (isNaN(price) || price <= 0) {
    document.getElementById('err-product-price').textContent = 'Price must be a valid positive number.';
    isValid = false;
  }

  if (!description) {
    document.getElementById('err-product-description').textContent = 'Description is required.';
    isValid = false;
  }
  if (!image) {
    document.getElementById('err-product-image').textContent = 'Image URL is required.';
    isValid = false;
  }

  return isValid;
}

// Save Product (Create / Edit)
async function saveProduct(e) {
  e.preventDefault();
  if (!validateProductForm()) return;

  const id = document.getElementById('product-id').value;
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const price = parseFloat(document.getElementById('product-price').value);
  const description = document.getElementById('product-description').value.trim();
  const image_url = document.getElementById('product-image').value.trim();
  const available = document.getElementById('product-available').checked ? 1 : 0;

  const payload = { name, category, price, description, image_url, available };
  const method = id ? 'PUT' : 'POST';
  const endpoint = id ? `/api/products/${id}` : '/api/products';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(
        id ? 'Product Updated' : 'Product Created',
        `Successfully saved "${name}" to the menu catalog.`,
        'success'
      );
      closeProductModal();
      loadAdminProducts();
    } else {
      const err = await res.json();
      showToast('Save Failed', err.error || 'Failed to submit form.', 'error');
    }
  } catch (error) {
    showToast('Network Error', 'Failed to communicate with server.', 'error');
  }
}

// 6. Checkout Process (User)
async function performCheckout() {
  if (state.cart.length === 0) return;

  if (!state.user) {
    showToast('Login Required', 'You must sign in to complete your checkout.', 'info');
    toggleCartDrawer(false);
    window.location.hash = '#auth';
    return;
  }

  const payload = {
    items: state.cart.map(item => ({
      productId: item.id,
      quantity: item.qty
    }))
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      showToast('Order Placed!', `Your order #CS-${data.orderId} is being prepared!`, 'success');
      clearCart();
      toggleCartDrawer(false);
      window.location.hash = '#orders';
    } else {
      const err = await res.json();
      showToast('Checkout Failed', err.error || 'Could not process check out.', 'error');
    }
  } catch (error) {
    showToast('Network Error', 'Failed to communicate with server during checkout.', 'error');
  }
}

// 7. Initial App Startup & Navigation Binding
window.addEventListener('DOMContentLoaded', async () => {
  // Load local cart
  loadCartFromStorage();

  // Load user session
  await fetchUserSession();

  // Bind Router Hash change
  window.addEventListener('hashchange', handleNavigation);

  // Trigger first route
  handleNavigation();

  // Navigation UI bindings
  document.getElementById('nav-logo').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#shop';
  });

  // Mobile navigation button toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.getElementById('nav-menu');
  mobileMenuBtn.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });

  // Drawer triggers
  document.getElementById('cart-toggle-btn').addEventListener('click', () => toggleCartDrawer(true));
  document.getElementById('cart-close-btn').addEventListener('click', () => toggleCartDrawer(false));
  document.getElementById('cart-drawer-overlay').addEventListener('click', () => toggleCartDrawer(false));

  // Checkout trigger
  document.getElementById('btn-checkout').addEventListener('click', performCheckout);

  // Modal Cancel bindings
  document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
  document.getElementById('btn-cancel-product').addEventListener('click', closeProductModal);

  // Modal Save binding
  document.getElementById('product-form').addEventListener('submit', saveProduct);

  // Product Details Modal Close bindings
  document.getElementById('product-details-close').addEventListener('click', closeProductDetailsModal);
  document.getElementById('product-details-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('product-details-modal')) {
      closeProductDetailsModal();
    }
  });
});
