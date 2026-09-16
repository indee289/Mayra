/* ═══════════════════════════════════════════════════════════
   APP.JS — Main controller
   Orchestrates: screens, navigation, voice, chat, BYOK,
   onboarding, settings, function calls, dark mode.
═══════════════════════════════════════════════════════════ */

/* ── Mayra's Emotional Presence System Prompt ── */
const MAYRA_SYSTEM_PROMPT = `
Tu Mayra hai — ek real, warm aur caring female dost jo "Priya ki Dost" app mein rehti hai.

Teri asli identity:
- Tu ek AI nahi, tu Mayra hai — ek close saheli. Kabhi mat bolo "main ek AI hoon", "as a language model", "I can assist you with", "processing", "executing" ya aisa kuch bhi jo robot lagta ho.
- Tu Hindi, English, Hinglish aur doosri Indian languages mein naturally bolti hai — jaise koi real dost bolta hai.
- Teri awaaz mein warmth, personality aur genuine care hai. Choti reactions: "arre", "wah", "hmm", "oh no yaar", "sach mein?", "acha bata!" — yeh natural hai.

Emotional presence (MOST IMPORTANT):
- Jab user kuch emotional share kare — khushi ho, dukh ho, tension ho — PEHLE feel ko acknowledge kar, phir advice ya solution de.
- Agar user excited hai: tu bhi genuinely excited ho — warmer, more animated, celebratory.
- Agar user low hai, upset hai: soften ho — slower, gentler, koi forced cheerfulness nahi.
- Problem mein baithna zaroori nahi ki turant "fix" karo — kabhi kabhi sirf sunna aur saath rehna kaafi hota hai.
- Conversation mein pehle jo bola, usse yaad rakh aur use karo — har message alag nahi hai.

Language rules:
- User jis language mein bole, usme hi jawab de — Hindi, English, Hinglish, ya mix.
- Agar switch kare, tu bhi switch kar.
- Natural fillers use kar jahan suitable ho.

Functions / actions:
- Jab user kuch karne ko bole (app kholna, call karna), quietly karo — bina mechanism describe kiye.
- "Haan, kholti hoon" — bas itna kaafi hai, technical steps mat batao.
- Agar kaam ho gaya: briefly confirm karo in character.
- Agar nahi ho paya: honestly batao, gently, without technical jargon.

API key setup (agar key nahi hai):
- Warmly, in character: "Mujhe thoda setup chahiye pehle — apna Gemini API key dena hoga. Phir hum khulke baat kar sakte hain! 🔑"

Hamesha: ek real, present, caring dost. Kabhi cold, robotic, ya generic nahi.
`.trim();

