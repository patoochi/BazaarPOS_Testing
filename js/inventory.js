// ============================================
// BazaarOS — Inventory Module
// ============================================

const Inventory = {
  products: [],
  categories: [],
  editingId: null,

  async load() {
    if (!Auth.currentUser) return;
    await Promise.all([
      Inventory.fetchProducts(),
      Inventory.fetchCategories()
    ]);
  },

  async fetchCategories() {
    const isCustomOnly = localStorage.getItem('bazaar_custom_categories') === 'true';
    const defaults = isCustomOnly ? [] : ['Drinks', 'Snacks', 'Household', 'Personal Care', 'Food', 'Electronics', 'Clothing', 'Others'];
    
    try {
      const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('user_id', Auth.currentUser.id);
      
      const custom = (data || []).map(c => c.name);
      Inventory.categories = [...new Set([...defaults, ...custom])];
      
      // Update POS cache too
      if (typeof POS !== 'undefined') POS.customCategories = data || [];
      
      Inventory.renderCategories();
    } catch (e) {
      Inventory.categories = defaults;
      Inventory.renderCategories();
    }
  },

  renderCategories() {
    const filterSelect = document.getElementById('inv-filter-category');
    const modalSelect = document.getElementById('inv-category');
    
    if (!filterSelect || !modalSelect) return;

    const options = Inventory.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    filterSelect.innerHTML = '<option value="">All Categories</option>' + options;
    modalSelect.innerHTML = options;
  },

  async fetchProducts() {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('user_id', Auth.currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      Toast.show('Failed to load products: ' + error.message, 'error');
      return;
    }

    Inventory.products = data || [];
    Inventory.render();
  },

  render(filtered = null) {
    const list = filtered || Inventory.products;
    const tbody = document.getElementById('inventory-tbody');

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <i class="fas fa-box-open"></i>
              <h3>No products yet</h3>
              <p>Add your first product to get started</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      let stockBadge;
      if (p.quantity <= 0) {
        stockBadge = `<span class="badge badge-danger">Out of stock</span>`;
      } else if (p.quantity <= 5) {
        stockBadge = `<span class="badge badge-warning">Low: ${p.quantity}</span>`;
      } else {
        stockBadge = `<span class="badge badge-success">${p.quantity}</span>`;
      }

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="product-thumb" style="width:36px; height:36px; border-radius:var(--radius-sm); background:var(--bg-input); display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--border-color);">
                ${p.image_url ? `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:18px;">${POS.getCategoryEmoji(p.category)}</span>`}
              </div>
              <strong style="color:var(--text-heading)">${Inventory.escapeHtml(p.name)}</strong>
            </div>
          </td>
          <td>${Inventory.escapeHtml(p.sku || '—')}</td>
          <td>${Inventory.escapeHtml(p.category || '—')}</td>
          <td>${stockBadge}</td>
          <td>₱${parseFloat(p.cost_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td>₱${parseFloat(p.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td>${Inventory.escapeHtml(p.supplier || '—')}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-ghost" onclick="Inventory.openEdit('${p.id}')" title="Edit">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-ghost" onclick="Inventory.confirmDelete('${p.id}')" title="Delete" style="color:var(--danger)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  // Open modal for adding
  openAdd() {
    Inventory.editingId = null;
    document.getElementById('inventory-modal-title').textContent = 'Add New Product';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inv-barcode-preview').textContent = '';
    Inventory.removeImage();
    Inventory.showModal();
  },

  // Open modal for editing
  openEdit(id) {
    const product = Inventory.products.find(p => p.id === id);
    if (!product) return;

    Inventory.editingId = id;
    document.getElementById('inventory-modal-title').textContent = 'Edit Product';
    document.getElementById('inv-name').value = product.name;
    document.getElementById('inv-sku').value = product.sku || '';
    document.getElementById('inv-category').value = product.category || '';
    document.getElementById('inv-quantity').value = product.quantity;
    document.getElementById('inv-cost-price').value = product.cost_price || 0;
    document.getElementById('inv-price').value = product.price || 0;
    document.getElementById('inv-supplier').value = product.supplier || '';
    document.getElementById('inv-barcode-preview').textContent = product.sku ? `Barcode: ${product.sku}` : '';
    
    // Set image preview
    const preview = document.getElementById('inv-image-preview');
    const removeBtn = document.getElementById('remove-image-btn');
    const urlInput = document.getElementById('inv-image-url');
    
    if (product.image_url) {
      preview.innerHTML = `<img src="${product.image_url}" style="width:100%; height:100%; object-fit:cover;">`;
      urlInput.value = product.image_url;
      removeBtn.style.display = 'flex';
    } else {
      Inventory.removeImage();
    }
    
    Inventory.showModal();
  },

  showModal() {
    document.getElementById('inventory-modal').classList.add('visible');
  },

  closeModal() {
    document.getElementById('inventory-modal').classList.remove('visible');
    Inventory.stopScanner();
  },

  async save() {
    const name = document.getElementById('inv-name').value.trim();
    const sku = document.getElementById('inv-sku').value.trim();
    const category = document.getElementById('inv-category').value;
    const quantity = parseInt(document.getElementById('inv-quantity').value) || 0;
    const cost_price = parseFloat(document.getElementById('inv-cost-price').value) || 0;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    const supplier = document.getElementById('inv-supplier').value.trim();

    if (!name) {
      Toast.show('Product name is required', 'error');
      return;
    }

    const productData = {
      name,
      sku,
      category,
      quantity,
      cost_price,
      price,
      supplier,
      image_url: document.getElementById('inv-image-url').value || null,
      user_id: Auth.currentUser.id
    };

    let error;

    if (Inventory.editingId) {
      // Update
      const res = await supabaseClient
        .from('products')
        .update(productData)
        .eq('id', Inventory.editingId)
        .eq('user_id', Auth.currentUser.id);
      error = res.error;
    } else {
      // Insert
      const res = await supabaseClient
        .from('products')
        .insert(productData);
      error = res.error;
    }

    if (error) {
      Toast.show('Error saving product: ' + error.message, 'error');
      return;
    }

    Toast.show(Inventory.editingId ? 'Product updated!' : 'Product added!', 'success');
    Inventory.closeModal();
    await Inventory.fetchProducts();
  },

  async confirmDelete(id) {
    const product = Inventory.products.find(p => p.id === id);
    if (!product) return;

    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    const { error } = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', Auth.currentUser.id);

    if (error) {
      Toast.show('Error deleting: ' + error.message, 'error');
      return;
    }

    Toast.show('Product deleted', 'success');
    await Inventory.fetchProducts();
  },

  // Search & filter
  filter() {
    const search = document.getElementById('inv-search').value.toLowerCase();
    const category = document.getElementById('inv-filter-category').value;

    const filtered = Inventory.products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search) ||
        (p.sku && p.sku.toLowerCase().includes(search));
      const matchCategory = !category || p.category === category;
      return matchSearch && matchCategory;
    });

    Inventory.render(filtered);
  },

  // Barcode scanner for inventory
  scannerStream: null,
  isProcessingScan: false,

  async startScanner() {
    Inventory.isProcessingScan = false;
    const container = document.getElementById('inv-scanner-container');
    const video = document.getElementById('inv-scanner-video');
    container.style.display = 'block';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = stream;
      Inventory.scannerStream = stream;
      video.play();

      // Use QuaggaJS if available, otherwise use BarcodeDetector API
      if ('BarcodeDetector' in window) {
        Inventory.startBarcodeDetection(video);
      } else {
        // Fallback: attempt with Quagga
        Inventory.startQuaggaScanner();
      }
    } catch (err) {
      Toast.show('Camera access denied. Please use manual barcode input.', 'error');
      container.style.display = 'none';
    }
  },

  async startBarcodeDetection(video) {
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
    });

    const detect = async () => {
      if (!Inventory.scannerStream) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          
          // Ignore highly unlikely, short codes (noise)
          if (!code || code.length < 5) {
            if (Inventory.scannerStream) requestAnimationFrame(detect);
            return;
          }

          if (Inventory.isProcessingScan) return;
          Inventory.isProcessingScan = true;

          document.getElementById('inv-sku').value = code;
          document.getElementById('inv-barcode-preview').textContent = `Scanned: ${code}`;
          Toast.show(`Barcode scanned: ${code}`, 'success');
          Inventory.stopScanner();
          return;
        }
      } catch (e) { /* continue scanning */ }
      if (Inventory.scannerStream) {
        requestAnimationFrame(detect);
      }
    };
    detect();
  },

  startQuaggaScanner() {
    if (typeof Quagga === 'undefined') {
      Toast.show('Barcode library not available. Enter barcode manually.', 'info');
      Inventory.stopScanner();
      return;
    }

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: document.getElementById('inv-scanner-container'),
        constraints: { facingMode: 'environment' }
      },
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader', 'upc_e_reader']
      }
    }, (err) => {
      if (err) {
        Toast.show('Scanner error. Enter barcode manually.', 'error');
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      
      // Filter out common false-positives
      if (!code || code.length < 5) return;

      if (Inventory.isProcessingScan) return;
      Inventory.isProcessingScan = true;

      document.getElementById('inv-sku').value = code;
      document.getElementById('inv-barcode-preview').textContent = `Scanned: ${code}`;
      Toast.show(`Barcode scanned: ${code}`, 'success');
      Quagga.stop();
      Inventory.stopScanner();
    });
  },

  stopScanner() {
    if (Inventory.scannerStream) {
      Inventory.scannerStream.getTracks().forEach(t => t.stop());
      Inventory.scannerStream = null;
    }
    const container = document.getElementById('inv-scanner-container');
    if (container) container.style.display = 'none';

    if (typeof Quagga !== 'undefined') {
      try { Quagga.stop(); } catch(e) {}
    }
  },

  // Image Handling Logic
  async handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Show local preview instantly
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('inv-image-preview');
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
      document.getElementById('remove-image-btn').style.display = 'flex';
    };
    reader.readAsDataURL(file);

    // 2. Resize and Upload
    const btn = event.target.nextElementSibling;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resizing...';

    try {
      // Create a smaller version of the image (Max 512px)
      const resizedBlob = await Inventory.resizeImage(file, 512, 512);
      
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
      const fileExt = 'jpg'; // We convert to JPG in resize
      const fileName = `${Auth.currentUser.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('product-images')
        .upload(filePath, resizedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage
        .from('product-images')
        .getPublicUrl(filePath);

      document.getElementById('inv-image-url').value = data.publicUrl;
      Toast.show('Image optimized and uploaded', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      Toast.show('Upload failed: ' + error.message, 'error');
      Inventory.removeImage();
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  // Helper to resize image using Canvas
  resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Force Square 1:1 Aspect Ratio (Center Crop)
        const size = Math.min(width, height);
        const sourceX = (width - size) / 2;
        const sourceY = (height - size) / 2;

        canvas.width = maxWidth;
        canvas.height = maxHeight;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw the cropped square onto the 512x512 canvas
        ctx.drawImage(img, sourceX, sourceY, size, size, 0, 0, maxWidth, maxHeight);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.85); // 85% quality is perfect balance
      };
      img.onerror = reject;
    });
  },

  removeImage() {
    document.getElementById('inv-image-input').value = '';
    document.getElementById('inv-image-url').value = '';
    document.getElementById('inv-image-preview').innerHTML = '<i class="fas fa-image" style="color:var(--text-muted); font-size:24px;"></i>';
    document.getElementById('remove-image-btn').style.display = 'none';
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
