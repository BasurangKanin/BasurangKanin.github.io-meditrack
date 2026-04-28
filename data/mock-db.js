// ========================================
// MediTrack - Local Storage Data Controller
// mock-db.js
// ========================================

const DB = {
  // ---- Keys ----
  KEYS: {
    USER: 'mt_user',
    PROFILES: 'mt_profiles',
    ACTIVE_PROFILE: 'mt_active_profile',
    MEDICATIONS: 'mt_medications',
    LOGS: 'mt_logs',
    THEME: 'mt_theme',
    NOTIF_PERMISSION: 'mt_notif',
  },

  // ---- Helpers ----
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch { return null; }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // ---- User ----
  getUser() { return this.get(this.KEYS.USER); },
  setUser(user) { this.set(this.KEYS.USER, user); },
  isLoggedIn() { return !!this.getUser(); },

  signup(name, email, password) {
    // Enforce one account per email
    const existing = this.get(this.KEYS.USER);
    if (existing && existing.email === email) {
      return { error: 'An account with this email already exists. Please sign in.' };
    }
    if (existing) return { error: 'An account already exists on this device. Please sign in.' };

    const user = {
      user_id: this.uuid(),
      name,
      email,
      password_hash: btoa(password),
      subscription_status: 'free',
      created_at: new Date().toISOString(),
    };
    this.setUser(user);

    // The account itself IS the main profile (is_main_profile: true)
    const profile = this._createMainProfile(name, user.user_id);
    this.set(this.KEYS.ACTIVE_PROFILE, profile.profile_id);
    return { user, profile };
  },

  login(email, password) {
    const user = this.getUser();
    if (!user) return { error: 'No account found. Please sign up.' };
    if (user.email !== email) return { error: 'Incorrect email.' };
    if (user.password_hash !== btoa(password)) return { error: 'Incorrect password.' };
    return { user };
  },

  logout() {
    localStorage.removeItem(this.KEYS.USER);
    localStorage.removeItem(this.KEYS.ACTIVE_PROFILE);
  },

  updateSubscription(status) {
    const user = this.getUser();
    if (!user) return;
    user.subscription_status = status;
    this.setUser(user);
  },

  // ---- Profiles ----
  getProfiles() { return this.get(this.KEYS.PROFILES) || []; },
  setProfiles(profiles) { this.set(this.KEYS.PROFILES, profiles); },

  getActiveProfileId() { return this.get(this.KEYS.ACTIVE_PROFILE); },
  setActiveProfileId(id) { this.set(this.KEYS.ACTIVE_PROFILE, id); },

  getActiveProfile() {
    const id = this.getActiveProfileId();
    return this.getProfiles().find(p => p.profile_id === id) || this.getProfiles()[0];
  },

  AVATAR_COLORS: ['#2D6A4F', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#DB2777', '#059669'],

  // Internal: create the main account profile (called only during signup)
  _createMainProfile(name, user_id) {
    const color = this.AVATAR_COLORS[0];
    const profile = {
      profile_id: this.uuid(),
      user_id,
      name,
      avatar_color: color,
      is_main_profile: true,
      created_at: new Date().toISOString(),
    };
    this.setProfiles([profile]);
    return profile;
  },

  // Create an additional (sub) profile
  createProfile(name) {
    const user = this.getUser();
    if (!user) return { error: 'Not logged in.' };
    const profiles = this.getProfiles();

    // Count only additional (non-main) profiles
    const additionalCount = profiles.filter(p => !p.is_main_profile).length;
    const isFree = user.subscription_status === 'free';

    // Free: 1 additional profile max (2 total including main)
    if (isFree && additionalCount >= 1) {
      return { error: 'Free plan allows 1 additional profile. Upgrade to Premium for unlimited profiles.' };
    }

    const color = this.AVATAR_COLORS[profiles.length % this.AVATAR_COLORS.length];
    const profile = {
      profile_id: this.uuid(),
      user_id: user.user_id,
      name,
      avatar_color: color,
      is_main_profile: false,
      created_at: new Date().toISOString(),
    };
    profiles.push(profile);
    this.setProfiles(profiles);
    return profile;
  },

  updateProfile(profile_id, updates) {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.profile_id === profile_id);
    if (idx === -1) return { error: 'Profile not found.' };
    profiles[idx] = { ...profiles[idx], ...updates };
    this.setProfiles(profiles);
    return profiles[idx];
  },

  deleteProfile(profile_id) {
    const profiles = this.getProfiles();
    const target = profiles.find(p => p.profile_id === profile_id);
    if (!target) return { error: 'Profile not found.' };
    if (target.is_main_profile) return { error: 'Your main account profile cannot be deleted.' };
    if (profiles.length <= 1) return { error: 'Cannot delete the only profile.' };
    const newProfiles = profiles.filter(p => p.profile_id !== profile_id);
    this.setProfiles(newProfiles);
    const meds = this.getMedications().filter(m => m.profile_id !== profile_id);
    this.set(this.KEYS.MEDICATIONS, meds);
    if (this.getActiveProfileId() === profile_id) {
      this.setActiveProfileId(newProfiles[0].profile_id);
    }
    return { success: true };
  },

  // ---- Medications ----
  getMedications() { return this.get(this.KEYS.MEDICATIONS) || []; },
  setMedications(meds) { this.set(this.KEYS.MEDICATIONS, meds); },

  getMedsForProfile(profile_id) {
    return this.getMedications().filter(m => m.profile_id === profile_id);
  },

  addMedication({ name, dosage, form, instructions, times, frequency, weekly_day, start_date, end_date }) {
    const profile = this.getActiveProfile();
    if (!profile) return { error: 'No active profile.' };
    const normalizedStart = start_date || new Date().toISOString().split('T')[0];
    const derivedWeeklyDay = new Date(normalizedStart).getDay();
    const med = {
      med_id: this.uuid(),
      profile_id: profile.profile_id,
      name,
      dosage,
      form: form || 'tablet',
      instructions: instructions || '',
      times: times || ['08:00'],
      frequency: frequency || 'daily',
      weekly_day: (weekly_day === 0 || weekly_day) ? Number(weekly_day) : ((frequency || 'daily') === 'weekly' ? derivedWeeklyDay : null),
      start_date: normalizedStart,
      end_date: end_date || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const meds = this.getMedications();
    meds.push(med);
    this.setMedications(meds);
    return med;
  },

  updateMedication(med_id, updates) {
    const meds = this.getMedications();
    const idx = meds.findIndex(m => m.med_id === med_id);
    if (idx === -1) return { error: 'Medication not found.' };
    meds[idx] = { ...meds[idx], ...updates };
    this.setMedications(meds);
    return meds[idx];
  },

  deleteMedication(med_id) {
    const meds = this.getMedications().filter(m => m.med_id !== med_id);
    this.setMedications(meds);
    return { success: true };
  },

  // ---- Logs ----
  getLogs() { return this.get(this.KEYS.LOGS) || []; },
  setLogs(logs) { this.set(this.KEYS.LOGS, logs); },

  getTodayKey() {
    return new Date().toISOString().split('T')[0];
  },

  logDose(med_id, scheduled_time, status = 'taken') {
    const logs = this.getLogs();
    const today = this.getTodayKey();
    // Remove old log for same med+time+date if exists
    const filtered = logs.filter(l => !(l.med_id === med_id && l.date === today && l.scheduled_time === scheduled_time));
    filtered.push({
      log_id: this.uuid(),
      med_id,
      date: today,
      scheduled_time,
      actual_time: new Date().toISOString(),
      status,
    });
    this.setLogs(filtered);
  },

  getTakenToday(med_id, time) {
    const today = this.getTodayKey();
    const logs = this.getLogs();
    return logs.some(l => l.med_id === med_id && l.date === today && l.scheduled_time === time && l.status === 'taken');
  },

  undoDose(med_id, time) {
    const today = this.getTodayKey();
    const logs = this.getLogs().filter(l => !(l.med_id === med_id && l.date === today && l.scheduled_time === time));
    this.setLogs(logs);
  },

  // ---- Theme ----
  getTheme() { return this.get(this.KEYS.THEME) || 'light'; },
  setTheme(theme) { this.set(this.KEYS.THEME, theme); },
};

window.DB = DB;
