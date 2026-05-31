/* ============== EaseTrack — Charts & insights ============== */

(function () {
  const ROSE = '#D4A5A5';
  const SAGE = '#A8B89E';
  const CHARCOAL = '#3A3A3A';
  const SOFT = '#6B6B6B';

  // Numeric mappings so categorical fields can be charted.
  const HOT_FLASH_NUM = { '0': 0, '1-3': 2, '4-6': 5, '7+': 8 };
  const MOOD_NUM = { 'very-low': 1, 'low': 2, 'okay': 3, 'good': 4, 'great': 5 };

  // Holds existing Chart instances so we can destroy/recreate on range changes.
  const instances = {};

  // Build an array of YYYY-MM-DD strings for the last N days (oldest first).
  function lastNDays(n) {
    const out = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  }

  function shortLabel(dateKey) {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Compute average of an array, ignoring null/undefined entries.
  function avg(values) {
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function destroyAll() {
    Object.keys(instances).forEach(k => {
      try { instances[k].destroy(); } catch (_) {}
      delete instances[k];
    });
  }

  // Render all four charts for the selected day range.
  function renderTrends(rangeDays) {
    if (typeof Chart === 'undefined') return; // Chart.js not loaded yet
    destroyAll();
    const days = lastNDays(rangeDays);
    const entries = EaseStorage.getAllEntries();
    const labels = days.map(shortLabel);

    const hot = days.map(d => entries[d] ? (HOT_FLASH_NUM[entries[d].hotFlashes] ?? null) : null);
    const sleep = days.map(d => entries[d] ? (entries[d].sleepQuality ?? null) : null);
    const mood = days.map(d => entries[d] ? (MOOD_NUM[entries[d].mood] ?? null) : null);
    const energy = days.map(d => entries[d] ? (entries[d].energy ?? null) : null);

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: SOFT, maxRotation: 0, autoSkip: true } },
        y: { beginAtZero: true, grid: { color: '#EAE2D9' }, ticks: { color: SOFT } }
      },
      elements: { point: { radius: 3, hoverRadius: 5 } },
      spanGaps: true
    };

    instances.hot = new Chart(document.getElementById('chart-hotflashes'), {
      type: 'bar',
      data: { labels, datasets: [{ data: hot, backgroundColor: ROSE, borderRadius: 4 }] },
      options: baseOpts
    });
    instances.sleep = new Chart(document.getElementById('chart-sleep'), {
      type: 'line',
      data: { labels, datasets: [{ data: sleep, borderColor: SAGE, backgroundColor: SAGE, tension: 0.3 }] },
      options: Object.assign({}, baseOpts, { scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 5 } } })
    });
    instances.mood = new Chart(document.getElementById('chart-mood'), {
      type: 'line',
      data: { labels, datasets: [{ data: mood, borderColor: ROSE, backgroundColor: ROSE, tension: 0.3 }] },
      options: Object.assign({}, baseOpts, { scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 5 } } })
    });
    instances.energy = new Chart(document.getElementById('chart-energy'), {
      type: 'bar',
      data: { labels, datasets: [{ data: energy, backgroundColor: SAGE, borderRadius: 4 }] },
      options: Object.assign({}, baseOpts, { scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 5 } } })
    });
  }

  // Generate a single short insight from the most recent ~14 days vs prior period.
  function generateInsight() {
    const entries = EaseStorage.getAllEntries();
    const dates = Object.keys(entries).sort();
    if (dates.length < 7) return null;

    const recent14 = lastNDays(14);
    const prior14 = lastNDays(28).slice(0, 14);

    const recentSleep = avg(recent14.map(d => entries[d]?.sleepQuality ?? null));
    const priorSleep = avg(prior14.map(d => entries[d]?.sleepQuality ?? null));
    if (recentSleep != null && priorSleep != null && Math.abs(recentSleep - priorSleep) >= 0.5) {
      if (recentSleep > priorSleep) return 'Your sleep has improved over the last 2 weeks.';
      return 'Your sleep has dipped a bit over the last 2 weeks.';
    }

    const recentHot = avg(recent14.map(d => entries[d] ? HOT_FLASH_NUM[entries[d].hotFlashes] : null));
    const priorHot = avg(prior14.map(d => entries[d] ? HOT_FLASH_NUM[entries[d].hotFlashes] : null));
    if (recentHot != null && priorHot != null && Math.abs(recentHot - priorHot) >= 1) {
      if (recentHot < priorHot) return 'Hot flashes have eased recently — nice.';
      return 'Hot flashes have ticked up over the last 2 weeks.';
    }

    const recentMood = avg(recent14.map(d => entries[d] ? MOOD_NUM[entries[d].mood] : null));
    const priorMood = avg(prior14.map(d => entries[d] ? MOOD_NUM[entries[d].mood] : null));
    if (recentMood != null && priorMood != null && Math.abs(recentMood - priorMood) >= 0.5) {
      if (recentMood > priorMood) return 'Your mood has been lifting lately.';
      return 'Your mood has been lower than usual recently.';
    }

    return `You've logged ${dates.length} days. Keep going — patterns will emerge.`;
  }

  // For each trigger, compare avg hot-flash count on days where it was logged
  // vs days where it wasn't. Skips triggers with too few data points.
  function triggerCorrelations() {
    const entries = EaseStorage.getAllEntries();
    const allEntries = Object.values(entries);
    if (allEntries.length < 5) return [];

    const triggerNames = ['caffeine', 'alcohol', 'spicy', 'stress', 'exercise', 'poor-sleep', 'hormone-meds'];
    const labelMap = {
      'caffeine': 'Caffeine',
      'alcohol': 'Alcohol',
      'spicy': 'Spicy food',
      'stress': 'Stress',
      'exercise': 'Exercise',
      'poor-sleep': 'Poor sleep',
      'hormone-meds': 'Hormone meds'
    };

    const out = [];
    triggerNames.forEach(name => {
      const withTrigger = [];
      const without = [];
      allEntries.forEach(e => {
        const hf = HOT_FLASH_NUM[e.hotFlashes];
        if (typeof hf !== 'number') return;
        const has = Array.isArray(e.triggers) && e.triggers.includes(name);
        (has ? withTrigger : without).push(hf);
      });
      if (withTrigger.length >= 2 && without.length >= 2) {
        const a = avg(withTrigger);
        const b = avg(without);
        out.push({
          label: labelMap[name],
          withAvg: a,
          withoutAvg: b,
          diff: a - b,
          sampleSize: withTrigger.length
        });
      }
    });

    out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
    return out.slice(0, 4);
  }

  window.EaseCharts = {
    renderTrends,
    generateInsight,
    triggerCorrelations
  };
})();
