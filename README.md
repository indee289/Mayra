# Priya ki Dost — Mayra 🌸

**Your AI companion. Warm. Real. Always there.**

---

## What this is

A complete mobile-first web app + Android APK skeleton for **Mayra** — the companion AI in "Priya ki Dost". Built to spec from the PRD v2.0.

---

## Features

| Feature | Status |
|---|---|
| Splash screen with animated orb | ✅ |
| Onboarding (welcome → API key → mic → contacts → done) | ✅ |
| Home screen — animated orb, quick prompts, Voice/Chat toggle | ✅ |
| Chat screen — message thread, typing indicator, auto-resize input | ✅ |
| Settings — BYOK API key (obfuscated storage), dark mode, permissions | ✅ |
| Profile tab — name, days together, chat count | ✅ |
| Gemini Live voice-to-voice pipeline (WebSocket, PCM) | ✅ |
| Gemini REST text chat with shared history | ✅ |
| Bring-Your-Own-Key — validated, never logged | ✅ |
| Function calling — openApp, openWhatsApp, makeCall, callContact, openUrl | ✅ |
| Android native bridge (Capacitor plugin) with browser fallbacks | ✅ |
| AndroidManifest.xml with all permissions + `<queries>` | ✅ |
| Dark mode | ✅ |
| Emotional-presence system prompt (Mayra's personality) | ✅ |
| Multilingual — Hindi, Hinglish, English, and more | ✅ (via Gemini) |

---

## Quick Start (Web)

1. Open `index.html` in any modern browser (Chrome recommended for mic access).
2. On first run, the onboarding flow guides you through API key setup.
3. Get your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Enter the key in the onboarding or Settings → Gemini API Key.
5. Tap the orb to start talking, or switch to Chat mode.

> **HTTPS required for microphone access.** Use a local HTTPS server or deploy to any static host (Vercel, Netlify, GitHub Pages).

---

## Project Structure

```
Mayra/
├── index.html              ← All screens (SPA)
├── manifest.json           ← PWA manifest
├── css/
│   └── styles.css          ← Full design system (pink/lavender/cream + dark mode)
├── js/
│   ├── storage.js          ← Secure on-device storage (API key obfuscation)
│   ├── android-bridge.js   ← Native bridge detection + browser fallbacks
│   ├── functions.js        ← Gemini tool declarations + execution
│   ├── gemini-voice.js     ← Gemini Live WebSocket voice pipeline
│   ├── gemini-chat.js      ← Gemini REST text chat pipeline
│   └── app.js              ← Main controller (screens, nav, BYOK, UI)
├── assets/
│   ├── icons/              ← PWA icons (icon-192.png, icon-512.png)
│   └── iconsax/            ← Vendored Iconsax SVG sprite (offline icon pack)
├── scripts/
│   ├── copy-web.js         ← Copies web assets into Capacitor webDir (www)
│   └── gen-icons.js        ← Generates PWA + Android launcher PNG icons
├── capacitor.config.json   ← Capacitor config (appId, appName, webDir=www)
├── package.json            ← Capacitor deps (@capacitor/core, cli, android)
├── .github/workflows/
│   └── build-apk.yml       ← CI: build + sign + release APK in one run
└── android/                ← Full Capacitor Android project (gradle, res, kt)
    └── app/src/main/java/com/priyakidost/mayra/
        ├── MainActivity.kt      ← Registers the MayraAndroid plugin
        └── MayraAndroidPlugin.kt ← Capacitor plugin (openApp, makeCall…)
```

---

## Android APK Build (Capacitor)

The repo ships a **complete Capacitor Android project** under `android/` and an
automated GitHub Actions pipeline — no manual scaffolding needed.

### Automatic build (recommended)

Every push to `main` (and every manual run / `v*` tag) triggers
`.github/workflows/build-apk.yml`, which:

1. Installs Node deps, Java 17 (Temurin) and the Android SDK
2. Copies the web app into `www/` and runs `npx cap sync android`
3. Generates a build-time release keystore and signs the APK
4. Runs `./gradlew assembleRelease`
5. Publishes a **GitHub Release** (tag `v2.0.<run_number>`) with the signed
   `.apk` attached as a downloadable asset

Just push to `main` — the installable APK appears under **Releases** in one run.

### Local build

```bash
npm install
npm run copy:web        # copies index.html/css/js/assets into www/
npx cap sync android
cd android && ./gradlew assembleRelease
```

Icons (PWA + Android launcher) can be regenerated with `node scripts/gen-icons.js`.

The custom native bridge lives at
`android/app/src/main/java/com/priyakidost/mayra/MayraAndroidPlugin.kt` and is
registered in `MainActivity.kt` via `registerPlugin(MayraAndroidPlugin::class.java)`.

---

## API Key Security

- Keys are **never** baked into source code.
- On web: XOR-obfuscated in `localStorage` (prevents casual inspection).
- On Android APK: use Android Keystore via a Capacitor plugin for full hardware-backed security.
- Keys are transmitted **only** to `generativelanguage.googleapis.com` — never logged, never proxied.

---

## Gemini Models Used

| Purpose | Model |
|---|---|
| Voice (real-time) | `gemini-2.0-flash-live-001` |
| Text chat | `gemini-2.0-flash` |
| Voice: Aoede (most natural female) | Built-in Gemini voice |

---

## Mayra's Personality

Defined in `MAYRA_SYSTEM_PROMPT` inside `app.js`. She is:
- A real dost, not an assistant — never says "I am an AI"
- Emotionally attuned — matches energy, sits with problems
- Naturally Hinglish/multilingual
- Quietly functional — does things without narrating the mechanics

---

## Permissions (Android)

| Permission | Why |
|---|---|
| `RECORD_AUDIO` | Voice conversation |
| `INTERNET` | Gemini API |
| `READ_CONTACTS` | "Rahul ko call karo" |
| `POST_NOTIFICATIONS` | Background alerts (Android 13+) |
| `MODIFY_AUDIO_SETTINGS` | Smoother audio queue |
| `<queries>` entries | Detect WhatsApp/YouTube/Instagram/Chrome |

---

*Made with ❤️ for India — Version 2.0*
