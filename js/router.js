// ============================================
// BazaarOS — SPA Router
// ============================================

const Router = {
  currentPage: null,

  pages: {
    dashboard: { title: 'Dashboard', icon: 'fas fa-chart-pie', load: () => Dashboard.load() },
    inventory: { title: 'Inventory', icon: 'fas fa-boxes-stacked', load: () => Inventory.load() },
    pos:       { title: 'Point of Sale', icon: 'fas fa-cash-register', load: () => POS.load() },
    profile:   { title: 'Store Profile', icon: 'fas fa-store', load: () => Profile.load() },
    settings:  { title: 'Settings', icon: 'fas fa-gear', load: () => Settings.load() }
  },

  init() {
    // Set up sidebar navigation clicks
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        Router.navigate(page);
        // Close mobile sidebar
        document.querySelector('.sidebar').classList.remove('mobile-open');
        document.querySelector('.sidebar-overlay').classList.remove('visible');
      });
    });

    // Handle hash changes
    window.addEventListener('hashchange', () => {
      const page = location.hash.slice(1) || 'dashboard';
      Router.navigate(page, false);
    });

    // Route to current hash or default
    const page = location.hash.slice(1) || 'dashboard';
    Router.navigate(page, false);
  },

  async navigate(page, pushHash = true) {
    if (!this.pages[page]) page = 'dashboard';
    if (this.currentPage === page) return;

    this.currentPage = page;

    if (pushHash) {
      location.hash = page;
    }

    // Update active nav
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-page') === page);
    });

    // Update page title
    document.getElementById('page-title').textContent = this.pages[page].title;

    // Show correct section
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const section = document.getElementById(`page-${page}`);
    if (section) {
      section.classList.add('active');
      // Re-trigger animation
      section.style.animation = 'none';
      section.offsetHeight; // trigger reflow
      section.style.animation = '';
    }

    // Call page load function (awaits for async loads like Dashboard)
    if (this.pages[page].load) {
      await this.pages[page].load();
    }
  }
};

// Mobile sidebar toggle
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('mobile-open');
  document.querySelector('.sidebar-overlay').classList.toggle('visible');
}
