/* ═══════════════════════════════════════════════════════════
   ANDROID BRIDGE — Native action execution
   Detects whether a native WebView/Capacitor bridge is
   available and routes actions through it, falling back to
   safe browser/deep-link equivalents.

   For a Capacitor build: implement the matching native plugin
   exposing window.MayraAndroid with these methods.
   For a plain WebView build: inject the bridge via
   WebView.addJavascriptInterface().
═══════════════════════════════════════════════════════════ */
const AndroidBridge = (() => {

  /* ── Bridge detection ── */
  function _native() {
    /* Capacitor plugin  */
    if (window.Capacitor?.Plugins?.MayraAndroid) return window.Capacitor.Plugins.MayraAndroid;
    /* Raw WebView injection */
    if (window.MayraAndroid) return window.MayraAndroid;
    return null;
  }
  const isNative = () => !!_native();

  /* ── openApp ──────────────────────────────────────────── */
  async function openApp(appName) {
    const name = appName.toLowerCase().trim();
    const bridge = _native();

    if (bridge) {
      try {
        await bridge.openApp({ appName: name });
        return { success: true };
      } catch (e) {
        console.warn('[Bridge] openApp failed:', e);
      }
    }

    /* Browser deep-link fallbacks */
    const deepLinks = {
      whatsapp:   'whatsapp://',
      youtube:    'vnd.youtube://',
      instagram:  'instagram://',
      chrome:     'googlechrome://',
      maps:       'comgooglemaps://',
      spotify:    'spotify://',
      twitter:    'twitter://',
      facebook:   'fb://',
      snapchat:   'snapchat://',
      gmail:      'googlegmail://',
      settings:   'app-settings:',
    };
    const playStore = {
      whatsapp:  'com.whatsapp',
      youtube:   'com.google.android.youtube',
      instagram: 'com.instagram.android',
      chrome:    'com.android.chrome',
      spotify:   'com.spotify.music',
    };

    for (const [key, link] of Object.entries(deepLinks)) {
      if (name.includes(key)) {
        return _tryDeepLink(link, playStore[key]);
      }
    }

    /* Generic web URL fallback for unknown apps */
    if (name.includes('browser') || name.includes('chrome')) {
      window.open('https://www.google.com', '_blank');
      return { success: true };
    }

    return { success: false, reason: 'not_found' };
  }

  /* ── openWhatsApp ─────────────────────────────────────── */
  async function openWhatsApp() {
    return openApp('whatsapp');
  }

  /* ── openUrl ──────────────────────────────────────────── */
  async function openUrl(url) {
    const bridge = _native();
    if (bridge) {
      try { await bridge.openUrl({ url }); return { success: true }; } catch {}
    }
    window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
    return { success: true };
  }

  /* ── makeCall ─────────────────────────────────────────── */
  async function makeCall(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const bridge = _native();

    if (bridge) {
      try {
        await bridge.makeCall({ phoneNumber: cleaned });
        return { success: true };
      } catch (e) {
        console.warn('[Bridge] makeCall failed, falling back:', e);
      }
    }

    /* tel: fallback — opens dialer pre-filled */
    window.location.href = `tel:+${cleaned}`;
    return { success: true, method: 'tel_link' };
  }

  /* ── callContact ──────────────────────────────────────── */
  async function callContact(contactName) {
    const bridge = _native();
    if (!bridge) {
      return { success: false, reason: 'contacts_unavailable_in_browser' };
    }

    try {
      const result = await bridge.callContact({ name: contactName });
      if (result.matches && result.matches.length > 1) {
        return { success: false, reason: 'multiple_matches', matches: result.matches };
      }
      if (result.matches && result.matches.length === 0) {
        return { success: false, reason: 'no_match' };
      }
      return { success: true, calledNumber: result.calledNumber };
    } catch (e) {
      return { success: false, reason: 'bridge_error', error: e.message };
    }
  }

  /* ── requestPermission ────────────────────────────────── */
  async function requestPermission(permName) {
    const bridge = _native();
    if (bridge) {
      try {
        const result = await bridge.requestPermission({ permission: permName });
        return result.granted;
      } catch {}
    }

    /* Web — use the Permissions API where possible */
    if (permName === 'microphone') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
      } catch { return false; }
    }
    if (permName === 'location') {
      /* Prompt the browser for a real geolocation fix */
      if (navigator.geolocation) {
        return new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 10000 }
          );
        });
      }
      return false;
    }
    /* Contacts + accessibility not accessible on web */
    return false;
  }

  async function checkPermission(permName) {
    /* Native pass-through first */
    const bridge = _native();
    if (bridge) {
      try {
        const result = await bridge.checkPermission({ permission: permName });
        return result.status; // 'granted' | 'denied' | 'prompt'
      } catch {}
    }

    /* Web fallbacks via the Permissions API */
    if (permName === 'microphone') {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' });
        return status.state; // 'granted' | 'denied' | 'prompt'
      } catch { return 'unknown'; }
    }
    if (permName === 'location') {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state; // 'granted' | 'denied' | 'prompt'
      } catch { return 'unknown'; }
    }
    /* Contacts + accessibility have no web equivalent */
    return 'unknown';
  }

  /* ── openAccessibilitySettings ────────────────────────── */
  async function openAccessibilitySettings() {
    const bridge = _native();
    if (bridge) {
      try { await bridge.openAccessibilitySettings(); return { success: true }; } catch {}
    }
    App.showToast('Accessibility toh device ki Settings mein jaake khud se on karna padega, meri jaan.');
    return { success: false, reason: 'unavailable_on_web' };
  }

  /* ── isAccessibilityEnabled ───────────────────────────── */
  async function isAccessibilityEnabled() {
    const bridge = _native();
    if (bridge) {
      try {
        const result = await bridge.isAccessibilityEnabled();
        return !!result.enabled;
      } catch {}
    }
    return false;
  }

  function openSystemSettings() {
    const bridge = _native();
    if (bridge) {
      try { bridge.openSettings(); return; } catch {}
    }
    App.showToast('System settings yahan se nahi khulta — device settings mein jaao manually.');
  }

  /* ── Helper ── */
  function _tryDeepLink(link, packageId) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = link;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 1500);

    if (packageId) {
      setTimeout(() => {
        window.open(`https://play.google.com/store/apps/details?id=${packageId}`, '_blank');
      }, 2000);
    }
    return { success: true, method: 'deep_link' };
  }

  return {
    isNative,
    openApp,
    openWhatsApp,
    openUrl,
    makeCall,
    callContact,
    requestPermission,
    checkPermission,
    openAccessibilitySettings,
    isAccessibilityEnabled,
    openSystemSettings,
  };
})();
