/* ============== EaseTrack — Reminders ============== */
// Lightweight notification scheduling. Best-effort only — browsers don't
// guarantee timed notifications without a push server. We schedule a setTimeout
// for the next occurrence each time the app is loaded and the setting is on.

(function () {
  let timerId = null;

  function isSupported() {
    return 'Notification' in window;
  }

  // Asks user permission. Returns a Promise resolving to the permission state.
  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch (_) {
      return 'denied';
    }
  }

  // Returns ms until the next occurrence of HH:MM (24h) from now.
  function msUntil(timeStr) {
    const [h, m] = timeStr.split(':').map(n => parseInt(n, 10));
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime() - now.getTime();
  }

  function clear() {
    if (timerId) { clearTimeout(timerId); timerId = null; }
  }

  // Schedule the next single reminder. After firing, schedules again for tomorrow.
  function schedule(timeStr) {
    clear();
    if (!isSupported() || Notification.permission !== 'granted') return;
    const delay = msUntil(timeStr);
    timerId = setTimeout(() => {
      try {
        new Notification('EaseTrack', { body: 'A gentle reminder to log how you felt today.' });
      } catch (_) {}
      // Re-schedule for tomorrow.
      schedule(timeStr);
    }, delay);
  }

  // Read current settings and either schedule or clear.
  function apply() {
    const s = EaseStorage.getSettings();
    if (s.remindersEnabled) {
      schedule(s.reminderTime);
    } else {
      clear();
    }
  }

  window.EaseReminders = {
    isSupported,
    requestPermission,
    apply,
    clear
  };
})();
