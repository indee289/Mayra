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
└── android/
    ├── AndroidManifest.xml ← All permissions + <queries> for Android 11+
    └── MayraAndroidPlugin.kt ← Capacitor plugin (openApp, makeCall, callContact…)
```

---

## Android APK Build (Capacitor)

1. `npm install @capacitor/core @capacitor/android @capacitor/cli`
2. `npx cap init "Priya ki Dost" com.priyakidost.mayra`
3. `npx cap add android`
4. Copy `android/MayraAndroidPlugin.kt` to `android/app/src/main/java/com/priyakidost/mayra/`
5. Register plugin in `MainActivity.kt`: `add(MayraAndroidPlugin::class.java)`
6. Merge `android/AndroidManifest.xml` permissions into your app's manifest
7. `npx cap sync && npx cap open android`

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
