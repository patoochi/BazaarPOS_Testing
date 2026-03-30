// ============================================
// BazaarOS — Settings Module
// ============================================

const Settings = {
  async load() {
    // Load saved preferences
    const lowStockAlerts = localStorage.getItem('bazaar_lowstock_alerts') !== 'false';
    const salesReports = localStorage.getItem('bazaar_sales_reports') !== 'false';
    const customMode = localStorage.getItem('bazaar_custom_categories') === 'true';

    document.getElementById('setting-low-stock').checked = lowStockAlerts;
    document.getElementById('setting-sales-reports').checked = salesReports;
    document.getElementById('setting-custom-categories').checked = customMode;

    await Settings.fetchCategories();
    Settings.initEmojiPicker();
  },

  initEmojiPicker() {
    const picker = document.querySelector('emoji-picker');
    const btn = document.getElementById('emoji-picker-btn');
    if (!picker || !btn) return;

    picker.addEventListener('emoji-click', event => {
      btn.textContent = event.detail.unicode;
      document.getElementById('emoji-picker-popover').style.display = 'none';
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('emoji-picker-popover');
      if (popover && !popover.contains(e.target) && e.target !== btn) {
        popover.style.display = 'none';
      }
    });
  },

  toggleEmojiPicker() {
    const popover = document.getElementById('emoji-picker-popover');
    popover.style.display = popover.style.display === 'none' ? 'block' : 'none';
  },

  async fetchCategories() {
    if (!Auth.currentUser) return;
    try {
      const { data } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('user_id', Auth.currentUser.id)
        .order('name');
      
      Settings.renderCategories(data || []);
      
      // Keep POS and Inventory in sync if they are loaded
      if (typeof POS !== 'undefined') POS.customCategories = data || [];
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  },

  renderCategories(list) {
    const container = document.getElementById('category-manager-list');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">No custom categories added yet.</p>';
      return;
    }

    container.innerHTML = list.map(c => `
      <div class="setting-row" style="background:var(--bg-input); padding:10px 16px; border-radius:var(--radius-sm);">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:20px;">${c.emoji || '📦'}</span>
          <span style="font-weight:600;">${c.name}</span>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="Settings.deleteCategory('${c.id}')" style="color:var(--danger)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');
  },

  async addCategory() {
    const nameInput = document.getElementById('new-category-name');
    const emojiBtn = document.getElementById('emoji-picker-btn');
    const name = nameInput.value.trim();
    const emoji = emojiBtn.textContent.trim();

    if (!name) return;

    try {
      await supabaseClient.from('categories').insert({
        user_id: Auth.currentUser.id,
        name: name,
        emoji: emoji || '📦'
      });
      nameInput.value = '';
      emojiBtn.textContent = '📦';
      await Settings.fetchCategories();
      Toast.show('Category added', 'success');
      // Refresh inventory too
      if (typeof Inventory !== 'undefined') Inventory.fetchCategories();
    } catch (e) {
      Toast.show('Error adding category', 'error');
    }
  },

  async deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await supabaseClient.from('categories').delete().eq('id', id);
      await Settings.fetchCategories();
      Toast.show('Category deleted', 'success');
      if (typeof Inventory !== 'undefined') Inventory.fetchCategories();
    } catch (e) {
      Toast.show('Error deleting category', 'error');
    }
  },

  saveCategoryMode() {
    const val = document.getElementById('setting-custom-categories').checked;
    localStorage.setItem('bazaar_custom_categories', val);
    Toast.show('Category mode updated. Refreshing dropdowns...', 'info');
    if (typeof Inventory !== 'undefined') Inventory.fetchCategories();
  },

  saveNotifications() {
    localStorage.setItem('bazaar_lowstock_alerts', document.getElementById('setting-low-stock').checked);
    localStorage.setItem('bazaar_sales_reports', document.getElementById('setting-sales-reports').checked);
    Toast.show('Notification settings saved', 'success');
  },

  async exportInventory() {
    if (!Auth.currentUser) return;

    const { data } = await supabaseClient
      .from('products')
      .select('*')
      .eq('user_id', Auth.currentUser.id)
      .order('name');

    if (!data || data.length === 0) {
      Toast.show('No products to export', 'info');
      return;
    }

    let csv = 'Name,SKU,Category,Quantity,Price,Supplier\n';
    data.forEach(item => {
      csv += `"${item.name}","${item.sku || ''}","${item.category || ''}",${item.quantity},${item.price},"${item.supplier || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bazaaros-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    Toast.show('Inventory exported as CSV', 'success');
  },

  async backupData() {
    if (!Auth.currentUser) return;

    const [products, sales, profile] = await Promise.all([
      supabaseClient.from('products').select('*').eq('user_id', Auth.currentUser.id),
      supabaseClient.from('sales').select('*').eq('user_id', Auth.currentUser.id),
      supabaseClient.from('profiles').select('*').eq('id', Auth.currentUser.id).single()
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      products: products.data || [],
      sales: sales.data || [],
      profile: profile.data || {}
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bazaaros-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.URL.revokeObjectURL(url);

    Toast.show('Full backup downloaded', 'success');
  }
};

// ============================================
// Toast Notification System
// ============================================

const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check-circle'
      : type === 'error' ? 'fa-exclamation-circle'
      : 'fa-info-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};
