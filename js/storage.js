/* ============== EaseTrack — Storage ============== */
// All read/write/export/import for localStorage. Single key: easetrack_data.

(function () {
  const KEY = 'easetrack_data';

  // Default shape returned when nothing is stored yet.
  function emptyStore() {
    return {
      entries: {},
      settings: {
        remindersEnabled: false,
        reminderTime: '20:00'
      }
    };
  }

  // Read full store from localStorage, falling back to an empty shape if missing/corrupt.
  function loadStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return emptyStore();
      if (!parsed.entries) parsed.entries = {};
      if (!parsed.settings) parsed.settings = emptyStore().settings;
      return parsed;
    } catch (e) {
      console.warn('EaseTrack: failed to parse stored data, resetting.', e);
      return emptyStore();
    }
  }

  function saveStore(store) {
    localStorage.setItem(KEY, JSON.stringify(store));
  }

  // Today's date as YYYY-MM-DD (local time, not UTC).
  function todayKey(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getEntry(dateKey) {
    return loadStore().entries[dateKey] || null;
  }

  function setEntry(dateKey, entry) {
    const store = loadStore();
    store.entries[dateKey] = entry;
    saveStore(store);
  }

  function deleteEntry(dateKey) {
    const store = loadStore();
    delete store.entries[dateKey];
    saveStore(store);
  }

  function getAllEntries() {
    return loadStore().entries;
  }

  // Returns array of [dateKey, entry] sorted newest-first.
  function listEntriesSorted() {
    const entries = getAllEntries();
    return Object.keys(entries)
      .sort()
      .reverse()
      .map(k => [k, entries[k]]);
  }

  function getSettings() {
    return loadStore().settings;
  }

  function updateSettings(patch) {
    const store = loadStore();
    store.settings = Object.assign({}, store.settings, patch);
    saveStore(store);
    return store.settings;
  }

  function clearAll() {
    localStorage.removeItem(KEY);
  }

  // Triggers a JSON file download of all data.
  function exportJSON() {
    const data = loadStore();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easetrack-export-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Validates and merges imported JSON. Returns { ok, message }.
  function importJSON(jsonString) {
    try {
      const incoming = JSON.parse(jsonString);
      if (!incoming || typeof incoming !== 'object' || !incoming.entries) {
        return { ok: false, message: 'File does not look like EaseTrack data.' };
      }
      const store = loadStore();
      store.entries = Object.assign({}, store.entries, incoming.entries);
      if (incoming.settings) {
        store.settings = Object.assign({}, store.settings, incoming.settings);
      }
      saveStore(store);
      return { ok: true, message: `Imported ${Object.keys(incoming.entries).length} entries.` };
    } catch (e) {
      return { ok: false, message: 'Could not parse JSON file.' };
    }
  }

  // Expose
  window.EaseStorage = {
    todayKey,
    getEntry,
    setEntry,
    deleteEntry,
    getAllEntries,
    listEntriesSorted,
    getSettings,
    updateSettings,
    clearAll,
    exportJSON,
    importJSON
  };
})();
