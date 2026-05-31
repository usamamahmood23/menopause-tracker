# EaseTrack

A private, offline-first **menopause symptom tracker** built as a Progressive Web App. All data lives on your device — no accounts, no cloud, no analytics.

## Features

- **Daily check-in** for six symptoms: hot flashes, night sweats, sleep quality, mood, energy, brain fog
- Optional **trigger log** (caffeine, alcohol, stress, etc.) and a free-form notes field
- **History** view — scrollable list of past days, tap to view or edit
- **Trends** — 7 / 30 / 90 day charts (Chart.js) plus a gentle auto-generated insight and simple trigger / hot-flash correlation
- **Export / import** all data as JSON, or **clear** everything
- Optional **daily reminder** (browser notification)
- **Installable** as a PWA on phone and desktop; **works fully offline** after first load

## Tech

- Vanilla HTML / CSS / JS — no framework
- `localStorage` for persistence (single key: `easetrack_data`)
- Service Worker (cache-first) for offline
- Chart.js via CDN (cached after first visit) — the only external dependency

## Run locally

The app must be served over HTTP (not `file://`) for the service worker and PWA features to work.

```bash
cd "/Volumes/Work/Clude Code/Menopause"
python3 -m http.server 8080
# then open http://localhost:8080
```

Or with Node:

```bash
npx serve .
```

### Testing the PWA bits

1. Load the site in Chrome / Edge.
2. Open DevTools → **Application** → **Manifest** — confirm icons and theme color.
3. **Service Workers** — confirm `service-worker.js` is "activated and running".
4. Toggle **Offline** in the Network tab and reload — the app should still load.
5. On a supported browser you'll see the in-app **Install** banner. You can also use the browser's address-bar install icon.

### Testing offline

After the first visit:

```
DevTools → Network → Offline → reload
```

The shell, CSS, JS, and Chart.js should all serve from the SW cache.

## Deploy

EaseTrack is fully static — drop the folder onto any static host.

### Netlify

```bash
npx netlify deploy --dir . --prod
```

### Vercel

```bash
npx vercel --prod
```

### GitHub Pages

Commit the folder to a repo, then in **Settings → Pages** point the source at the branch/root.

> Note: PWAs require **HTTPS** in production. All three providers above give you HTTPS automatically.

## File layout

```
/
├── index.html
├── manifest.json
├── service-worker.js
├── css/styles.css
├── js/
│   ├── app.js          (UI, routing, screen logic)
│   ├── storage.js      (localStorage read/write/export/import)
│   ├── charts.js       (Chart.js setup + insight + trigger correlation)
│   └── reminders.js    (Notification API)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── make_icons.py       (one-shot script that generated the icons)
```

## Data shape

Everything lives under one `localStorage` key, `easetrack_data`:

```json
{
  "entries": {
    "2026-05-31": {
      "hotFlashes": "1-3",
      "nightSweats": "mild",
      "sleepQuality": 4,
      "mood": "good",
      "energy": 3,
      "brainFog": "none",
      "triggers": ["caffeine", "stress"],
      "notes": "Felt calmer after morning walk"
    }
  },
  "settings": {
    "remindersEnabled": false,
    "reminderTime": "20:00"
  }
}
```

## Privacy

EaseTrack helps you track symptoms. **It is not medical advice.** All data stays on your device — there is no server. Use **Settings → Export** to back it up; use **Clear all data** to wipe it.
