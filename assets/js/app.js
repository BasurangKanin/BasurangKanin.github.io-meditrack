// ========================================
// MediTrack - App Entry Point
// app.js
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme first (before render)
  ThemeManager.init();

  // Init page-specific logic
  const page = document.body.dataset.page;

  if (page === 'landing') {
    Auth.init();
  } else if (page === 'dashboard') {
    Dashboard.init();
    Notifications.init();
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/meditrack/sw.js').catch(() => {});
  }
});
