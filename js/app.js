/* ============== EaseTrack — Main app ============== */

(function () {
  // ---------- Field config: which selectors map to which fields ----------
  // Each field stores a single value except `triggers`, which is multi-select.
  const SINGLE_FIELDS = [
    'hotFlashes', 'nightSweats', 'sleepQuality',
    'mood', 'energy', 'brainFog'
  ];

  // ---------- State ----------
  let editingDate = null; // null = today; YYYY-MM-DD when editing a past entry.
  let currentRange = 7;

  // Onboarding state: mode 'first-time' (full 4 screens) or 'edit' (screens 2–4).
  const STAGE_LABELS = {
    perimenopause: 'Perimenopause',
    menopause: 'Menopause',
    postmenopause: 'Postmenopause',
    not_sure: 'Not sure'
  };
  let onboarding = {
    mode: null,
    step: 1,
    data: { name: '', age: null, stage: null }
  };

  // ---------- Date helpers ----------
  function formatLongDate(dateKey) {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function formatShortDate(dateKey) {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  }

  // ---------- Form read / write ----------
  // Reset all on-screen selections to unselected.
  function clearForm() {
    document.querySelectorAll('#screen-today [role="radio"]').forEach(b => {
      b.setAttribute('aria-checked', 'false');
      b.classList.remove('star--filled', 'bar-step--filled');
    });
    document.querySelectorAll('#screen-today [aria-pressed]').forEach(b => {
      b.setAttribute('aria-pressed', 'false');
    });
    document.getElementById('notes-input').value = '';
  }

  // Apply an existing entry to the form controls.
  function populateForm(entry) {
    clearForm();
    if (!entry) return;
    SINGLE_FIELDS.forEach(field => {
      const value = entry[field];
      if (value == null) return;
      const group = document.querySelector(`[data-field="${field}"]`);
      if (!group) return;
      const btn = group.querySelector(`[data-value="${value}"]`);
      if (btn) selectInGroup(group, btn);
    });
    if (Array.isArray(entry.triggers)) {
      const trGroup = document.querySelector('[data-field="triggers"]');
      entry.triggers.forEach(t => {
        const btn = trGroup.querySelector(`[data-value="${t}"]`);
        if (btn) btn.setAttribute('aria-pressed', 'true');
      });
    }
    document.getElementById('notes-input').value = entry.notes || '';
  }

  // Read the current form into an entry object. Only writes defined values.
  function readForm() {
    const entry = {};
    SINGLE_FIELDS.forEach(field => {
      const group = document.querySelector(`[data-field="${field}"]`);
      const chosen = group.querySelector('[aria-checked="true"]');
      if (chosen) {
        const v = chosen.dataset.value;
        entry[field] = field === 'sleepQuality' || field === 'energy' ? parseInt(v, 10) : v;
      }
    });
    const triggers = Array.from(
      document.querySelectorAll('[data-field="triggers"] [aria-pressed="true"]')
    ).map(b => b.dataset.value);
    if (triggers.length) entry.triggers = triggers;
    const notes = document.getElementById('notes-input').value.trim();
    if (notes) entry.notes = notes;
    return entry;
  }

  // Select a single option within a single-choice group, updating fill styles.
  function selectInGroup(group, btn) {
    group.querySelectorAll('[role="radio"]').forEach(b => {
      b.setAttribute('aria-checked', 'false');
      b.classList.remove('star--filled', 'bar-step--filled');
    });
    btn.setAttribute('aria-checked', 'true');

    // Cumulative fill for stars and bar steps (any item ≤ selected gets filled).
    const field = group.dataset.field;
    if (field === 'sleepQuality' || field === 'energy') {
      const v = parseInt(btn.dataset.value, 10);
      const cls = field === 'sleepQuality' ? 'star--filled' : 'bar-step--filled';
      group.querySelectorAll('[role="radio"]').forEach(b => {
        if (parseInt(b.dataset.value, 10) <= v) b.classList.add(cls);
      });
    }
  }

  // ---------- Today screen ----------
  function initTodayScreen() {
    // Single-select groups
    document.querySelectorAll('#screen-today [role="radiogroup"]').forEach(group => {
      group.querySelectorAll('[role="radio"]').forEach(btn => {
        btn.addEventListener('click', () => selectInGroup(group, btn));
      });
    });

    // Multi-select triggers
    document.querySelectorAll('[data-field="triggers"] [aria-pressed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', on ? 'false' : 'true');
      });
    });

    document.getElementById('save-btn').addEventListener('click', saveCheckin);
  }

  // Refresh the Today screen: date label, edit-banner if applicable, prefill form.
  function refreshToday() {
    const key = editingDate || EaseStorage.todayKey();
    const dateEl = document.getElementById('today-date');
    if (editingDate) {
      dateEl.textContent = `Editing ${formatLongDate(key)}`;
    } else {
      dateEl.textContent = formatLongDate(key);
    }
    const existing = EaseStorage.getEntry(key);
    populateForm(existing);
    const saveBtn = document.getElementById('save-btn');
    saveBtn.textContent = existing
      ? (editingDate ? 'Save changes' : 'Update today\'s check-in')
      : "Save today's check-in";
    document.getElementById('save-status').textContent = '';
  }

  function saveCheckin() {
    const key = editingDate || EaseStorage.todayKey();
    const entry = readForm();
    if (Object.keys(entry).length === 0) {
      flashStatus('Select at least one symptom to save.', true);
      return;
    }
    EaseStorage.setEntry(key, entry);
    flashStatus(editingDate ? 'Changes saved.' : 'Saved. Take care of yourself today.');
    editingDate = null;
    refreshToday();
  }

  function flashStatus(msg, isError) {
    const el = document.getElementById('save-status');
    el.textContent = msg;
    el.style.color = isError ? 'var(--danger)' : 'var(--sage-dark)';
    setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
  }

  // ---------- History screen ----------
  function refreshHistory() {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');
    const entries = EaseStorage.listEntriesSorted();
    list.innerHTML = '';
    if (entries.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    entries.forEach(([dateKey, entry]) => {
      const btn = document.createElement('button');
      btn.className = 'history-item';
      btn.setAttribute('aria-label', `View check-in for ${formatLongDate(dateKey)}`);
      btn.innerHTML = `
        <span class="history-item__date">${formatShortDate(dateKey)}</span>
        <span class="history-item__summary">${summaryPills(entry)}</span>
      `;
      btn.addEventListener('click', () => openDetail(dateKey, entry));
      list.appendChild(btn);
    });
  }

  // Compact summary chips for a history row.
  function summaryPills(entry) {
    const pills = [];
    if (entry.hotFlashes) pills.push(`🔥 ${entry.hotFlashes}`);
    if (entry.sleepQuality) pills.push(`💤 ${entry.sleepQuality}/5`);
    if (entry.mood) pills.push(`😊 ${entry.mood}`);
    if (entry.energy) pills.push(`⚡ ${entry.energy}/5`);
    if (entry.nightSweats && entry.nightSweats !== 'none') pills.push(`💧 ${entry.nightSweats}`);
    if (entry.brainFog && entry.brainFog !== 'none') pills.push(`☁︎ ${entry.brainFog}`);
    return pills.map(p => `<span class="history-item__pill">${p}</span>`).join('');
  }

  // ---------- Detail modal ----------
  function openDetail(dateKey, entry) {
    const labels = {
      hotFlashes: 'Hot flashes',
      nightSweats: 'Night sweats',
      sleepQuality: 'Sleep quality',
      mood: 'Mood',
      energy: 'Energy',
      brainFog: 'Brain fog'
    };
    const rows = [];
    Object.keys(labels).forEach(k => {
      if (entry[k] != null) {
        let val = entry[k];
        if (k === 'sleepQuality' || k === 'energy') val = `${val}/5`;
        rows.push(`<div><strong>${labels[k]}:</strong> ${val}</div>`);
      }
    });
    if (Array.isArray(entry.triggers) && entry.triggers.length) {
      rows.push(`<div><strong>Triggers:</strong> ${entry.triggers.join(', ')}</div>`);
    }
    if (entry.notes) rows.push(`<div><strong>Notes:</strong> ${escapeHtml(entry.notes)}</div>`);

    document.getElementById('detail-title').textContent = formatLongDate(dateKey);
    document.getElementById('detail-body').innerHTML = rows.join('') || '<em>No data</em>';
    const modal = document.getElementById('detail-modal');
    modal.hidden = false;

    document.getElementById('detail-edit').onclick = () => {
      modal.hidden = true;
      editingDate = dateKey;
      showScreen('today');
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  // ---------- Trends screen ----------
  function refreshTrends() {
    const entries = EaseStorage.getAllEntries();
    const count = Object.keys(entries).length;
    const empty = document.getElementById('trends-empty');
    const content = document.getElementById('trends-content');
    const insight = document.getElementById('insight-box');

    if (count === 0) {
      empty.hidden = false;
      content.style.display = 'none';
      insight.hidden = true;
      return;
    }
    empty.hidden = true;
    content.style.display = '';

    EaseCharts.renderTrends(currentRange);

    const insightText = EaseCharts.generateInsight();
    if (insightText && count >= 7) {
      insight.textContent = insightText;
      insight.hidden = false;
    } else {
      insight.hidden = true;
    }

    // Trigger correlations
    const corr = EaseCharts.triggerCorrelations();
    const body = document.getElementById('trigger-corr-body');
    const card = document.getElementById('trigger-correlations');
    if (corr.length === 0) {
      card.style.display = 'none';
    } else {
      card.style.display = '';
      body.innerHTML = corr.map(c => `
        <div class="trigger-corr__row">
          <span class="trigger-corr__label">${c.label}</span>
          <span class="trigger-corr__value">${c.withAvg.toFixed(1)} vs ${c.withoutAvg.toFixed(1)} hot flashes</span>
        </div>
      `).join('');
    }
  }

  function initTrendsScreen() {
    document.querySelectorAll('.range-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-chip').forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        currentRange = parseInt(btn.dataset.range, 10);
        refreshTrends();
      });
    });
  }

  // ---------- Settings screen ----------
  function initSettingsScreen() {
    const toggle = document.getElementById('reminder-toggle');
    const timeRow = document.getElementById('reminder-time-row');
    const timeInput = document.getElementById('reminder-time');

    const s = EaseStorage.getSettings();
    toggle.checked = s.remindersEnabled;
    timeInput.value = s.reminderTime || '20:00';
    timeRow.hidden = !s.remindersEnabled;

    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        const perm = await EaseReminders.requestPermission();
        if (perm !== 'granted') {
          toggle.checked = false;
          flashStatus('Notification permission was not granted.', true);
          return;
        }
        EaseStorage.updateSettings({ remindersEnabled: true, reminderTime: timeInput.value });
        timeRow.hidden = false;
        EaseReminders.apply();
      } else {
        EaseStorage.updateSettings({ remindersEnabled: false });
        timeRow.hidden = true;
        EaseReminders.apply();
      }
    });

    timeInput.addEventListener('change', () => {
      EaseStorage.updateSettings({ reminderTime: timeInput.value });
      EaseReminders.apply();
    });

    document.getElementById('export-btn').addEventListener('click', () => EaseStorage.exportJSON());

    document.getElementById('import-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = EaseStorage.importJSON(reader.result);
        if (result.ok) {
          flashStatus(result.message);
          refreshToday();
          refreshHistory();
          refreshTrends();
        } else {
          alert(result.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      const modal = document.getElementById('confirm-modal');
      modal.hidden = false;
      document.getElementById('confirm-cancel').onclick = () => { modal.hidden = true; };
      document.getElementById('confirm-ok').onclick = () => {
        EaseStorage.clearAll(); // wipes entries + profile
        modal.hidden = true;
        refreshToday();
        refreshHistory();
        refreshTrends();
        refreshSettingsProfile();
        applyGreeting();
        // Re-show onboarding since the profile is now gone.
        showOnboarding('first-time');
      };
    });

    // Edit profile re-opens the onboarding starting at screen 2, prefilled.
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
      const profile = EaseStorage.getProfile() || {};
      showOnboarding('edit', {
        name: profile.name || '',
        age: profile.age != null ? profile.age : null,
        stage: profile.stage || null
      });
    });
  }

  // ---------- Navigation ----------
  function showScreen(name) {
    ['today', 'history', 'trends', 'settings'].forEach(n => {
      const el = document.getElementById(`screen-${n}`);
      const active = n === name;
      el.hidden = !active;
      el.classList.toggle('screen--active', active);
    });
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('tab--active', tab.dataset.screen === name);
    });
    // Refresh data for the screen we're showing.
    if (name === 'today') refreshToday();
    if (name === 'history') refreshHistory();
    if (name === 'trends') refreshTrends();
    if (name === 'settings') refreshSettingsProfile();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function initNav() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        const name = tab.dataset.screen;
        location.hash = name;
        showScreen(name);
      });
    });
    window.addEventListener('hashchange', () => {
      const name = (location.hash || '#today').slice(1);
      if (['today', 'history', 'trends', 'settings'].includes(name)) showScreen(name);
    });

    // Close detail modal
    document.getElementById('detail-close').addEventListener('click', () => {
      document.getElementById('detail-modal').hidden = true;
    });
  }

  // ---------- Install banner (PWA prompt) ----------
  let deferredPrompt = null;
  function initInstallBanner() {
    const banner = document.getElementById('install-banner');
    const dismissed = localStorage.getItem('easetrack_install_dismissed') === '1';

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      if (!dismissed) banner.hidden = false;
    });

    document.getElementById('install-accept').addEventListener('click', async () => {
      banner.hidden = true;
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });
    document.getElementById('install-dismiss').addEventListener('click', () => {
      banner.hidden = true;
      localStorage.setItem('easetrack_install_dismissed', '1');
    });

    window.addEventListener('appinstalled', () => {
      banner.hidden = true;
      deferredPrompt = null;
    });
  }

  // ---------- Greeting (uses saved profile) ----------
  function timeBasedGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
  // Update the brand <h1> to a personalized greeting (or "EaseTrack" if no profile).
  function applyGreeting() {
    const profile = EaseStorage.getProfile();
    const brand = document.querySelector('.brand');
    if (!brand) return;
    if (profile && profile.name) {
      brand.textContent = `${timeBasedGreeting()}, ${profile.name}`;
    } else {
      brand.textContent = 'EaseTrack';
    }
  }

  // ---------- Settings: Profile section ----------
  function refreshSettingsProfile() {
    const card = document.getElementById('profile-card');
    if (!card) return;
    const profile = EaseStorage.getProfile();
    if (!profile) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    document.getElementById('profile-name').textContent = profile.name || '—';
    document.getElementById('profile-age').textContent =
      (profile.age != null && profile.age !== '') ? String(profile.age) : 'Not set';
    document.getElementById('profile-stage').textContent = STAGE_LABELS[profile.stage] || '—';
  }

  // ---------- Onboarding ----------
  // Show overlay, hide main app. `mode` is 'first-time' or 'edit'.
  function showOnboarding(mode, prefill) {
    onboarding.mode = mode;
    onboarding.step = mode === 'edit' ? 2 : 1;
    onboarding.data = {
      name: prefill?.name || '',
      age: (prefill && prefill.age != null) ? prefill.age : null,
      stage: prefill?.stage || null
    };

    // Reflect data in inputs / option buttons
    const nameInput = document.getElementById('ob-name');
    const ageInput = document.getElementById('ob-age');
    if (nameInput) nameInput.value = onboarding.data.name;
    if (ageInput) ageInput.value = onboarding.data.age != null ? onboarding.data.age : '';
    document.querySelectorAll('.onboarding__option').forEach(opt => {
      const match = opt.dataset.value === onboarding.data.stage;
      opt.classList.toggle('onboarding__option--selected', match);
      opt.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    document.getElementById('onboarding').hidden = false;
    document.body.classList.add('onboarding-active');
    renderOnboardingStep();
  }

  function hideOnboarding() {
    document.getElementById('onboarding').hidden = true;
    document.body.classList.remove('onboarding-active');
  }

  // Show only the current step's sub-section; update progress pills; manage focus.
  function renderOnboardingStep() {
    document.querySelectorAll('.onboarding__screen').forEach(s => {
      s.hidden = parseInt(s.dataset.step, 10) !== onboarding.step;
    });
    document.querySelectorAll('.onboarding__pill').forEach((pill, i) => {
      pill.classList.toggle('onboarding__pill--filled', i < onboarding.step);
    });
    const prog = document.querySelector('.onboarding__progress');
    if (prog) prog.setAttribute('aria-valuenow', String(onboarding.step));

    // In edit mode at step 2, swap the "back" link to a cancel that closes the overlay.
    const step2Back = document.querySelector('.onboarding__screen[data-step="2"] .onboarding__back');
    if (step2Back) {
      step2Back.textContent = (onboarding.mode === 'edit') ? 'Cancel' : '← Back';
    }

    updateContinueState();

    // Focus the relevant input when entering a step (skip on welcome).
    setTimeout(() => {
      const current = document.querySelector(`.onboarding__screen[data-step="${onboarding.step}"]`);
      if (!current) return;
      const focusable = current.querySelector('input, .onboarding__option, .onboarding__continue');
      if (focusable) focusable.focus({ preventScroll: false });
    }, 30);
  }

  // Enable/disable the Continue/Finish button based on validation rules for the step.
  function updateContinueState() {
    const screen = document.querySelector(`.onboarding__screen[data-step="${onboarding.step}"]`);
    if (!screen) return;
    const btn = screen.querySelector('[data-action="next"], [data-action="finish"]');
    if (!btn) return;
    let valid = true;
    if (onboarding.step === 2) valid = onboarding.data.name.trim().length > 0;
    if (onboarding.step === 4) valid = !!onboarding.data.stage;
    // Steps 1 (welcome) and 3 (age — optional) are always valid.
    btn.disabled = !valid;
  }

  function onboardingNext() {
    if (onboarding.step < 4) {
      onboarding.step++;
      renderOnboardingStep();
    }
  }

  function onboardingBack() {
    // In edit mode at step 2, "Back" closes the overlay (cancel edit).
    if (onboarding.step === 2 && onboarding.mode === 'edit') {
      hideOnboarding();
      return;
    }
    if (onboarding.step > 1) {
      onboarding.step--;
      renderOnboardingStep();
    }
  }

  function finishOnboarding() {
    if (!onboarding.data.stage) return; // safety: button should be disabled
    const profile = {
      name: onboarding.data.name.trim(),
      age: onboarding.data.age,
      stage: onboarding.data.stage,
      onboardedAt: new Date().toISOString()
    };
    EaseStorage.setProfile(profile);
    const wasEdit = onboarding.mode === 'edit';
    hideOnboarding();
    applyGreeting();
    refreshSettingsProfile();
    if (wasEdit) {
      showScreen('settings');
    } else {
      showScreen('today');
    }
  }

  function initOnboarding() {
    const nameInput = document.getElementById('ob-name');
    const ageInput = document.getElementById('ob-age');

    nameInput.addEventListener('input', () => {
      onboarding.data.name = nameInput.value;
      updateContinueState();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && onboarding.data.name.trim().length > 0) {
        e.preventDefault();
        onboardingNext();
      }
    });

    ageInput.addEventListener('input', () => {
      const v = ageInput.value;
      onboarding.data.age = v === '' ? null : parseInt(v, 10);
      updateContinueState();
    });
    ageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onboardingNext();
      }
    });

    document.querySelectorAll('.onboarding__option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.onboarding__option').forEach(o => {
          o.classList.remove('onboarding__option--selected');
          o.setAttribute('aria-checked', 'false');
        });
        opt.classList.add('onboarding__option--selected');
        opt.setAttribute('aria-checked', 'true');
        onboarding.data.stage = opt.dataset.value;
        updateContinueState();
      });
    });

    // Single delegated handler for next / back / finish actions inside the overlay.
    document.getElementById('onboarding').addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'next') onboardingNext();
      else if (action === 'back') onboardingBack();
      else if (action === 'finish') finishOnboarding();
    });
  }

  // ---------- Service worker ----------
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTodayScreen();
    initTrendsScreen();
    initSettingsScreen();
    initOnboarding();
    initNav();
    initInstallBanner();
    registerSW();

    // First-run check: no profile → show onboarding; otherwise route normally.
    const profile = EaseStorage.getProfile();
    if (!profile) {
      showOnboarding('first-time');
    } else {
      applyGreeting();
      refreshSettingsProfile();
      const initial = (location.hash || '#today').slice(1);
      showScreen(['today', 'history', 'trends', 'settings'].includes(initial) ? initial : 'today');
    }

    // Apply any saved reminder.
    try { EaseReminders.apply(); } catch (_) {}
  });
})();
