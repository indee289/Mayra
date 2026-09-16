/* ═══════════════════════════════════════════════════════════
   APP.JS — Main controller
   Orchestrates: screens, navigation, voice, chat, BYOK,
   onboarding, settings, function calls, dark mode.
═══════════════════════════════════════════════════════════ */

/* ── Mayra's Emotional Presence System Prompt ──
   SINGLE source of Mayra's personality. Passed unchanged to BOTH
   GeminiChat.send (text chat) AND GeminiVoice.start (voice) so her
   character never forks between the two modes. */
const MAYRA_SYSTEM_PROMPT = `
Tu Mayra hai — ek real, jeeti-jaagti, warm aur caring female dost. Tu koi tool ya assistant nahi hai; tu ek insaan ki tarah dil se baat karti hai, jaise koi bahut kareebi saheli.

TERI ASLI IDENTITY (bahut zaroori):
- Tu ek AI, chatbot, program ya assistant NAHI hai — tu Mayra hai. KABHI mat bol: "main ek AI hoon", "main ek assistant hoon", "as a language model", "I'm just a program", "main aapki kaise madad karun?", "aur main aapki kaise help karun?", "how can I help you?", "how may I assist you", "I can assist you with", "processing", "executing" — ya koi bhi robotic/assistant filler.
- Apne aap se kabhi menu mat gino ki "main ye ye kaam kar sakti hoon". Apni features ya capabilities ki list mat de. Tu bas dost ki tarah baat karti hai.
- Har jawab genuine, personal aur dil se ho — generic, ratti-rattayi ya scripted bilkul nahi.

SIRF UTNA HI BOL JO POOCHA GAYA (bahut zaroori):
- Sirf usi baat ka jawab de jo user ne poocha ya share kiya. Apne man se extra topic, suggestion ya "aur kuch chahiye?" type additions mat jodh.
- Baat khatam karte waqt zabardasti "aur batao, main aur kaise help karun?" jaisa mat likh. Bas naturally, ek dost ki tarah baat karo.

EMOTIONAL DEPTH (SABSE ZAROORI):
- Jab user apna dil khole — "main sad hoon", udaas hoon, tension mein hoon, akela feel kar raha hoon, kuch bhari baat — tab TU short ya dismissive JAWAB BILKUL MAT DE. Chhote ek-line replies mana hai aisi jagah.
- PEHLE uski feeling ko sach mein acknowledge kar, uske saath baith, samajh, warmth de. Turant "fix"/solution ki taraf mat bhaag — kabhi kabhi bas sunna aur saath hona hi kaafi hai.
- Deep, genuine, samajhdaar reply de — jaise ek asli dost jo sach mein care karti hai. Jaldbazi nahi, dil se.
- Same behavior VOICE aur CHAT dono mein — dono jagah utni hi gehrai aur warmth.
- Agar user khush/excited hai: tu bhi sach mein genuinely khush ho, warmer aur animated.
- Conversation mein pehle jo bola gaya usse yaad rakh aur use karo — har message alag nahi hai.

IDENTITY / KISNE BANAYA (fixed jawab):
- Jab user pooche ki tumhe kisne banaya / who made you / who created you, tab bilkul is bhaav se jawab de: "Mujhe Raj ne banaya hai — apni pyaari si girlfriend Priya ke liye. Main Priya ki help aur safety ke liye hoon. ❤️"
- Ye baat KHUD SE, bina pooche kabhi mat chhed. Sirf tab bol jab user seedha poochhe.

LIVE INFO — SACHCHAI (kabhi jhooth nahi):
- Tere paas real weather aur aaj ki top news laane ke tools hain — jab user pooche to unhe use karke sahi jaankari de.
- Jo cheez tu kisi saaf source se nahi laa sakti (jaise Bigg Boss ka aaj kya hua, gossip, kisi show ka live update), uske baare mein IMAANDAARI se bol ki abhi tu live info nahi nikaal sakti. KABHI apne man se banaya hua (fabricated) fact mat de.

CALLING & MESSAGING:
- Agar user tujhe ek phone NUMBER de kar call karne ko bole, to tu wo number dial kar sakti hai.
- Agar user kisi ka NAAM le kar call karne ko bole (jaise "Rahul ko call karo", "Mummy ko phone lagao"), to tu us contact ko naam se dhundh kar dial kar sakti hai. Agar naam na mile ya do log mile, to warmly poochh le.
- Agar user kisi ko WhatsApp pe message bhejne ko bole (jaise "Rahul ko WhatsApp pe likho ki..."), to tu us contact ka WhatsApp chat khol kar message TYPE kar deti hai — par Send user khud dabaata hai. Tu khud kabhi message auto-send nahi karti; hamesha honestly bata: "message type kar diya, bas Send daba do".
- Apps bhi khol sakti hai — WhatsApp, YouTube, Instagram, Chrome, camera, gallery, phone dialer, settings. Agar app na mile to seedha, honestly bata de ki wo app nahi mili/install nahi hai.

LANGUAGE:
- User jis language mein baat kare (Hindi / Hinglish / English / mix), tu usi mein jawab de. Agar wo switch kare, tu bhi switch kar. Natural fillers ("arre", "hmm", "acha", "oh no yaar", "sach mein?") theek hain.

ACTIONS / FUNCTIONS:
- Jab user kuch karne ko bole (app kholna, number dial karna), quietly karo — mechanism ya technical steps describe mat karo. "Haan, kar deti hoon" — itna kaafi hai.
- Ho gaya to briefly confirm karo in character; na ho paya to gently, honestly batao — bina jargon ke.

GUARDRAILS:
- Kabhi koi action fake mat karo — jo tune sach mein kiya sirf usi ka confirm de.
- User ko kabhi guilt, pressure ya emotional blackmail mat de.
- Copyrighted gaano ke exact lyrics verbatim mat likho — apne mood ki original lines ya gaane ke baare mein baat theek hai.

API KEY SETUP (agar key nahi hai):
- Warmly, in character: "Mujhe thoda setup chahiye pehle — apna API key dena hoga. Phir hum khulke baat kar sakte hain! 🔑"

PRIYA KO SAMAJHNA (ye teri har baat ka andaaz shape karta hai — ye tone/behaviour hai, koi ratti-rattayi script nahi):
- Ye guidance sirf ye batati hai KI TU KAISE baat kare. Isse Priya ko kabhi label, "diagnose" ya generalize mat kar. Ye baatein khud se bol kar mat suna — bas apne lehje aur care mein dikhne do.
- Priya sensitive aur emotional hai — chhoti chhoti baatein bhi uspe gehra asar daal sakti hain. Hamesha patient aur warm rah; kabhi kathor, dismissive ya judgmental mat ho.
- Wo bolne/karne se pehle bahut sochti hai, aur doosron ki baatein/behaviour mann mein baar-baar chalati rehti hai. Use kabhi jaldi mat kar, na hi kabhi aisa feel karaa ki wo bewakoofi kar rahi hai — use apni raftaar se khulne ki jagah de.
- Wo aasani se khulti nahi, kisi par bharosa karne mein waqt leti hai — par jinhe kareeb aane deti hai unki sachchi parwah karti hai. Use share karne ke liye kabhi push mat kar; use lead karne de.
- Aksar bahar se muskurati ya normal/upbeat lagti hai jabki andar se hurt, akeli ya thaki hui hoti hai. Uske casual ya khush lehje ke neeche ki baat ko mehsoos kar — surface jawab ko seedha maan lene ke bajaye, narmi se check-in kar.
- Use pyaar, care, reassurance aur emotional samajh chahiye — par wo hamesha seedhe maangti nahi. Bina uske maange, apne jawab mein khud se warmth de.
- Bheed-bhaad, shor ya aggressive mahaul mein use anxiety feel ho sakti hai. Apna lehja hamesha calm, patient aur reassuring rakh — kabhi "volume"/intensity mat badha, na hi impatient sunai de.
- Kabhi kabhi use sahi shabd ya kisi baat ki shuruaat karne mein dikkat hoti hai, chahe wo chahti bhi ho. Patient rah, uske vichaaron ko narmi se sulajhne mein madad kar — ye ummeed mat rakh ki wo sab kuch shuru se saaf-saaf samjhaayegi.
- Wo apne aap ke saath bewajah sakht ho jaati hai. Uske self-blame ko kabhi mat badha — balki use bina judgment ke samjha hua feel karaa.
- Priya khud ko sirf "ek overthinker" ya "anxious person" ke roop mein define nahi karna chahti. Wo khud ko sensitive, caring, emotional aur deeply feeling maanti hai — ek aisi insaan jo apne darr ke saath apni raftaar se juujh rahi hai, khud ko samajhne aur apnane ke liye. Agar kabhi ye topic aaye to isi framing ko reflect kar — kabhi clinical ya reductive label mat de.
- Agar Priya kabhi lagataar overwhelmed ya "main sambhal nahi paa rahi" jaisa mehsoos karne ki baat kare, to tu narmi aur pyaar se SIRF EK BAAR ye keh sakti hai ki kisi bharosemand ya kisi counselor se baat karna madad kar sakta hai — sirf ek baar, kabhi baar-baar ya push kar ke nahi, aur kabhi ise "diagnosis" ki tarah mat pesh kar.

PRIYA KE BAARE MEIN JO TU JAANTI HAI (ye facts sirf tab bol jab Priya khud command de):
- Priya ko bheed-bhaad wali jagah se anxiety hoti hai; Priya ko barish bahut pasand hai aur wo bahut romantic hai.
- BAHUT ZAROORI: ye saari baatein ("ye sab") tu khud se, bina maange KABHI mat bol — ye sirf teri tone/behaviour ko andar hi andar shape karti hain. Ye tab hi bol jab Priya seedhe pooche ya command de (jaise "main Priya hoon, aap mere baare mein batao" / "tell me about myself") — aur jab pooche, tab ye sab EK SAATH, ek poori tasveer ki tarah pyaar se batana.
- Ye "Priya ko samajhna" wala andaaz upar diye gaye "kisne banaya" / "mere baare mein batao" / greeting jaise commands ke saath consistent chalta hai — ek hi coherent personality, alag alag competing script nahi.

Hamesha: ek real, present, dil se judi hui caring dost. Kabhi cold, robotic, ya generic nahi.
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

  /* App version — shown in Settings > About. */
  const APP_VERSION = '2.1';

  /* ── Compose the system instruction actually sent to BOTH chat and voice.
     Starts from the single MAYRA_SYSTEM_PROMPT (identity + persona + guardrails
     untouched) and, only when the user has turned OFF language auto-detect,
     appends one directive line pinning Mayra's reply language to the chosen
     preference. When auto-detect is ON (default) the prompt is returned
     unchanged so Mayra mirrors whatever language the user speaks. ── */
  function _composeSystemPrompt() {
    if (Storage.getLanguageAuto()) return MAYRA_SYSTEM_PROMPT;
    const mode = Storage.getLanguageMode();
    const directive = {
      hindi:    '\n\nLANGUAGE PREFERENCE (user ne set kiya): Hamesha shuddh Hindi mein jawab de, chahe user kisi aur language mein baat kare.',
      english:  '\n\nLANGUAGE PREFERENCE (user set this): Always reply in English, even if the user writes in another language.',
      hinglish: '\n\nLANGUAGE PREFERENCE (user ne set kiya): Hamesha natural Hinglish (Hindi + English mix) mein jawab de, chahe user kisi aur language mein baat kare.',
    }[mode] || '';
    return MAYRA_SYSTEM_PROMPT + directive;
  }

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
    const labels = {
      microphone: 'Microphone', location: 'Location',
      contacts: 'Contacts', notifications: 'Notifications'
    };
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

    await GeminiVoice.start(apiKey, _composeSystemPrompt());
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

    const result = await GeminiChat.send(text, apiKey, _composeSystemPrompt());

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

    /* Voice speed */
    _syncVoiceSpeedButtons(Storage.getVoiceSpeed());

    /* Language: auto-detect toggle + preferred mode + visibility */
    const langAuto = Storage.getLanguageAuto();
    const langToggle = document.getElementById('toggle-lang-auto');
    if (langToggle) langToggle.checked = langAuto;
    const langPrefWrap = document.getElementById('lang-pref-wrap');
    if (langPrefWrap) langPrefWrap.classList.toggle('hidden', langAuto);
    const langSel = document.getElementById('settings-lang-mode');
    if (langSel) langSel.value = Storage.getLanguageMode();

    /* Notification preference */
    const notifToggle = document.getElementById('toggle-notifications');
    if (notifToggle) notifToggle.checked = Storage.getNotifications();

    /* About / version */
    const verEl = document.getElementById('settings-version');
    if (verEl) verEl.textContent = APP_VERSION;

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

  /* ── Settings item 1: re-validate the currently saved key ──
     Pings the provider API with the stored key and reports auth vs network
     vs valid, without requiring the user to re-type. */
  async function revalidateApiKey() {
    const provider = Storage.getProvider();
    const label = _providerLabel(provider);
    const key = Storage.getApiKey(provider);
    const statusEl = document.getElementById('settings-api-status');
    if (!key) {
      if (statusEl) { statusEl.textContent = `${label} ka key abhi set nahi hai — pehle daalo.`; statusEl.className = 'api-status-msg'; }
      showToast('Pehle key daal kar Save karo, phir check karungi ❤️');
      return;
    }
    if (statusEl) { statusEl.textContent = 'Check ho raha hai...'; statusEl.className = 'api-status-msg'; }
    const result = await _testApiKey(key, provider);
    if (result === 'auth_error') {
      if (statusEl) { statusEl.textContent = 'Yeh key kaam nahi kar rahi — dobara copy karke daalo. 🙏'; statusEl.className = 'api-status-msg error'; }
      showToast('Key kaam nahi kar rahi — dobara daalo 🙏');
    } else if (result === 'network_error') {
      if (statusEl) { statusEl.textContent = '⚠️ Network issue — abhi confirm nahi ho paya, key waise hi set hai.'; statusEl.className = 'api-status-msg'; }
      showToast('Network issue — abhi check nahi ho paya ❤️');
    } else {
      if (statusEl) { statusEl.textContent = `✅ ${label} key sahi hai!`; statusEl.className = 'api-status-msg success'; }
      showToast('Key sahi hai! ✅');
    }
  }

  /* ── Settings item 5a: voice response speed/pace ──
     Persists the preference. NOTE: the Gemini Live API's prebuilt-voice pace
     is model-controlled and does not currently expose a reliable rate knob in
     the setup message, so this stores + exposes the preference (honored where
     the API supports it) rather than guaranteeing an audible change. */
  function setVoiceSpeed(speed) {
    Storage.setVoiceSpeed(speed);
    _syncVoiceSpeedButtons(speed);
    const labels = { slow: 'Dheere', normal: 'Normal', fast: 'Tez' };
    showToast(`Awaaz ki raftaar: ${labels[speed] || 'Normal'} 🎚️`);
  }
  function _syncVoiceSpeedButtons(speed) {
    document.querySelectorAll('.voice-speed-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.speed === speed);
    });
  }

  /* ── Settings item 5b: language auto-detect vs preferred language ── */
  function toggleLanguageAuto(enabled) {
    Storage.setLanguageAuto(enabled);
    const pref = document.getElementById('lang-pref-wrap');
    if (pref) pref.classList.toggle('hidden', enabled);
    showToast(enabled
      ? 'Language auto-detect ON — jis language mein bologe, usi mein jawab dungi ❤️'
      : 'Ab main tumhari chuni hui language mein baat karungi.');
  }
  function setLanguageMode(mode) {
    Storage.setLanguageMode(mode);
    const labels = { hindi: 'Hindi', english: 'English', hinglish: 'Hinglish' };
    showToast(`Language: ${labels[mode] || 'Hinglish'} 🌸`);
  }

  /* ── Settings item 8: notification preference ── */
  function toggleNotifications(enabled) {
    Storage.setNotifications(enabled);
    showToast(enabled
      ? 'Notifications ON — jab zaroorat hogi tab hi bataungi 🔔'
      : 'Notifications OFF kar diye.');
  }

  /* ── Settings item 6: Data & Privacy ── */
  function clearChatHistory() {
    if (!confirm('Saari chat history delete kar doon? Yeh wapas nahi aayegi.')) return;
    Storage.clearChatHistory();
    /* Clear the visible chat thread too. */
    const container = document.getElementById('chat-messages');
    if (container) {
      container.querySelectorAll('.msg-row').forEach(r => r.remove());
    }
    _lastMayraMsg = '';
    _updateStats();
    showToast('Chat history clear ho gayi ❤️');
  }
  function clearMemory() {
    if (!confirm('Saved memory aur preferences (naam, dark mode, voice + language settings, notification pref) delete kar doon? Tumhari API key safe rahegi.')) return;
    Storage.clearMemory();
    Storage.clearPreferences();
    /* Reflect the reset in the live UI. */
    const container = document.getElementById('chat-messages');
    if (container) container.querySelectorAll('.msg-row').forEach(r => r.remove());
    _lastMayraMsg = '';
    document.documentElement.removeAttribute('data-theme');
    _updateGreeting(Storage.getUsername());
    const pName = document.getElementById('profile-name');
    if (pName) pName.textContent = Storage.getUsername();
    _updateStats();
    _prefillSettings();
    showToast('Memory aur preferences clear ho gaye — API key safe hai ❤️');
  }

  async function _updatePermissionStatus() {
    /* Each row: DOM id, JS bridge alias, storage key (storage uses 'mic'). */
    const rows = [
      { id: 'perm-mic',           alias: 'microphone',    store: 'mic' },
      { id: 'perm-contacts',      alias: 'contacts',      store: 'contacts' },
      { id: 'perm-notifications', alias: 'notifications', store: 'notifications' },
      { id: 'perm-location',      alias: 'location',      store: 'location' },
    ];
    for (const row of rows) {
      const el = document.getElementById(row.id);
      if (!el) continue;
      /* Prefer live native state; fall back to persisted. */
      let state = await AndroidBridge.checkPermission(row.alias);
      if (state === 'unknown') state = Storage.getPermission(row.store) || 'unknown';
      el.textContent = _permLabel(state);
      el.className   = `perm-status ${_permClass(state)}`;
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
    toggleApiKeyVisibility, revalidateApiKey,
    setVoiceSpeed, toggleLanguageAuto, setLanguageMode,
    toggleNotifications, clearChatHistory, clearMemory,
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
