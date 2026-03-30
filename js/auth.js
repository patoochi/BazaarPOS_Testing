// ============================================
// BazaarOS — Authentication Module
// ============================================

const Auth = {
  currentUser: null,
  initialized: false,

  // Initialize auth state listener
  init() {
    // Guard: make sure supabaseClient is loaded
    if (typeof supabaseClient === 'undefined' || !supabaseClient || !supabaseClient.auth) {
      console.error('supabaseClient not loaded! Check your internet connection.');
      const alertEl = document.getElementById('login-alert');
      if (alertEl) {
        alertEl.textContent = 'Failed to connect to server. Please check your internet and refresh.';
        alertEl.style.display = 'block';
      }
      return;
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (session && session.user) {
        Auth.currentUser = session.user;
        Auth.showApp();
        Auth.ensureProfile(session.user);
      } else if (Auth.initialized) {
        // Only redirect to login if we've already initialized
        Auth.currentUser = null;
        Auth.showAuth();
      }
    });

    // Check current session on load
    Auth.checkSession();
    Auth.initValidation();
  },

  async showFullLoader(message = 'Configuring Secure Session...', duration = 2500) {
    const loader = document.getElementById('page-loader');
    const text = document.getElementById('loader-text');
    if (!loader || !text) return;

    text.textContent = message;
    loader.style.display = 'flex';
    loader.style.opacity = '1';

    return new Promise(resolve => setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
        resolve();
      }, 500);
    }, duration));
  },

  async checkSession() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      Auth.initialized = true;
      if (session && session.user) {
        Auth.currentUser = session.user;
        Auth.showApp();
        Auth.ensureProfile(session.user);
      } else {
        Auth.showAuth();
      }
    } catch (err) {
      console.error('Session check failed:', err);
      Auth.initialized = true;
      Auth.showAuth();
    }
  },

  async ensureProfile(user) {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!data) {
        const meta = user.user_metadata || {};
        await supabaseClient.from('profiles').insert({
          id: user.id,
          store_name: meta.store_name || 'My Store',
          full_name: meta.full_name || '',
          email: user.email || '',
          phone: meta.phone || '',
          address: meta.address || '',
          business_hours: meta.business_hours || ''
        });
      }
    } catch (err) {
      console.error('Profile ensure error (non-blocking):', err);
    }
  },

  showAuth() {
    const authWrapper = document.getElementById('auth-wrapper');
    authWrapper.style.display = 'flex';
    authWrapper.classList.remove('fade-out');
    
    const appShell = document.getElementById('app-shell');
    appShell.style.display = 'none';
    appShell.classList.remove('visible');
    Auth.showLogin();
    
    // Reset login button state if it was loading
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
  },

  async showApp() {
    const appShell = document.getElementById('app-shell');
    const authWrapper = document.getElementById('auth-wrapper');
    const isFirstLoad = !appShell.classList.contains('visible');
    
    if (isFirstLoad) {
      if (!Router.currentPage) Router.init();
      
      // 1. Prepare data behind the scenes
      await Router.navigate('dashboard');
      
      // 2. Play the professional loader
      await Auth.showFullLoader('Establishing Secure Tunnel...', 1200);
      
      // 3. Begin the Ultra-Smooth Cross-Fade
      // We don't touch .style.display anymore—we just toggle opacity classes
      requestAnimationFrame(() => {
        authWrapper.classList.add('fade-out');
        appShell.classList.add('visible');
        
        // 4. Final layout cleanup AFTER the fade is finished
        setTimeout(() => {
          authWrapper.style.display = 'none';
        }, 800);
      });
    } else {
      authWrapper.style.display = 'none';
      appShell.style.display = 'block';
      appShell.classList.add('visible');
      Router.navigate('dashboard');
    }
  },

  showLogin() {
    document.getElementById('login-form-section').style.display = 'block';
    document.getElementById('register-form-section').style.display = 'none';
  },

  showRegister() {
    document.getElementById('login-form-section').style.display = 'none';
    document.getElementById('register-form-section').style.display = 'block';
  },

  async login(email, password) {
    const btn = document.getElementById('login-btn');
    const alertEl = document.getElementById('login-alert');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Authenticating...';
    alertEl.style.display = 'none';

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        alertEl.textContent = error.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : error.message;
        alertEl.style.display = 'block';
        return;
      }
      
      // Success: Show professional delay before diving in
      await Auth.showFullLoader('Authorizing Account Access...', 2500);
      Auth.showApp();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
      alertEl.textContent = 'Error: ' + (err.message || 'Connection error.');
      alertEl.style.display = 'block';
    }
  },

  async register(email, password, metadata) {
    const btn = document.getElementById('register-btn');
    const alertEl = document.getElementById('register-alert');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Establishing Cloud Node...';
    alertEl.style.display = 'none';

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-rocket"></i> Launch My Store';

      if (error) {
        if (error.message.includes('already registered')) {
          alertEl.textContent = 'This email is already registered. Please log in instead.';
        } else {
          alertEl.textContent = error.message;
        }
        alertEl.style.display = 'block';
        return;
      }

      // Success - Heavy launch sequence
      await Auth.showFullLoader('Initializing Global Commerce Ledger...', 4000);
      
      if (data.session) {
        Auth.currentUser = data.session.user;
        Auth.showApp();
        Auth.ensureProfile(data.session.user);
      } else if (data.user) {
        alertEl.textContent = 'Account created! Check your email to confirm, then log in.';
        alertEl.className = 'alert alert-success';
        alertEl.style.display = 'block';
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-rocket"></i> Launch My Store';
      alertEl.textContent = 'Error: ' + (err.message || 'Connection error.');
      alertEl.style.display = 'block';
    }
  },

  async logout() {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    }
    Auth.currentUser = null;
    
    // Reset path so next login starts fresh at dashboard
    location.hash = 'dashboard';
    if (Router.currentPage) Router.currentPage = null;
    
    // Clear login form
    const emailField = document.getElementById('login-email');
    const passField = document.getElementById('login-password');
    if (emailField) emailField.value = '';
    if (passField) passField.value = '';
    
    Auth.showAuth();
    Toast.show('Logged out successfully', 'info');
  },

  initValidation() {
    const regForm = document.getElementById('registerForm');
    if (!regForm) return;

    const fields = [
      { id: 'reg-store', min: 2, msg: 'Store name too short' },
      { id: 'reg-address', min: 10, msg: 'Please enter a full address' },
      { id: 'reg-fullname', min: 2, msg: 'Full name required' },
      { id: 'reg-phone', regex: /^\+?[\d\s-]{10,}$/, msg: 'Invalid phone format' },
      { id: 'reg-email', regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'Invalid email address' },
      { id: 'reg-password', min: 6, msg: 'Min. 6 characters required' },
      { id: 'reg-confirm', match: 'reg-password', msg: 'Passwords do not match' }
    ];

    fields.forEach(field => {
      const el = document.getElementById(field.id);
      if (!el) return;

      el.addEventListener('input', () => {
        const val = el.value.trim();
        let isValid = true;

        if (field.min && val.length < field.min) isValid = false;
        if (field.regex && !field.regex.test(val)) isValid = false;
        if (field.match) {
          const target = document.getElementById(field.match);
          if (val !== target.value) isValid = false;
        }

        const msgEl = el.nextElementSibling;
        if (msgEl && msgEl.classList.contains('validation-msg')) {
           if (val === '') {
             msgEl.innerHTML = '';
             el.style.borderColor = 'var(--border-color)';
           } else if (isValid) {
             msgEl.innerHTML = '<i class="fas fa-check-circle"></i> Valid';
             msgEl.className = 'validation-msg success';
             el.style.borderColor = 'var(--success)';
           } else {
             msgEl.innerHTML = '<i class="fas fa-times-circle"></i> ' + field.msg;
             msgEl.className = 'validation-msg error';
             el.style.borderColor = 'var(--danger)';
           }
        }
      });
    });
  }
};

// Form event listeners (set up once DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    Auth.login(email, password);
  });

  // Register form
  document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Final check
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    if (password !== confirm) return;

    const metadata = {
      store_name: document.getElementById('reg-store').value.trim(),
      full_name: document.getElementById('reg-fullname').value.trim(),
      address: document.getElementById('reg-address').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      business_hours: document.getElementById('reg-hours').value.trim()
    };

    const email = document.getElementById('reg-email').value.trim();
    Auth.register(email, password, metadata);
  });

  // Initialize auth
  Auth.init();
});
