# Anchor

A one-tap panic attack companion, built as an installable PWA. Your own words,
your own people, your own calming techniques — ready the moment you need them,
stored only on your device. No account, no cloud, no tracking.

The covenant: **one tap, works offline, nothing leaves the phone, never loses
the user's plan.**

## Features

- **One-tap panic mode** — works instantly with zero setup, from the very first
  launch (even from the arrival screen): breathing pacer with drifting particle
  visuals, a soft breath-synced tone, and ~100 rotating grounding phrases shown
  one at a time in large type.
- **Personalized setup** — safe people to call (with recorded voice notes and a
  prewritten text for when they don't pick up), chosen techniques
  (box / extended-exhale / arm-raise breathing, 5-4-3-2-1 grounding,
  progressive muscle relaxation, cold-water reset), calming songs (links, or
  audio files that play inside the app offline), and personal words resurfaced
  back to you during hard moments.
- **Call fallbacks** — after tapping a call, the same screen offers a one-tap
  SMS (`sms:` with body, iOS `&body=` / Android `?body=` handled) and the
  second safe person.
- **Quiet crisis line** — always visible at the bottom of panic mode:
  112 · Telefonseelsorge 0800 111 0 111, both tappable. Never a modal.
- **Guided sequences** — step-by-step 5-4-3-2-1, PMR, and TIPP cards (TIPP
  carries a heart-condition caution).
- **Private log** — episode timestamps kept only on the device.
- **Encrypted backup** — in settings: export everything to one file locked
  with a passphrase (WebCrypto: PBKDF2-SHA256 → AES-256-GCM), import it back.
  No network involved, ever.
- **Offline-ready PWA** — service worker (network-first with offline fallback),
  installable to the home screen.

## Languages (DE + EN)

Every user-facing string lives in `i18n/en.js` and `i18n/de.js` — one plain
global object each, identical nested keys (`setup.*`, `panic.*`,
`techniques.*`, `after.*`, `backup.*`), including all ~100 grounding phrases,
guide steps, breath labels, SMS defaults and aria-labels. `i18n/i18n.js`
provides `t(key, vars)`; a key missing in the current language falls back to
English with one console warning. No i18n library.

- First launch auto-detects from `navigator.language` (`de*` → German,
  everything else → English). The choice is stored in IndexedDB (`meta.lang`)
  and can be switched in settings — effective immediately, no reload.
  `<html lang>` follows. There is never a language prompt in panic mode.
- **Crisis line is region-aware, not language-aware.** German UI defaults to
  `112 · Telefonseelsorge 0800 111 0 111`; English UI to
  `112 (EU) · 911 (US) · your local emergency number`. A number entered under
  "Where you live" in setup replaces the defaults.
- SMS fallback default follows the language; a custom text per person is kept
  as written.
- `manifest.json` (EN) / `manifest.de.json` (DE): the `<link rel=manifest>`
  is switched with the language, but browsers read the manifest only at
  install time — the home-screen name/description change only after removing
  and re-adding the app.
- `privacy.html` carries the policy in English (`#en`) and German (`#de`);
  `terms.html` the terms of use (German first, `#de` / `#en`).

## Disclaimer flow

- A one-time disclaimer screen sits in front of **setup** only (acceptance
  stored as `meta.consentAt`). It never appears in front of panic mode.
- If a brand-new user's very first tap is the panic button, one quiet line
  ("New or different from usual? → 112 / 911") is shown at the top of panic
  mode, once (`meta.panicNoticeAt`). Never a modal, never blocking.

## Storage

All user data lives in **IndexedDB** (database `anchor`), one object store per
data type: `persons`, `voice` (audio Blobs), `songs` (links or audio Blobs),
`words`, `techniques`, `log`, `meta`. Audio is stored as Blobs and played via
`URL.createObjectURL`, revoked after use. Data from the earlier localStorage
version is migrated on first launch and the localStorage copies are removed.
`navigator.storage.persist()` is requested after the first user interaction.

There is no test-mode or auto-reset code path in this build.

## Stack

Plain HTML/CSS/JS — no frameworks, no build step, no dependencies.

- `index.html` — all screens (intro, home, setup, panic, after)
- `privacy.html` — privacy policy, EN + DE
- `i18n/en.js`, `i18n/de.js`, `i18n/i18n.js` — strings + `t()` helper
- `app.js` — app logic
- `storage.js` — IndexedDB module (`AnchorStore`)
- `backup.js` — encrypted backup (`AnchorBackup`)
- `style.css` — styles
- `sw.js` — service worker (bump `CACHE` version on deploy)
- `manifest.json`, `manifest.de.json`, `icons/` — PWA install metadata
- `gen_icons.py` — icon generator script

## Deploy

Deployed on Netlify: https://anchor-calm-companion-254.netlify.app

```
npx netlify-cli deploy --prod --dir .
```

## Regression checklist before a release

1. Airplane mode, cold start from the home-screen icon → panic mode fully
   functional (pacer, phrases, crisis line, chips) — in both languages.
2. iPhone Safari standalone (installed PWA): breath tone plays after the panic
   tap; data survives app close + reopen + device restart.
3. Lighthouse PWA/installability audit passes; service worker cache lists
   every module (`storage.js`, `backup.js`, `app.js`).

---

© 2026 Farah Alzubaidi. All rights reserved.
