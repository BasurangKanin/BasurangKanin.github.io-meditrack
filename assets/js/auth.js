// ========================================
// MediTrack - Auth Logic
// auth.js
// ========================================

const Auth = {
  init() {
    this.bindTabs();
    this.bindForms();

    // Check if already logged in
    if (DB.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  },

  bindTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.querySelectorAll('.auth-form').forEach(f => {
          f.style.display = f.id === target ? 'block' : 'none';
        });
      });
    });
  },

  bindForms() {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');

    if (signupForm) {
      signupForm.addEventListener('submit', e => {
        e.preventDefault();
        this.handleSignup();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', e => {
        e.preventDefault();
        this.handleLogin();
      });
    }
  },

  handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!name || !email || !password) {
      this.showError('signup-error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      this.showError('signup-error', 'Password must be at least 6 characters.');
      return;
    }

    const btn = document.getElementById('signup-btn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    setTimeout(() => {
      const result = DB.signup(name, email, password);
      if (result.error) {
        this.showError('signup-error', result.error);
        btn.innerHTML = 'Create Account';
        btn.disabled = false;
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 600);
  },

  handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showError('login-error', 'Please fill in all fields.');
      return;
    }

    const btn = document.getElementById('login-btn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    setTimeout(() => {
      const result = DB.login(email, password);
      if (result.error) {
        this.showError('login-error', result.error);
        btn.innerHTML = 'Sign In';
        btn.disabled = false;
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 500);
  },

  showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  },
};

window.Auth = Auth;
