// ========================================
// MediTrack - Notifications
// notifications.js
// ========================================

const Notifications = {
  permission: 'default',
  checkIntervalId: null,

  async init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      if (this.permission === 'default') {
        // Request gracefully - don't force on load
      }
    }
    this.startChecking();
  },

  async requestPermission() {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    this.permission = result;
    return result === 'granted';
  },

  showBanner(text, type = 'info') {
    const container = document.getElementById('notif-banner');
    if (!container) return;

    const item = document.createElement('div');
    item.className = `notif-item${type === 'warning' ? ' warning' : ''}`;
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span class="notif-text">${text}</span>
      <button class="notif-dismiss" onclick="this.parentElement.remove()">Dismiss</button>
    `;
    container.appendChild(item);

    // Auto-dismiss after 8s
    setTimeout(() => item.remove(), 8000);
  },

  showNative(title, body, tag) {
    if (this.permission === 'granted') {
      const n = new Notification(title, { body, tag, icon: '/assets/images/icon-192.png' });
      n.onclick = () => window.focus();
    }
  },

  vibrate(pattern = [200, 100, 200]) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  },

  startChecking() {
    // Check every minute for due medications
    this.checkIntervalId = setInterval(() => this.checkDueMeds(), 60000);
    // Also check now
    setTimeout(() => this.checkDueMeds(), 2000);
  },

  checkDueMeds() {
    if (!DB.isLoggedIn()) return;
    const profile = DB.getActiveProfile();
    if (!profile) return;
    const meds = DB.getMedsForProfile(profile.profile_id);
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    meds.forEach(med => {
      if (!med.is_active) return;
      (med.times || []).forEach(t => {
        if (t === hhmm && !DB.getTakenToday(med.med_id, t)) {
          this.showBanner(`Time to take ${med.name} — ${med.dosage}`, 'warning');
          this.showNative('MediTrack Reminder', `Time to take ${med.name} (${med.dosage})`, med.med_id + t);
          this.vibrate();
          // Re-render dashboard if visible
          if (window.Dashboard) Dashboard.renderMedList();
        }
      });
    });
  },
};

window.Notifications = Notifications;
