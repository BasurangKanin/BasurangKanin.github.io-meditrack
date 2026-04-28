// ========================================
// MediTrack - Dashboard Logic
// dashboard.js
// ========================================

const Dashboard = {
  editingMedId: null,
  openMenu: null,
  weekdayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],

  init() {
    if (!DB.isLoggedIn()) {
      window.location.href = 'index.html';
      return;
    }

    this.renderHeader();
    this.renderProfileSwitcher();
    this.renderMedList();
    this.bindTopBar();

    // Close menus on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.med-menu-btn') && !e.target.closest('.ctx-menu')) {
        this.closeOpenMenu();
      }
    });
  },

  renderHeader() {
    const user = DB.getUser();
    const profile = DB.getActiveProfile();
    const now = new Date();
    const dateEl = document.getElementById('dash-date');
    const greetEl = document.getElementById('dash-greeting');

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
    if (greetEl) {
      const hour = now.getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      greetEl.textContent = `${greeting}, ${profile ? profile.name : user.name}.`;
    }
  },

  renderProfileSwitcher() {
    const profiles = DB.getProfiles();
    const activeId = DB.getActiveProfileId();
    const select = document.getElementById('profile-select');
    const avatar = document.getElementById('profile-avatar');

    if (!select) return;

    select.innerHTML = profiles.map(p =>
      `<option value="${p.profile_id}" ${p.profile_id === activeId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const active = profiles.find(p => p.profile_id === activeId) || profiles[0];
    if (avatar && active) {
      avatar.style.background = active.avatar_color;
      avatar.textContent = active.name[0].toUpperCase();
    }

    select.addEventListener('change', () => {
      DB.setActiveProfileId(select.value);
      this.renderHeader();
      this.renderMedList();
      this.renderProfileSwitcher();
    });
  },

  renderMedList() {
    const profile = DB.getActiveProfile();
    const container = document.getElementById('med-list');
    const countBadge = document.getElementById('med-count');
    const progressSection = document.getElementById('progress-section');
    if (!container || !profile) return;

    const meds = DB.getMedsForProfile(profile.profile_id).filter(m => m.is_active);

    // Build flat list of {med, time} for today
    const entries = [];
    meds.forEach(med => {
      (med.times || ['08:00']).forEach(t => {
        entries.push({ med, time: t });
      });
    });

    // Sort by time
    entries.sort((a, b) => a.time.localeCompare(b.time));

    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const taken = entries.filter(e => DB.getTakenToday(e.med.med_id, e.time)).length;
    const total = entries.length;

    if (countBadge) countBadge.textContent = `${total} today`;

    // Progress
    if (progressSection && total > 0) {
      progressSection.style.display = '';
      const pct = Math.round((taken / total) * 100);
      document.getElementById('progress-fill').style.width = pct + '%';
      document.getElementById('progress-text').textContent = `${taken} of ${total} taken`;
    } else if (progressSection) {
      progressSection.style.display = 'none';
    }

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            ${this.icons.pill}
          </div>
          <h3>No medications yet</h3>
          <p>Add your medications and we’ll remind you when it’s time to take them.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = entries.map(({ med, time }) => {
      const isTaken = DB.getTakenToday(med.med_id, time);
      const isDue = !isTaken && time <= nowHHMM;
      const formLabel = this.formatForm(med.form);
      const timeLabel = this.formatTime(time);

      return `
        <div class="med-card${isTaken ? ' taken' : isDue ? ' due' : ''}" data-med-id="${med.med_id}" data-time="${time}">
          <div class="med-icon${isTaken ? ' taken-icon' : isDue ? ' due-icon' : ''}">
            ${isTaken ? this.icons.check : isDue ? this.icons.alert : this.icons.pill}
          </div>
          <div class="med-info">
            <div class="med-name">${this.escape(med.name)}</div>
            <div class="med-meta">
              <span>${this.escape(med.dosage)}</span>
              <span style="color:var(--border)">·</span>
              <span>${formLabel}</span>
              ${med.instructions ? `<span style="color:var(--border)">·</span><span>${this.escape(med.instructions)}</span>` : ''}
            </div>
            <div class="med-time">
              ${this.icons.clock}
              ${timeLabel}
              ${isDue && !isTaken ? '<span class="due-badge">' + this.icons.alertSm + ' Due</span>' : ''}
            </div>
          </div>
          <div class="med-actions">
            <button class="check-btn${isTaken ? ' checked' : ''}" 
              onclick="Dashboard.toggleDose('${med.med_id}','${time}')"
              title="${isTaken ? 'Mark as not taken' : 'Mark as taken'}">
              ${this.icons.checkmark}
            </button>
            <div style="position:relative">
              <button class="med-menu-btn" onclick="Dashboard.toggleMenu(event, '${med.med_id}', '${time}')">
                ${this.icons.dots}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleDose(med_id, time) {
    const isTaken = DB.getTakenToday(med_id, time);
    if (isTaken) {
      DB.undoDose(med_id, time);
      this.showToast('Marked as not taken');
    } else {
      DB.logDose(med_id, time, 'taken');
      this.showToast('✓ Taken!');
    }
    this.renderMedList();
  },

  toggleMenu(e, med_id, time) {
    e.stopPropagation();
    this.closeOpenMenu();

    const btn = e.currentTarget;
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.innerHTML = `
      <button class="ctx-menu-item" onclick="Dashboard.openEditModal('${med_id}')">
        ${this.icons.edit} Edit
      </button>
      <button class="ctx-menu-item danger" onclick="Dashboard.deleteMed('${med_id}')">
        ${this.icons.trash} Delete Medication
      </button>
    `;
    btn.parentElement.appendChild(menu);
    this.openMenu = menu;
  },

  closeOpenMenu() {
    if (this.openMenu) {
      this.openMenu.remove();
      this.openMenu = null;
    }
  },

  deleteMed(med_id) {
    this.closeOpenMenu();
    if (confirm('Delete this medication?')) {
      DB.deleteMedication(med_id);
      this.renderMedList();
      this.showToast('Medication deleted');
    }
  },

  openAddModal() {
    this.editingMedId = null;
    document.getElementById('modal-title').textContent = 'Add Medication';
    // Reset fields manually to avoid ID conflict with med-form select
    document.getElementById('med-name').value = '';
    document.getElementById('med-dosage').value = '';
    document.getElementById('med-form-select').value = 'tablet';
    document.getElementById('med-instructions').value = '';
    document.getElementById('med-frequency').value = 'daily';
    if (document.getElementById('med-weekly-day')) {
      document.getElementById('med-weekly-day').value = String(new Date().getDay());
    }
    this.syncWeeklyDayUI();
    this.clearTimes();
    this.addTimeChip('08:00');
    this.openModal('med-modal');
  },

  openEditModal(med_id) {
    this.closeOpenMenu();
    const med = DB.getMedications().find(m => m.med_id === med_id);
    if (!med) return;
    this.editingMedId = med_id;
    document.getElementById('modal-title').textContent = 'Edit Medication';
    document.getElementById('med-name').value = med.name;
    document.getElementById('med-dosage').value = med.dosage;
    document.getElementById('med-form-select').value = med.form;
    document.getElementById('med-instructions').value = med.instructions || '';
    document.getElementById('med-frequency').value = med.frequency || 'daily';
    if (document.getElementById('med-weekly-day')) {
      const fallbackDow = med.start_date ? new Date(med.start_date).getDay() : new Date().getDay();
      document.getElementById('med-weekly-day').value = String((med.weekly_day === 0 || med.weekly_day) ? med.weekly_day : fallbackDow);
    }
    this.syncWeeklyDayUI();
    this.clearTimes();
    (med.times || ['08:00']).forEach(t => this.addTimeChip(t));
    this.openModal('med-modal');
  },

  syncWeeklyDayUI() {
    const freq = document.getElementById('med-frequency')?.value;
    const group = document.getElementById('weekly-day-group');
    if (!group) return;
    group.style.display = freq === 'weekly' ? '' : 'none';
  },

  clearTimes() {
    const grid = document.getElementById('times-grid');
    if (grid) grid.innerHTML = '';
  },

  addTimeChip(time) {
    const grid = document.getElementById('times-grid');
    if (!grid) return;
    const chip = document.createElement('div');
    chip.className = 'time-chip';
    chip.dataset.time = time;
    chip.innerHTML = `
      <span>${this.formatTime(time)}</span>
      <button type="button" class="time-chip-remove" onclick="this.parentElement.remove()">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
          <line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>
        </svg>
      </button>
    `;
    grid.appendChild(chip);
  },

  saveMedication() {
    const name = document.getElementById('med-name').value.trim();
    const dosage = document.getElementById('med-dosage').value.trim();
    const form = document.getElementById('med-form-select').value;
    const instructions = document.getElementById('med-instructions').value.trim();
    const frequency = document.getElementById('med-frequency').value;
    const weeklyDayEl = document.getElementById('med-weekly-day');
    const weekly_day = (frequency === 'weekly' && weeklyDayEl) ? Number(weeklyDayEl.value) : null;

    if (!name || !dosage) {
      this.showToast('Name and dosage are required');
      return;
    }

    const timeChips = document.querySelectorAll('#times-grid .time-chip');
    const times = [...timeChips].map(c => c.dataset.time);
    if (times.length === 0) {
      this.showToast('Add at least one time');
      return;
    }

    if (this.editingMedId) {
      DB.updateMedication(this.editingMedId, { name, dosage, form, instructions, times, frequency, weekly_day });
      this.showToast('Medication updated');
    } else {
      DB.addMedication({ name, dosage, form, instructions, times, frequency, weekly_day });
      this.showToast('Medication added');
    }

    this.closeModal('med-modal');
    this.renderMedList();
  },

  // ---- Schedule Modal ----
  openSchedule() {
    this.renderSchedule();
    this.openModal('schedule-modal');
  },

  renderSchedule() {
    const container = document.getElementById('schedule-content');
    if (!container) return;
    const profile = DB.getActiveProfile();
    const meds = DB.getMedsForProfile(profile.profile_id).filter(m => m.is_active);
    const today = new Date();

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }

    if (meds.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding:24px 0;">No medications scheduled.</p>';
      return;
    }

    container.innerHTML = days.map(day => {
      const isToday = day.toDateString() === today.toDateString();
      const label = isToday ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

      const entries = [];
      meds.forEach(med => {
        // Weekly meds should only appear once per week in overview.
        // Use weekly_day when set; otherwise derive from start_date (fallback: created_at).
        if ((med.frequency || 'daily') === 'weekly') {
          const ref = med.start_date ? new Date(med.start_date) : (med.created_at ? new Date(med.created_at) : null);
          const derivedDow = ref ? ref.getDay() : today.getDay();
          const scheduledDow = (med.weekly_day === 0 || med.weekly_day) ? Number(med.weekly_day) : derivedDow;
          if (day.getDay() !== scheduledDow) return;
        }
        (med.times || []).forEach(t => entries.push({ med, time: t }));
      });
      entries.sort((a, b) => a.time.localeCompare(b.time));

      const rows = entries.map(({ med, time }) => `
        <div class="schedule-entry">
          <div class="schedule-time">${this.formatTime(time)}</div>
          <div class="schedule-med-name">${this.escape(med.name)}</div>
          <div class="schedule-dosage">${this.escape(med.dosage)}</div>
        </div>
      `).join('');

      return `
        <div class="schedule-day">
          <div class="schedule-day-label${isToday ? ' today' : ''}">${label}</div>
          ${rows}
        </div>
      `;
    }).join('');
  },

  // ---- Settings Modal ----
  openSettings() {
    this.renderSettings();
    this.openModal('settings-modal');
  },

  renderSettings() {
    const user = DB.getUser();
    const isPremium = user.subscription_status === 'premium';
    const profiles = DB.getProfiles();
    const additionalCount = profiles.filter(p => !p.is_main_profile).length;

    // Subscription card
    const subCard = document.getElementById('subscription-card');
    if (subCard) {
      subCard.className = `subscription-card${isPremium ? ' premium' : ''}`;
      subCard.innerHTML = isPremium ? `
        <div class="subscription-tier">Current Plan</div>
        <div class="subscription-name">⭐ Premium</div>
        <div class="subscription-desc">Unlimited additional profiles and all features.</div>
        <div class="subscription-price">$2<span>/month</span></div>
      ` : `
        <div class="subscription-tier">Current Plan</div>
        <div class="subscription-name">Free</div>
        <div class="subscription-desc">1 main profile + 1 additional profile. Unlimited medications.</div>
        <div class="subscription-price">Free</div>
        <button class="upgrade-btn" onclick="Dashboard.openUpgradeModal()">
          ⭐ Upgrade to Premium — $2/mo
        </button>
      `;
    }

    // Profile list
    const profileList = document.getElementById('settings-profiles');
    if (profileList) {
      profileList.innerHTML = profiles.map(p => `
        <div class="profile-card">
          <div class="profile-avatar" style="background:${p.avatar_color}">${p.name[0].toUpperCase()}</div>
          <div>
            <div class="profile-card-name">${this.escape(p.name)}</div>
            ${p.is_main_profile ? '<div style="font-size:0.75rem;color:var(--primary);font-weight:600;margin-top:2px;">Main Account Profile</div>' : ''}
          </div>
          <div class="profile-card-actions">
            <button class="btn btn-sm btn-secondary" onclick="Dashboard.editProfile('${p.profile_id}')">Edit</button>
            ${!p.is_main_profile ? `<button class="btn btn-sm btn-danger" onclick="Dashboard.deleteProfile('${p.profile_id}')">Delete</button>` : ''}
          </div>
        </div>
      `).join('');

      // Free: can add 1 additional; Premium: unlimited
      const canAdd = isPremium || additionalCount < 1;
      profileList.innerHTML += `
        <button class="btn btn-secondary mt-8" onclick="Dashboard.addProfile()" ${canAdd ? '' : 'disabled style="opacity:0.5;cursor:not-allowed"'}>
          ${this.icons.plus} Add Profile ${canAdd ? '' : '(Upgrade to Premium)'}
        </button>
      `;
    }

    // Theme toggle
    const themeToggle = document.querySelector('[data-theme-toggle]');
    if (themeToggle) themeToggle.checked = ThemeManager.isDark();
  },

  addProfile() {
    const name = prompt('Profile name:');
    if (!name || !name.trim()) return;
    const result = DB.createProfile(name.trim());
    if (result.error) {
      alert(result.error);
    } else {
      this.renderSettings();
      this.renderProfileSwitcher();
      this.showToast('Profile created');
    }
  },

  editProfile(profile_id) {
    const profile = DB.getProfiles().find(p => p.profile_id === profile_id);
    if (!profile) return;
    const name = prompt('New name:', profile.name);
    if (!name || !name.trim()) return;
    DB.updateProfile(profile_id, { name: name.trim() });
    this.renderSettings();
    this.renderProfileSwitcher();
    this.renderHeader();
    this.showToast('Profile updated');
  },

  deleteProfile(profile_id) {
    if (!confirm('Delete this profile and all its medications?')) return;
    const result = DB.deleteProfile(profile_id);
    if (result.error) { alert(result.error); return; }
    this.renderSettings();
    this.renderProfileSwitcher();
    this.renderHeader();
    this.renderMedList();
    this.showToast('Profile deleted');
  },

  // ---- Upgrade / Payment ----
  openUpgradeModal() {
    this.closeModal('settings-modal');
    this.openModal('upgrade-modal');
  },

  processPayment() {
    const btn = document.getElementById('pay-btn');
    btn.innerHTML = '<span class="spinner"></span> Processing...';
    btn.disabled = true;

    // Mock payment
    setTimeout(() => {
      DB.updateSubscription('premium');
      this.closeModal('upgrade-modal');
      this.showToast('🎉 Welcome to Premium!');
      setTimeout(() => this.openSettings(), 400);
      setTimeout(() => this.openModal('settings-modal'), 400);
    }, 1800);
  },

  // ---- Modal helpers ----
  openModal(id) {
    document.getElementById(id + '-overlay').classList.add('open');
  },

  closeModal(id) {
    document.getElementById(id + '-overlay').classList.remove('open');
  },

  bindTopBar() {
    document.getElementById('btn-schedule')?.addEventListener('click', () => this.openSchedule());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettings());

    // Med save
    document.getElementById('btn-save-med')?.addEventListener('click', () => this.saveMedication());

    // Time adding
    document.getElementById('btn-add-time')?.addEventListener('click', () => {
      const input = document.getElementById('time-input');
      if (input.value) { this.addTimeChip(input.value); input.value = ''; }
    });

    // Weekly day visibility
    document.getElementById('med-frequency')?.addEventListener('change', () => this.syncWeeklyDayUI());

    // Theme toggle is handled inline via onchange="ThemeManager.toggle()"
    // (Adding another listener here causes a double-toggle and cancels out.)
  },

  // ---- Utilities ----
  formatTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
  },

  formatForm(form) {
    const map = { tablet: '💊 Tablet', capsule: '💊 Capsule', liquid: '🧪 Liquid', injection: '💉 Injection', patch: '🩹 Patch', drops: '💧 Drops', inhaler: '💨 Inhaler', other: '📦 Other' };
    return map[form] || form;
  },

  escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  },

  // ---- SVG Icons ----
  icons: {
    pill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    checkmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    dots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    alertSm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
};

window.Dashboard = Dashboard;