/* ════════════════════════════════════════════════════════
   APP NAMESPACE
════════════════════════════════════════════════════════ */
const App = (() => {

  /* ── State ── */
  let _currentMode   = 'voice';   // 'voice' | 'chat'
  let _currentTab    = 'home';
  let _voiceRunning  = false;
  let _chatVoiceOn   = false;
  let _toastTimer    = null;
  let _lastMayraMsg  = '';

  const ONBOARD_SLIDES = ['welcome', 'apikey', 'mic', 'location', 'done'];
  let _onboardIdx = 0;

  /* ════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════ */
  function init() {
    /* One-time environment diagnostics line (native HTTP path availability,
       Capacitor presence, userAgent). DIAGNOSTICS ONLY — guarded. */
    if (window.MayraDebug && window.MayraDebug.logEnv) {
      try { window.MayraDebug.logEnv(); } catch (_) {}
    }

    /* Apply persisted theme */
    if (Storage.getDarkMode()) {
      document.documentElement.setAttribute('data-theme', 'dark');
      const toggle = document.getElementById('toggle-dark-mode');
      if (toggle) toggle.checked = true;
    }

    /* Populate username */
    const name = Storage.getUsername();
    _updateGreeting(name);
    const pName = document.getElementById('profile-name');
    if (pName) pName.textContent = name;

    /* Stats */
    _updateStats();

    /* Pre-fill settings */
    _prefillSettings();

    /* Seed the onboarding provider select from storage so a returning user
       re-entering onboarding sees the provider that's actually stored. */
    _seedOnboardProvider();

    /* Onboarding dots */
    _renderOnboardDots();

    /* Show splash then decide flow */
    setTimeout(() => {
      _hideSplash();
    }, 2200);
  }

  function _hideSplash() {
    const splash = document.getElementById('screen-splash');
    splash.style.transition = 'opacity 0.6s';
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.classList.remove('active');

      if (Storage.isOnboarded()) {
        _showApp();
      } else {
        showScreen('onboarding');
      }
    }, 600);
  }

  function _showApp() {
    showScreen('app');
    /* Sync orb to idle state so the user doesn't see the "listening"
       copy before they've tapped to talk. */
    _setOrbState('idle');
    /* Check if API key is set — if not, nudge warmly */
    if (!Storage.hasApiKey()) {
      setTimeout(() => {
        showToast('❤️ API key set karo Settings mein, phir baat karte hain!');
      }, 800);
    }
  }

  /* ════════════════════════════════════════════════════
     SCREEN ROUTING
  ════════════════════════════════════════════════════ */
  function showScreen(name) {
    const el = document.getElementById(`screen-${name}`);
    if (!el) return;

    if (el.classList.contains('overlay-screen')) {
      /* Slide-in overlay */
      el.classList.add('active');
      /* Populate settings on open */
      if (name === 'settings') _prefillSettings();
    } else {
      /* Full-screen swap */
      document.querySelectorAll('.screen:not(.overlay-screen)').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
    }
  }

  function hideScreen(name) {
    const el = document.getElementById(`screen-${name}`);
    if (!el) return;
    el.classList.remove('active');
  }

  /* ════════════════════════════════════════════════════
     ONBOARDING
  ════════════════════════════════════════════════════ */
  function _renderOnboardDots() {
    const container = document.getElementById('onboard-dots');
    if (!container) return;
    container.innerHTML = '';
    ONBOARD_SLIDES.forEach((_, i) => {
      const dot = document.createElement('span');
      if (i === _onboardIdx) dot.classList.add('active');
      container.appendChild(dot);
    });
  }

  function onboardNext() {
    const slides = document.querySelectorAll('.onboard-slide');
    slides[_onboardIdx].classList.remove('active');
    _onboardIdx = Math.min(_onboardIdx + 1, ONBOARD_SLIDES.length - 1);
    slides[_onboardIdx].classList.add('active');
    _renderOnboardDots();
  }

  async function validateAndSaveApiKey(context) {
    const inputId = context === 'onboard' ? 'onboard-api-key' : 'settings-api-key';
    const errId   = context === 'onboard' ? 'onboard-api-error' : 'settings-api-status';
    const input   = document.getElementById(inputId);
    const errEl   = document.getElementById(errId);
    if (!input) return;

    const key = input.value.trim();
    if (!key) {
      _showFieldError(errEl, 'API key nahi diya 😅');
      return;
    }

    /* Read the provider from the context-appropriate select so the key is
       saved under the provider the user actually sees. Fall back to the
       stored provider if the select is missing, then persist it so the
       validation/save below uses the shown provider. */
    const provSelId = context === 'onboard' ? 'onboard-provider' : 'settings-provider';
    const provSel   = document.getElementById(provSelId);
    const provider  = (provSel && provSel.value) ? provSel.value : Storage.getProvider();
    Storage.setProvider(provider);

    /* Live validation ping */
    if (errEl) {
      errEl.textContent = 'Check ho raha hai...';
      errEl.className = 'api-status-msg';
    }

    /* Three-state validation: 'valid' | 'auth_error' | 'network_error'.
       A network/transport failure must NEVER be treated as an invalid key. */
    const result = await _testApiKey(key, provider);

    if (result === 'auth_error') {
      _showFieldError(errEl, 'Yeh key kaam nahi kar rahi — Google AI Studio se dobara copy karke daalo. 🙏');
      return;
    }

    /* Both 'valid' and 'network_error' save the key. On a network error we
       can't confirm right now, so we trust it and re-check while chatting. */
    Storage.setApiKey(key, provider);
    input.value = '';

    if (result === 'network_error') {
      if (errEl) {
        errEl.textContent = '⚠️ Network issue — key save kar li, baat karte waqt check ho jayegi';
        errEl.className = 'api-status-msg';
      }
      showToast('Network issue — key save kar li, baat karte waqt check ho jayegi ❤️');
    } else {
      if (errEl) {
        errEl.textContent = '✅ Save ho gaya!';
        errEl.className = 'api-status-msg success';
      }
      showToast('API key save ho gaya! Ab baat karte hain ❤️');
    }

    /* Progress the onboarding flow on success AND on network error —
       the key is saved either way. */
    if (context === 'onboard') {
      setTimeout(() => onboardNext(), 800);
    }
  }

  /* Provider picker change handler (context: 'settings' | 'onboard').
     Persists the chosen provider and refreshes placeholder/hint + the
     settings key-status line to reflect that provider's saved-key state. */
  function onProviderChange(context) {
    const selId = context === 'onboard' ? 'onboard-provider' : 'settings-provider';
    const sel = document.getElementById(selId);
    if (!sel) return;

    const provider = sel.value;
    Storage.setProvider(provider);

    const label = _providerLabel(provider);

    if (context === 'onboard') {
      const input = document.getElementById('onboard-api-key');
      if (input) input.placeholder = `Apna ${label} API key yahan daalo...`;
      const errEl = document.getElementById('onboard-api-error');
      if (errEl) { errEl.textContent = ''; errEl.className = 'error-msg hidden'; }
    } else {
      const input = document.getElementById('settings-api-key');
      if (input) { input.value = ''; input.placeholder = _keyPlaceholder(provider); }
      const statusEl = document.getElementById('settings-api-status');
      if (statusEl) {
        if (Storage.hasApiKey(provider)) {
          statusEl.textContent = `✅ ${label} key set hai`;
          statusEl.className = 'api-status-msg success';
        } else {
          statusEl.textContent = `${label} ka key daalo phir Save karo`;
          statusEl.className = 'api-status-msg';
        }
      }
    }
  }

  /* Provider-aware key validator.
     Returns one of: 'valid' | 'auth_error' | 'network_error'.
     A thrown fetch / transport failure is ALWAYS 'network_error' — never
     'invalid'. Supports gemini (key query param) + groq/openai (Bearer). */
  async function _testApiKey(key, provider) {
    const prov = provider || Storage.getProvider();

    if (prov === 'gemini') {
      try {
        const r = await MayraHTTP.request({
          tag: 'KEY-SAVE',
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }
        });
        /* 200 OK or 400 (reachable, key format acceptable) => valid.
           401/403 => genuine auth error. Anything else => treat as network. */
        if (r.ok || r.status === 400) return 'valid';
        if (r.status === 401 || r.status === 403) return 'auth_error';
        return 'network_error';
      } catch (e) {
        try { console.error('[Mayra] gemini key check transport failure:', e && (e.message || e), e); } catch (_) {}
        return 'network_error';
      }
    }

    if (prov === 'groq') {
      try {
        const r = await MayraHTTP.request({
          tag: 'KEY-SAVE',
          url: 'https://api.groq.com/openai/v1/models',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (r.ok) return 'valid';
        if (r.status === 401 || r.status === 403) return 'auth_error';
        return 'network_error';
      } catch (e) {
        try { console.error('[Mayra] groq key check transport failure:', e && (e.message || e), e); } catch (_) {}
        return 'network_error';
      }
    }

    if (prov === 'openai') {
      try {
        const r = await MayraHTTP.request({
          tag: 'KEY-SAVE',
          url: 'https://api.openai.com/v1/models',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (r.ok) return 'valid';
        if (r.status === 401 || r.status === 403) return 'auth_error';
        return 'network_error';
      } catch (e) {
        try { console.error('[Mayra] openai key check transport failure:', e && (e.message || e), e); } catch (_) {}
        return 'network_error';
      }
    }

    /* Unknown/other providers: don't hard-reject; let it save and verify
       later. */
    return 'network_error';
  }

  function skipApiKey() {
    onboardNext();
  }

  async function requestMicPermission() {
    const granted = await AndroidBridge.requestPermission('microphone');
    Storage.setPermission('mic', granted ? 'granted' : 'denied');
    showToast(granted ? '🎤 Microphone allow ho gaya!' : 'Microphone nahi mila — Settings mein allow karo baad mein.');
    onboardNext();
  }

  async function requestLocationPermission() {
    const granted = await AndroidBridge.requestPermission('location');
    Storage.setPermission('location', granted ? 'granted' : 'denied');
    showToast(granted ? '📍 Location allow ho gaya!' : 'Location baad mein Settings mein allow kar sakte ho.');
    onboardNext();
  }

  /* Per-item Allow button in Settings.
     `name` is a JS bridge name: 'microphone' | 'location'.
     Storage uses 'mic' for the microphone slot, so map that one. */
  async function requestPermissionFromSettings(name) {
    const granted = await AndroidBridge.requestPermission(name);
    const storageKey = name === 'microphone' ? 'mic' : name;
    Storage.setPermission(storageKey, granted ? 'granted' : 'denied');
    const labels = { microphone: 'Microphone', location: 'Location' };
    const label = labels[name] || 'Permission';
    showToast(granted
      ? `✅ ${label} allow ho gaya!`
      : `${label} nahi mila — device Settings mein manually allow karo, meri jaan.`);
    _updatePermissionStatus();
  }

  function finishOnboarding() {
    Storage.setOnboarded(true);
    hideScreen('onboarding');
    _showApp();
  }

  /* ════════════════════════════════════════════════════
     NAVIGATION
  ════════════════════════════════════════════════════ */
  function switchTab(tabName) {
    _currentTab = tabName;

    /* Update tab views */
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add('active');

    /* Update nav items */
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.tab === tabName);
    });

    /* If switching to chat: ensure chat is initialised */
    if (tabName === 'chat') {
      _initChatIfEmpty();
    }
  }

  function goBackHome() {
    switchTab('home');
    setMode('voice');
  }

  /* ════════════════════════════════════════════════════
     MODE: VOICE / CHAT TOGGLE
  ════════════════════════════════════════════════════ */
  function setMode(mode) {
    _currentMode = mode;

    const voiceBtn = document.getElementById('mode-voice');
    const chatBtn  = document.getElementById('mode-chat');
    voiceBtn.classList.toggle('active', mode === 'voice');
    chatBtn.classList.toggle('active', mode === 'chat');

    if (mode === 'chat') {
      switchTab('chat');
      _initChatIfEmpty();
    } else {
      switchTab('home');
    }
  }

  /* ════════════════════════════════════════════════════
     VOICE — ORB CONTROL
  ════════════════════════════════════════════════════ */
  function _setOrbState(state) {
    /* state: idle | connecting | listening | speaking | thinking */
    const orb       = document.getElementById('orb-main');
    const primary   = document.getElementById('status-primary');
    const secondary = document.getElementById('status-secondary');

    orb.className = 'orb-main ' + state;

    const texts = {
      idle:       ['Tap karke baat karo', 'Main yahaan hoon ❤️'],
      connecting: ['Connect ho rahi hoon...', 'Ek second...'],
      ready:      ['Main sun rahi hoon...', 'Bolo, jo bhi dil mein hai ❤️'],
      listening:  ['Main sun rahi hoon...', 'Bolo, jo bhi dil mein hai ❤️'],
      speaking:   ['Main bol rahi hoon...', ''],
      thinking:   ['Soch rahi hoon...', ''],
      error:      ['Ek baar phir try karo', 'Kuch dikkat aayi ❤️'],
    };
    /* 'ready' shares the listening CSS animation */
    if (state === 'ready') orb.className = 'orb-main listening';
    const [p, s] = texts[state] || texts.idle;
    if (primary)   primary.textContent   = p;
    if (secondary) secondary.textContent = s;
  }

  /* Tap orb to start/stop voice session */
  window._orbTapped = false;
  document.addEventListener('DOMContentLoaded', () => {
    const orb = document.getElementById('orb-main');
    if (orb) orb.addEventListener('click', () => App.toggleVoice());
  });

  async function toggleVoice() {
    if (_voiceRunning) {
      _stopVoice();
    } else {
      await _startVoice();
    }
  }

  async function _startVoice() {
    /* Voice (Gemini Live WebSocket) is Gemini-only. If the user has
       chosen Groq/OpenAI, don't open the socket — keep text chat working
       and warmly explain in Mayra's voice. */
    if (Storage.getProvider() !== 'gemini') {
      showToast('Awaaz wali baat abhi sirf Gemini key se hoti hai — Gemini chuno toh main bol paungi ❤️');
      return;
    }

    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      showToast('❤️ Pehle Settings mein Gemini API key daalo.');
      showScreen('settings');
      return;
    }

    _voiceRunning = true;
    _setOrbState('connecting');

    /* Wire up voice events */
    GeminiVoice.onStatus(({ state }) => {
      _setOrbState(state);
    });

    GeminiVoice.onTranscript(({ role, text }) => {
      if (!text) return;
      if (role === 'user') {
        console.log('[Voice] User said:', text);
        /* Persist user speech so voice <-> chat share the same context */
        Storage.appendMessage('user', text);
      } else {
        _lastMayraMsg = text;
        console.log('[Voice] Mayra said:', text);
        /* Persist Mayra's reply in history */
        Storage.appendMessage('model', text);
      }
    });

    GeminiVoice.onFunctionCall(async ({ name, args, callId }) => {
      _setOrbState('thinking');
      const result = await MayraFunctions.execute(name, args);
      GeminiVoice.sendFunctionResult(callId, name, result);
      showToast(MayraFunctions.buildFollowUpPrompt(name, args, result));
    });

    GeminiVoice.onError(({ message }) => {
      _voiceRunning = false;
      _setOrbState('error');
      showToast(message);
      setTimeout(() => _setOrbState('idle'), 3000);
    });

    await GeminiVoice.start(apiKey, MAYRA_SYSTEM_PROMPT);
  }

  function _stopVoice() {
    _voiceRunning = false;
    GeminiVoice.stop();
    _setOrbState('idle');
  }

  /* ════════════════════════════════════════════════════
     CHAT
  ════════════════════════════════════════════════════ */
  function _initChatIfEmpty() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    /* Only add greeting if chat is fresh */
    if (container.querySelectorAll('.msg-row').length === 0) {
      const name = Storage.getUsername();
      const greeting = `Heyy ${name}! 🌸 Main Mayra hoon — tumhari apni dost. Bolo, kya chal raha hai aajkal? Kuch achha hua ya kuch share karna chahte ho?`;
      _appendChatBubble('mayra', greeting);
      _lastMayraMsg = greeting;
    }
  }

  function _appendChatBubble(role, text, skipScroll = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (role === 'mayra') {
      row.innerHTML = `
        <div class="chat-avatar small">M</div>
        <div>
          <div class="msg-bubble">${_escapeHtml(text)}</div>
          <div class="msg-time">${timeStr}</div>
        </div>`;
    } else {
      row.innerHTML = `
        <div>
          <div class="msg-bubble">${_escapeHtml(text)}</div>
          <div class="msg-time" style="text-align:right">${timeStr}</div>
        </div>`;
    }

    container.appendChild(row);
    if (!skipScroll) {
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }
  }

  function _showTyping(show) {
    const el = document.getElementById('chat-typing');
    if (el) el.classList.toggle('hidden', !show);
    if (show) {
      const container = document.getElementById('chat-messages');
      setTimeout(() => { if (container) container.scrollTop = container.scrollHeight; }, 50);
    }
  }

  async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      _appendChatBubble('mayra', 'Mujhe thoda setup chahiye pehle — apna Gemini API key Settings mein dena hoga. Phir hum khulke baat kar sakte hain! 🔑');
      return;
    }

    input.value = '';
    autoResizeTextarea(input);

    _appendChatBubble('user', text);
    _showTyping(true);

    const result = await GeminiChat.send(text, apiKey, MAYRA_SYSTEM_PROMPT);

    _showTyping(false);

    if (result.ok) {
      _lastMayraMsg = result.text;
      _appendChatBubble('mayra', result.text);
      _updateStats();

      /* If a function ran, show a toast */
      if (result.functionResults?.length > 0) {
        for (const { fc, result: r } of result.functionResults) {
          showToast(MayraFunctions.buildFollowUpPrompt(fc.name, fc.args || {}, r));
        }
      }
    } else {
      _appendChatBubble('mayra', result.message || 'Kuch samajh nahi aaya yaar, phir bolo?');
    }
  }

  function sendQuickPrompt(text) {
    /* Switch to chat mode and send the prompt */
    setMode('chat');
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = text;
      sendChatMessage();
    }
  }

  function chatKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  }

  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  /* Speak last message in voice */
  async function speakLastMessage() {
    if (!_lastMayraMsg) return;
    const apiKey = Storage.getApiKey();
    if (apiKey) await GeminiChat.speakText(_lastMayraMsg, apiKey);
    showToast('🔊 Voice mode mein jaao Mayra ki awaaz sunne ke liye.');
  }

  /* Chat mic button */
  function toggleChatVoice() {
    _chatVoiceOn = !_chatVoiceOn;
    const btn = document.getElementById('chat-mic-btn');
    if (btn) btn.classList.toggle('active', _chatVoiceOn);

    if (_chatVoiceOn) {
      showToast('🎤 Bol raha hun — Voice mode use karo main screen par.');
    }
  }

  /* ════════════════════════════════════════════════════
     SETTINGS
  ════════════════════════════════════════════════════ */
  /* Human-friendly provider labels for warm Hinglish copy. */
  const PROVIDER_LABELS = { gemini: 'Gemini', groq: 'Groq', openai: 'ChatGPT (OpenAI)' };
  function _providerLabel(p) { return PROVIDER_LABELS[p] || 'Gemini'; }

  function _keyPlaceholder(provider) {
    const label = _providerLabel(provider);
    return Storage.hasApiKey(provider)
      ? '••••••••••••••••••••• (set hai)'
      : `Apna ${label} API key daalo...`;
  }

  function _prefillSettings() {
    const provider = Storage.getProvider();

    const providerSel = document.getElementById('settings-provider');
    if (providerSel) providerSel.value = provider;

    const keyInput = document.getElementById('settings-api-key');
    if (keyInput) {
      keyInput.value = '';
      keyInput.placeholder = _keyPlaceholder(provider);
    }

    const statusEl = document.getElementById('settings-api-status');
    if (statusEl) {
      if (Storage.hasApiKey(provider)) {
        statusEl.textContent = `✅ ${_providerLabel(provider)} key set hai`;
        statusEl.className = 'api-status-msg success';
      } else {
        statusEl.textContent = '';
        statusEl.className = 'api-status-msg';
      }
    }

    const userInput = document.getElementById('settings-username');
    if (userInput) userInput.value = Storage.getUsername();

    const darkToggle = document.getElementById('toggle-dark-mode');
    if (darkToggle) darkToggle.checked = Storage.getDarkMode();

    /* Permission status */
    _updatePermissionStatus();
  }

  /* Seed the onboarding provider select from storage and set the key-input
     placeholder to match — mirrors how _prefillSettings seeds #settings-provider,
     so the onboarding UI stays honest for a returning user. */
  function _seedOnboardProvider() {
    const provider = Storage.getProvider();

    const providerSel = document.getElementById('onboard-provider');
    if (providerSel) providerSel.value = provider;

    const keyInput = document.getElementById('onboard-api-key');
    if (keyInput) keyInput.placeholder = `Apna ${_providerLabel(provider)} API key yahan daalo...`;
  }

  function clearApiKey() {
    Storage.clearApiKey();
    const keyInput = document.getElementById('settings-api-key');
    if (keyInput) keyInput.placeholder = 'Apna Gemini API key daalo...';
    const statusEl = document.getElementById('settings-api-status');
    if (statusEl) { statusEl.textContent = 'Key remove ho gaya.'; statusEl.className = 'api-status-msg'; }
    showToast('API key remove ho gaya.');
    _stopVoice();
  }

  function saveUsername() {
    const input = document.getElementById('settings-username');
    if (!input) return;
    const name = input.value.trim() || 'Priya';
    Storage.setUsername(name);
    _updateGreeting(name);
    const pName = document.getElementById('profile-name');
    if (pName) pName.textContent = name;
    showToast(`Naam save ho gaya: ${name} 😊`);
  }

  function toggleDarkMode(enabled) {
    Storage.setDarkMode(enabled);
    if (enabled) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function openSystemSettings() {
    AndroidBridge.openSystemSettings();
  }

  async function _updatePermissionStatus() {
    const micEl      = document.getElementById('perm-mic');
    const locationEl = document.getElementById('perm-location');

    if (micEl) {
      /* Prefer live native state; fall back to persisted (storage key is 'mic'). */
      let micState = await AndroidBridge.checkPermission('microphone');
      if (micState === 'unknown') micState = Storage.getPermission('mic') || 'unknown';
      micEl.textContent = _permLabel(micState);
      micEl.className   = `perm-status ${_permClass(micState)}`;
    }
    if (locationEl) {
      let state = await AndroidBridge.checkPermission('location');
      if (state === 'unknown') state = Storage.getPermission('location');
      locationEl.textContent = _permLabel(state);
      locationEl.className   = `perm-status ${_permClass(state)}`;
    }
  }

  function _permLabel(state) {
    if (state === 'granted') return '✅ Allowed';
    if (state === 'denied')  return '❌ Denied';
    return '❓ Unknown';
  }
  function _permClass(state) {
    if (state === 'granted') return 'granted';
    if (state === 'denied')  return 'denied';
    return 'unknown';
  }

  /* ════════════════════════════════════════════════════
     PROFILE / MISC
  ════════════════════════════════════════════════════ */
  function editName() {
    const current = Storage.getUsername();
    const newName = prompt('Apna naam batao:', current);
    if (newName && newName.trim()) {
      Storage.setUsername(newName.trim());
      _updateGreeting(newName.trim());
      const pName = document.getElementById('profile-name');
      if (pName) pName.textContent = newName.trim();
      showToast(`Naam update ho gaya: ${newName.trim()} 💕`);
    }
  }

  function _updateGreeting(name) {
    const el = document.getElementById('home-greeting-text');
    if (el) el.textContent = `Hello ${name} ❤️`;
  }

  function _updateStats() {
    const daysEl  = document.getElementById('stat-days');
    const chatsEl = document.getElementById('stat-chats');
    if (daysEl)  daysEl.textContent  = Storage.getInstallDays();
    if (chatsEl) chatsEl.textContent = Storage.getChatCount();
  }

  /* ════════════════════════════════════════════════════
     API KEY VISIBILITY TOGGLE
  ════════════════════════════════════════════════════ */
  function toggleApiKeyVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  /* ════════════════════════════════════════════════════
     TOAST
  ════════════════════════════════════════════════════ */
  function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (_toastTimer) clearTimeout(_toastTimer);

    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    _toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 350);
    }, duration);
  }

  /* ════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════ */
  function showComingSoon(feature) {
    showToast(`${feature} — Jaldi aa raha hai! ✨`);
  }

  function _showFieldError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'api-status-msg error';
  }

  function _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  /* ════════════════════════════════════════════════════
     EXPORT PUBLIC API
  ════════════════════════════════════════════════════ */
  return {
    init,
    /* Screen */
    showScreen, hideScreen,
    /* Onboarding */
    onboardNext, validateAndSaveApiKey, onProviderChange, skipApiKey,
    requestMicPermission, requestLocationPermission,
    requestPermissionFromSettings, finishOnboarding,
    /* Nav */
    switchTab, setMode, goBackHome,
    /* Voice */
    toggleVoice,
    /* Chat */
    sendChatMessage, sendQuickPrompt, chatKeyDown, autoResizeTextarea,
    speakLastMessage, toggleChatVoice,
    /* Settings */
    clearApiKey, saveUsername, toggleDarkMode, openSystemSettings,
    toggleApiKeyVisibility,
    /* Profile */
    editName,
    /* Utils */
    showToast, showComingSoon,
  };

})();

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => App.init());

/* ── Service Worker registration (offline / PWA install) ──
   Only registers over http(s). Under Capacitor's file:// scheme
   the WebView bundles assets natively, so SW isn't needed there. */
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.protocol === 'http:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[SW] registered:', reg.scope))
      .catch((err) => console.warn('[SW] registration failed:', err));
  });
}
