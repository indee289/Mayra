/* ═══════════════════════════════════════════════════════════
   STORAGE — Secure on-device persistence
   API key is never logged, never sent anywhere but Google.
═══════════════════════════════════════════════════════════ */
const Storage = (() => {
  const KEYS = {
    API_KEY:        'mayra_api_key',      /* legacy single-key slot — kept for backward compat */
    PROVIDER:       'mayra_provider',     /* selected provider id: 'gemini' | 'groq' | 'openai' */
    USERNAME:       'mayra_username',
    ONBOARDED:      'mayra_onboarded',
    DARK_MODE:      'mayra_dark_mode',
    CHAT_HISTORY:   'mayra_chat_history',
    CHAT_COUNT:     'mayra_chat_count',
    INSTALL_DATE:   'mayra_install_date',
    PERM_MIC:            'mayra_perm_mic',
    PERM_CONTACTS:       'mayra_perm_contacts',
    PERM_NOTIFICATIONS:  'mayra_perm_notifications',
    PERM_LOCATION:       'mayra_perm_location',
    VOICE_SPEED:         'mayra_voice_speed',    /* 'slow' | 'normal' | 'fast' */
    LANG_AUTO:           'mayra_lang_auto',      /* '1' = auto-detect ON (default) */
    LANG_MODE:           'mayra_lang_mode',      /* 'hindi' | 'english' | 'hinglish' */
    NOTIFICATIONS:       'mayra_notifications',  /* '1' = notifications enabled */
  };

  /* Supported providers and their per-provider key slots. */
  const PROVIDERS = ['gemini', 'groq', 'openai'];
  const DEFAULT_PROVIDER = 'gemini';
  function _providerKeyName(provider) {
    const p = PROVIDERS.includes(provider) ? provider : DEFAULT_PROVIDER;
    return `mayra_key_${p}`;
  }

  /* Permission name -> storage key map (generalized, no hardcoded ternary). */
  const PERM_KEYS = {
    mic:           KEYS.PERM_MIC,
    contacts:      KEYS.PERM_CONTACTS,
    notifications: KEYS.PERM_NOTIFICATIONS,
    location:      KEYS.PERM_LOCATION,
  };

  /* ── Simple XOR obfuscation — not true encryption but prevents
        casual exposure in DevTools / storage inspection.
        For a real Android APK, use Android Keystore via a
        Capacitor plugin (see comments in android-bridge.js). ── */
  const _xorKey = 'mayra2026pkdost';
  function _obfuscate(str) {
    return btoa(str.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ _xorKey.charCodeAt(i % _xorKey.length))
    ).join(''));
  }
  function _deobfuscate(b64) {
    try {
      const str = atob(b64);
      return str.split('').map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ _xorKey.charCodeAt(i % _xorKey.length))
      ).join('');
    } catch { return null; }
  }

  /* ── Provider selection ── */
  function getProvider() {
    const p = localStorage.getItem(KEYS.PROVIDER);
    return PROVIDERS.includes(p) ? p : DEFAULT_PROVIDER;
  }
  function setProvider(provider) {
    const p = PROVIDERS.includes(provider) ? provider : DEFAULT_PROVIDER;
    localStorage.setItem(KEYS.PROVIDER, p);
  }

  /* ── Provider-aware API key storage ──
        Callers may pass a provider explicitly; when omitted we operate on
        the currently-selected provider. XOR obfuscation is preserved for
        every stored key. */
  function setApiKey(key, provider) {
    const slot = _providerKeyName(provider || getProvider());
    if (!key) { localStorage.removeItem(slot); return; }
    localStorage.setItem(slot, _obfuscate(key.trim()));
  }
  function getApiKey(provider) {
    const active = provider || getProvider();
    const slot = _providerKeyName(active);
    const raw = localStorage.getItem(slot);
    if (raw) return _deobfuscate(raw);

    /* BACKWARD COMPAT: users who saved a key before multi-provider support
       stored it under the legacy single-key slot. Treat it as the gemini /
       active provider key so they aren't logged out. */
    if (active === DEFAULT_PROVIDER) {
      const legacy = localStorage.getItem(KEYS.API_KEY);
      if (legacy) return _deobfuscate(legacy);
    }
    return null;
  }
  function clearApiKey(provider) {
    const active = provider || getProvider();
    localStorage.removeItem(_providerKeyName(active));
    /* Also clear the legacy slot for the default provider so a cleared key
       does not silently resurface from backward-compat fallback. */
    if (active === DEFAULT_PROVIDER) {
      localStorage.removeItem(KEYS.API_KEY);
    }
  }
  function hasApiKey(provider) {
    return !!getApiKey(provider);
  }

  function setUsername(name) { localStorage.setItem(KEYS.USERNAME, name || 'Priya'); }
  function getUsername()     { return localStorage.getItem(KEYS.USERNAME) || 'Priya'; }

  function setOnboarded(val) { localStorage.setItem(KEYS.ONBOARDED, val ? '1' : '0'); }
  function isOnboarded()     { return localStorage.getItem(KEYS.ONBOARDED) === '1'; }

  function setDarkMode(val)  { localStorage.setItem(KEYS.DARK_MODE, val ? '1' : '0'); }
  function getDarkMode()     { return localStorage.getItem(KEYS.DARK_MODE) === '1'; }

  function setPermission(name, status) {
    const k = PERM_KEYS[name] || `mayra_perm_${name}`;
    localStorage.setItem(k, status);
  }
  function getPermission(name) {
    const k = PERM_KEYS[name] || `mayra_perm_${name}`;
    return localStorage.getItem(k) || 'unknown';
  }

  /* Chat history — keep last 60 messages for context window */
  function appendMessage(role, text) {
    const history = getChatHistory();
    history.push({ role, text, ts: Date.now() });
    if (history.length > 60) history.splice(0, history.length - 60);
    localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(history));

    // Increment chat counter
    const count = parseInt(localStorage.getItem(KEYS.CHAT_COUNT) || '0', 10);
    localStorage.setItem(KEYS.CHAT_COUNT, String(count + 1));
  }
  function getChatHistory() {
    try { return JSON.parse(localStorage.getItem(KEYS.CHAT_HISTORY) || '[]'); }
    catch { return []; }
  }
  function clearChatHistory() { localStorage.removeItem(KEYS.CHAT_HISTORY); }
  function getChatCount()     { return parseInt(localStorage.getItem(KEYS.CHAT_COUNT) || '0', 10); }

  /* ── Voice response speed/pace: 'slow' | 'normal' | 'fast' ── */
  const VOICE_SPEEDS = ['slow', 'normal', 'fast'];
  function setVoiceSpeed(speed) {
    const s = VOICE_SPEEDS.includes(speed) ? speed : 'normal';
    localStorage.setItem(KEYS.VOICE_SPEED, s);
  }
  function getVoiceSpeed() {
    const s = localStorage.getItem(KEYS.VOICE_SPEED);
    return VOICE_SPEEDS.includes(s) ? s : 'normal';
  }

  /* ── Language: auto-detect toggle + preferred default mode ── */
  function setLanguageAuto(val) { localStorage.setItem(KEYS.LANG_AUTO, val ? '1' : '0'); }
  function getLanguageAuto() {
    const v = localStorage.getItem(KEYS.LANG_AUTO);
    return v === null ? true : v === '1'; /* default ON */
  }
  const LANG_MODES = ['hindi', 'english', 'hinglish'];
  function setLanguageMode(mode) {
    const m = LANG_MODES.includes(mode) ? mode : 'hinglish';
    localStorage.setItem(KEYS.LANG_MODE, m);
  }
  function getLanguageMode() {
    const m = localStorage.getItem(KEYS.LANG_MODE);
    return LANG_MODES.includes(m) ? m : 'hinglish';
  }

  /* ── Notification preference (Phase A stores it; Phase B honors it) ── */
  function setNotifications(val) { localStorage.setItem(KEYS.NOTIFICATIONS, val ? '1' : '0'); }
  function getNotifications() {
    const v = localStorage.getItem(KEYS.NOTIFICATIONS);
    return v === null ? false : v === '1'; /* default OFF (Phase A has no active notifications) */
  }

  /* ── Data & Privacy: wipe stored memory/preferences ──
     clearMemory: wipes chat history + counters (the "saved memory").
     clearPreferences: wipes personalization prefs — username, dark mode,
     voice speed, language settings, notification pref — but NEVER the API
     key(s) or provider selection (those have their own Remove control). */
  function clearMemory() {
    localStorage.removeItem(KEYS.CHAT_HISTORY);
    localStorage.removeItem(KEYS.CHAT_COUNT);
  }
  function clearPreferences() {
    localStorage.removeItem(KEYS.USERNAME);
    localStorage.removeItem(KEYS.DARK_MODE);
    localStorage.removeItem(KEYS.VOICE_SPEED);
    localStorage.removeItem(KEYS.LANG_AUTO);
    localStorage.removeItem(KEYS.LANG_MODE);
    localStorage.removeItem(KEYS.NOTIFICATIONS);
  }

  function getInstallDays() {
    let installed = localStorage.getItem(KEYS.INSTALL_DATE);
    if (!installed) {
      installed = Date.now().toString();
      localStorage.setItem(KEYS.INSTALL_DATE, installed);
    }
    const diffMs = Date.now() - parseInt(installed, 10);
    return Math.max(1, Math.floor(diffMs / 86_400_000) + 1);
  }

  return {
    getProvider, setProvider,
    setApiKey, getApiKey, clearApiKey, hasApiKey,
    setUsername, getUsername,
    setOnboarded, isOnboarded,
    setDarkMode, getDarkMode,
    setPermission, getPermission,
    setVoiceSpeed, getVoiceSpeed,
    setLanguageAuto, getLanguageAuto, setLanguageMode, getLanguageMode,
    setNotifications, getNotifications,
    appendMessage, getChatHistory, clearChatHistory, getChatCount,
    clearMemory, clearPreferences,
    getInstallDays,
  };
})();
