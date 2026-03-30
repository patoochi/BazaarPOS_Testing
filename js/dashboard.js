// ============================================
// BazaarOS — Dashboard Module
// ============================================

const Dashboard = {
  loaded: false,

  async load() {
    if (!Auth.currentUser) return;

    const userId = Auth.currentUser.id;

    // Fetch stats in parallel
    const [salesRes, lowStockRes, recentSalesRes] = await Promise.all([
      supabaseClient.from('sales').select('total, total_profit').eq('user_id', userId),
      supabaseClient.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId).lte('quantity', 5),
      supabaseClient.from('sales').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(8)
    ]);

    // Total sales count & revenue & profit
    const salesData = salesRes.data || [];
    const totalRevenue = salesData.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const totalProfit = salesData.reduce((sum, s) => sum + (parseFloat(s.total_profit) || 0), 0);
    
    document.getElementById('stat-revenue').textContent = '₱' + totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('stat-profit').textContent = '₱' + totalProfit.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('stat-sales').textContent = salesData.length;

    // Low stock
    const lowStock = lowStockRes.count || 0;
    document.getElementById('stat-lowstock').textContent = lowStock;

    // Recent sales
    Dashboard.renderRecentSales(recentSalesRes.data || []);

    this.loaded = true;
  },

  renderRecentSales(sales) {
    const container = document.getElementById('recent-sales-list');

    if (sales.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <i class="fas fa-receipt"></i>
          <p>No sales yet.<br>Start selling from the POS!</p>
        </div>`;
      return;
    }

    container.innerHTML = sales.map(sale => {
      const items = sale.items || [];
      const itemNames = items.map(i => i.name).join(', ');
      const timeAgo = Dashboard.timeAgo(new Date(sale.created_at));
      return `
        <div class="recent-sale-item">
          <div class="sale-info">
            <h4>${Dashboard.escapeHtml(itemNames) || 'Sale'}</h4>
            <span>${items.length} item(s) · ${timeAgo}</span>
          </div>
          <div class="sale-amount">₱${parseFloat(sale.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        </div>`;
    }).join('');
  },

  timeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
