// ========================================
// MediTrack - Theme Toggle
// theme-toggle.js
// ========================================

const ThemeManager = {
  icons: {
    moon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"/>
      </svg>
    `,
    sun: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2" x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="5" y2="12"/>
        <line x1="19" y1="12" x2="22" y2="12"/>
        <line x1="4.2" y1="4.2" x2="6.4" y2="6.4"/>
        <line x1="17.6" y1="17.6" x2="19.8" y2="19.8"/>
        <line x1="17.6" y1="6.4" x2="19.8" y2="4.2"/>
        <line x1="4.2" y1="19.8" x2="6.4" y2="17.6"/>
      </svg>
    `,
  },

  init() {
    const saved = DB.getTheme();
    this.apply(saved);
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    DB.setTheme(theme);
    // Update all toggles on page
    document.querySelectorAll('[data-theme-toggle]').forEach(el => {
      el.checked = theme === 'dark';
    });

    // Update single theme button (moon in light, sun in dark)
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? this.icons.sun : this.icons.moon;
      btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      btn.setAttribute('aria-label', btn.title);
    }
  },

  toggle() {
    const current = DB.getTheme();
    this.apply(current === 'dark' ? 'light' : 'dark');
  },

  isDark() { return DB.getTheme() === 'dark'; },
};

window.ThemeManager = ThemeManager;
