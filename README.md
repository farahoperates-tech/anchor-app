# Anchor

A one-tap panic attack companion, built as an installable PWA. Your own words,
your own people, your own calming techniques — ready the moment you need them,
stored only on your device. No account, no cloud, no tracking.

## Features

- **One-tap panic mode** — works instantly with zero setup: breathing pacer
  with drifting particle visuals, a soft breath-synced tone, and ~100 rotating
  grounding phrases.
- **Personalized setup** — safe people to call (with recorded voice notes),
  chosen techniques (box / extended-exhale / arm-raise breathing, 5-4-3-2-1
  grounding, progressive muscle relaxation, cold-water reset), calming songs,
  and personal words resurfaced back to you during hard moments.
- **Guided sequences** — step-by-step 5-4-3-2-1, PMR, and TIPP cards.
- **Private log** — episode timestamps kept only in localStorage.
- **Offline-ready PWA** — service worker (network-first with offline fallback),
  installable to the home screen.

## Stack

Plain HTML/CSS/JS — no frameworks, no build step, no dependencies.

- `index.html` — all screens (intro, home, setup, panic, after)
- `app.js` — app logic
- `style.css` — styles
- `sw.js` — service worker (bump `CACHE` version on deploy)
- `manifest.json`, `icons/` — PWA install metadata
- `gen_icons.py` — icon generator script

## Deploy

Deployed on Netlify: https://anchor-calm-companion-254.netlify.app

```
npx netlify-cli deploy --prod --dir .
```

## Note

`TEST_MODE` in `app.js` is currently `true` for tester handoff: all local data
auto-resets after 5+ minutes away from the app. Set it to `false` for real use.

---

© 2026 Farah Alzubaidi. All rights reserved.
