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

  const ONBOARD_SLIDES = ['welcome', 'apikey', 'mic', 'contacts', 'done'];
  let _onboardIdx = 0;

  /* ════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════ */
  function init() {
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

    const provider = Storage.getProvider();

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

  /* Provider-aware key validator.
     Returns one of: 'valid' | 'auth_error' | 'network_error'.
     A thrown fetch / transport failure is ALWAYS 'network_error' — never
     'invalid'. FEAT-002 will add groq/openai (Bearer-auth) branches. */
  async function _testApiKey(key, provider) {
    const prov = provider || Storage.getProvider();

    if (prov === 'gemini') {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] })
          }
        );
        /* 200 OK or 400 (reachable, key format acceptable) => valid.
           401/403 => genuine auth error. Anything else => treat as network. */
        if (res.ok || res.status === 400) return 'valid';
        if (res.status === 401 || res.status === 403) return 'auth_error';
        return 'network_error';
      } catch {
        return 'network_error';
      }
    }

    /* Unknown/other providers: don't hard-reject; let it save and verify
       later. FEAT-002 will implement real groq/openai validation. */
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

  async function requestContactsPermission() {
    const granted = await AndroidBridge.requestPermission('contacts');
    Storage.setPermission('contacts', granted ? 'granted' : 'denied');
    showToast(granted ? '📞 Contacts allow ho gaya!' : 'Contacts baad mein Settings mein allow kar sakte ho.');
    onboardNext();
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
  function _prefillSettings() {
    const keyInput = document.getElementById('settings-api-key');
    if (keyInput) {
      keyInput.value = '';
      keyInput.placeholder = Storage.hasApiKey()
        ? '••••••••••••••••••••• (set hai)'
        : 'Apna Gemini API key daalo...';
    }

    const userInput = document.getElementById('settings-username');
    if (userInput) userInput.value = Storage.getUsername();

    const darkToggle = document.getElementById('toggle-dark-mode');
    if (darkToggle) darkToggle.checked = Storage.getDarkMode();

    /* Permission status */
    _updatePermissionStatus();
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
    const contactsEl = document.getElementById('perm-contacts');

    if (micEl) {
      const micState = await AndroidBridge.checkPermission('microphone');
      micEl.textContent = _permLabel(micState);
      micEl.className   = `perm-status ${_permClass(micState)}`;
    }
    if (contactsEl) {
      const stored = Storage.getPermission('contacts');
      contactsEl.textContent = _permLabel(stored);
      contactsEl.className   = `perm-status ${_permClass(stored)}`;
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
    onboardNext, validateAndSaveApiKey, skipApiKey,
    requestMicPermission, requestContactsPermission, finishOnboarding,
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
