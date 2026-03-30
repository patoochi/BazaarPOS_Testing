// ============================================
// BazaarOS — POS (Point of Sale) Module
// ============================================

const POS = {
  products: [],
  cart: [],
  scannerStream: null,
  isProcessingScan: false,
  isInitialized: false,
  customCategories: [],

  channel: null,

  async load() {
    if (!Auth.currentUser) return;
    await Promise.all([
      POS.fetchProducts(),
      POS.fetchCategories(),
      POS.fetchCloudCart()
    ]);
    POS.setupRealtime();
    POS.renderCart();
  },

  async fetchCategories() {
    try {
      const { data } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('user_id', Auth.currentUser.id);
      POS.customCategories = data || [];
    } catch (e) {
      console.error('POS category load err:', e);
    }
  },

  async fetchCloudCart() {
    try {
      const { data, error } = await supabaseClient
        .from('active_carts')
        .select('cart_data')
        .eq('user_id', Auth.currentUser.id)
        .maybeSingle();
      
      if (data && data.cart_data) {
        POS.cart = data.cart_data;
      }
      POS.isInitialized = true; // Mark as ready after fetching cloud data
    } catch (e) { 
      console.error('Cloud load err:', e);
      POS.isInitialized = true; // Still mark as ready so user can start fresh
    }
  },

  setupRealtime() {
    if (POS.channel) return;
    POS.channel = supabaseClient
      .channel('pos_active_carts')
      .on('postgres_changes', { 
         event: '*', 
         schema: 'public', 
         table: 'active_carts', 
         filter: `user_id=eq.${Auth.currentUser.id}` 
      }, payload => {
         if (payload.new && payload.new.cart_data) {
            POS.cart = payload.new.cart_data;
            POS.renderCart(false); // Render UI but skip mirroring back to cloud
         }
      })
      .subscribe();
  },

  async fetchProducts() {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('user_id', Auth.currentUser.id)
      .order('name', { ascending: true });

    if (error) {
      Toast.show('Failed to load products', 'error');
      return;
    }

    POS.products = data || [];
    POS.renderProducts();
  },

  renderProducts(filtered = null) {
    const list = filtered || POS.products;
    const grid = document.getElementById('pos-product-grid');

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <i class="fas fa-box-open"></i>
          <h3>No products found</h3>
          <p>Add products in the Inventory section first</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(p => {
      const outOfStock = p.quantity <= 0;
      return `
        <div class="pos-product-card ${outOfStock ? 'out-of-stock' : ''}"
             onclick="POS.addToCart('${p.id}')" 
             title="${outOfStock ? 'Out of stock' : 'Click to add'}">
          <div class="product-visual">
            ${p.image_url ? `<img src="${p.image_url}" class="product-img-full">` : `<div class="product-emoji">${POS.getCategoryEmoji(p.category)}</div>`}
          </div>
          <div class="product-name">${POS.escapeHtml(p.name)}</div>
          <div class="product-price">₱${parseFloat(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          <div class="product-stock">${outOfStock ? 'Out of stock' : `Stock: ${p.quantity}`}</div>
        </div>`;
    }).join('');
  },

  getCategoryEmoji(category) {
    // Check custom categories first
    const custom = POS.customCategories.find(c => c.name === category);
    if (custom && custom.emoji) return custom.emoji;

    const map = {
      'Drinks': '🥤',
      'Snacks': ' popcorn',
      'Household': '🏠',
      'Personal Care': '🧴',
      'Food': '🍔',
      'Electronics': '📱',
      'Clothing': '👕',
      'Others': '📦'
    };
    return map[category] || '📦';
  },

  // Add product to cart
  addToCart(productId) {
    const product = POS.products.find(p => p.id === productId);
    if (!product || product.quantity <= 0) return;

    const existing = POS.cart.find(item => item.product_id === productId);
    if (existing) {
      if (existing.qty >= product.quantity) {
        Toast.show(`Only ${product.quantity} in stock`, 'error');
        return;
      }
      existing.qty++;
    } else {
      POS.cart.push({
        product_id: productId,
        name: product.name,
        price: parseFloat(product.price),
        cost_price: parseFloat(product.cost_price || 0),
        image_url: product.image_url || null,
        category: product.category,
        qty: 1,
        maxQty: product.quantity
      });
    }

    POS.renderCart();
  },

  // Update cart item quantity
  updateQty(productId, delta) {
    const item = POS.cart.find(i => i.product_id === productId);
    if (!item) return;

    const product = POS.products.find(p => p.id === productId);
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      POS.removeFromCart(productId);
      return;
    }

    if (product && newQty > product.quantity) {
      Toast.show(`Only ${product.quantity} in stock`, 'error');
      return;
    }

    item.qty = newQty;
    POS.renderCart();
  },

  removeFromCart(productId) {
    POS.cart = POS.cart.filter(i => i.product_id !== productId);
    POS.renderCart();
  },

  clearCart() {
    POS.cart = [];
    POS.renderCart();
  },

  getTotal() {
    return POS.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  },

  renderCart(syncCloud = true) {
    // Broadcast cart data to customer view via localStorage (Local backup bridge)
    localStorage.setItem('bazaarpos_current_cart', JSON.stringify({
      items: POS.cart,
      total: POS.getTotal()
    }));

    if (syncCloud && Auth.currentUser && POS.isInitialized) {
      POS.syncCartCloud();
    }

    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total-value');
    const checkoutBtn = document.getElementById('checkout-btn');

    const totalItems = POS.cart.reduce((sum, i) => sum + i.qty, 0);
    cartCount.textContent = totalItems;

    if (POS.cart.length === 0) {
      cartItems.innerHTML = `
        <div class="cart-empty">
          <i class="fas fa-shopping-cart"></i>
          <p>Cart is empty<br><small>Tap a product or scan a barcode to add</small></p>
        </div>`;
      cartTotal.textContent = '₱0.00';
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = '0.5';
      return;
    }

    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = '1';

    cartItems.innerHTML = POS.cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-thumb" style="width:40px; height:40px; border-radius:var(--radius-sm); overflow:hidden; background:var(--bg-input); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
           ${item.image_url ? `<img src="${item.image_url}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:18px;">${POS.getCategoryEmoji(item.category)}</span>`}
        </div>
        <div class="cart-item-info" style="flex:1; margin-left:12px;">
          <h4 style="font-size:14px; margin:0;">${POS.escapeHtml(item.name)}</h4>
          <span style="font-size:12px; color:var(--text-muted);">₱${item.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })} each</span>
        </div>
        <div class="cart-item-qty">
          <button onclick="POS.updateQty('${item.product_id}', -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="POS.updateQty('${item.product_id}', 1)">+</button>
        </div>
        <div class="cart-item-price">₱${(item.price * item.qty).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        <button class="cart-item-remove" onclick="POS.removeFromCart('${item.product_id}')">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');

    cartTotal.textContent = '₱' + POS.getTotal().toLocaleString('en-PH', { minimumFractionDigits: 2 });
  },

  async syncCartCloud() {
    try {
      await supabaseClient
        .from('active_carts')
        .upsert({ 
          user_id: Auth.currentUser.id, 
          cart_data: POS.cart, 
          updated_at: new Date().toISOString() 
        });
    } catch (e) {
      console.error('Failed to push cart:', e);
    }
  },

  // Checkout
  async checkout() {
    if (POS.cart.length === 0) return;

    const total = POS.getTotal();
    const total_cost = POS.cart.reduce((sum, item) => sum + (item.cost_price * item.qty), 0);
    const total_profit = total - total_cost;

    const items = POS.cart.map(item => ({
      product_id: item.product_id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      cost_price: item.cost_price
    }));

    // Create sale record
    const { error: saleError } = await supabaseClient
      .from('sales')
      .insert({
        user_id: Auth.currentUser.id,
        items: items,
        total: total,
        total_cost: total_cost,
        total_profit: total_profit
      });

    if (saleError) {
      Toast.show('Checkout failed: ' + saleError.message, 'error');
      return;
    }

    // Decrement stock quantities
    for (const item of POS.cart) {
      const product = POS.products.find(p => p.id === item.product_id);
      if (product) {
        const newQty = Math.max(0, product.quantity - item.qty);
        await supabaseClient
          .from('products')
          .update({ quantity: newQty })
          .eq('id', item.product_id);
      }
    }

    // Show receipt
    POS.showReceipt(items, total);

    // Clear cart and refresh products
    POS.cart = [];
    POS.renderCart();
    await POS.fetchProducts();

    Toast.show('Sale completed successfully!', 'success');
  },

  showReceipt(items, total) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const receiptItems = items.map(i => `
      <tr>
        <td>${POS.escapeHtml(i.name)}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">₱${(i.price * i.qty).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    document.getElementById('receipt-content').innerHTML = `
      <div class="receipt">
        <h3>BazaarOS</h3>
        <p class="receipt-date">${dateStr}</p>
        <hr style="border:none;border-top:1px dashed #ccc;margin:12px 0">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${receiptItems}</tbody>
        </table>
        <hr style="border:none;border-top:1px dashed #ccc;margin:12px 0">
        <div class="receipt-total">Total: ₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        <p style="margin-top:16px;font-size:12px;color:#888">Thank you for your purchase!</p>
      </div>
    `;

    document.getElementById('receipt-modal').classList.add('visible');
  },

  closeReceipt() {
    document.getElementById('receipt-modal').classList.remove('visible');
  },

  // POS Search
  searchProducts() {
    const query = document.getElementById('pos-search').value.toLowerCase();
    if (!query) {
      POS.renderProducts();
      return;
    }
    const filtered = POS.products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );
    POS.renderProducts(filtered);
  },

  // Barcode scanner for POS
  async startScanner() {
    POS.isProcessingScan = false;
    const container = document.getElementById('pos-scanner-container');
    const video = document.getElementById('pos-scanner-video');
    container.style.display = 'block';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = stream;
      POS.scannerStream = stream;
      video.play();

      if ('BarcodeDetector' in window) {
        POS.detectBarcode(video);
      } else if (typeof Quagga !== 'undefined') {
        POS.startQuaggaPOS();
      } else {
        Toast.show('Barcode detection not supported. Use search instead.', 'info');
        POS.stopScanner();
      }
    } catch (err) {
      Toast.show('Camera access denied. Use the search bar instead.', 'error');
      container.style.display = 'none';
    }
  },

  async detectBarcode(video) {
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
    });

    const detect = async () => {
      if (!POS.scannerStream) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          
          if (!code || code.length < 5) {
            if (POS.scannerStream) requestAnimationFrame(detect);
            return;
          }

          POS.handleScannedBarcode(code);
          return;
        }
      } catch (e) { /* continue */ }
      if (POS.scannerStream) {
        requestAnimationFrame(detect);
      }
    };
    detect();
  },

  startQuaggaPOS() {
    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: document.getElementById('pos-scanner-container'),
        constraints: { facingMode: 'environment' }
      },
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader']
      }
    }, (err) => {
      if (err) {
        Toast.show('Scanner error', 'error');
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      if (!code || code.length < 5) return;
      
      POS.handleScannedBarcode(code);
      Quagga.stop();
    });
  },

  handleScannedBarcode(code) {
    if (POS.isProcessingScan) return;
    POS.isProcessingScan = true;

    // Find product by SKU/barcode
    const product = POS.products.find(p => p.sku === code);
    if (product) {
      POS.addToCart(product.id);
      Toast.show(`Added: ${product.name}`, 'success');
    } else {
      Toast.show(`Product not found for barcode: ${code}`, 'error');
    }
    POS.stopScanner();
  },

  stopScanner() {
    if (POS.scannerStream) {
      POS.scannerStream.getTracks().forEach(t => t.stop());
      POS.scannerStream = null;
    }
    const container = document.getElementById('pos-scanner-container');
    if (container) container.style.display = 'none';

    if (typeof Quagga !== 'undefined') {
      try { Quagga.stop(); } catch(e) {}
    }
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
