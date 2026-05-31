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
        EaseStorage.clearAll();
        modal.hidden = true;
        refreshToday();
        refreshHistory();
        refreshTrends();
        flashStatus('All data cleared.');
      };
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
    initNav();
    initInstallBanner();
    registerSW();

    const initial = (location.hash || '#today').slice(1);
    showScreen(['today', 'history', 'trends', 'settings'].includes(initial) ? initial : 'today');

    // Apply any saved reminder.
    try { EaseReminders.apply(); } catch (_) {}
  });
})();
