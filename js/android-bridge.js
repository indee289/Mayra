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
  /* DIAGNOSTICS: log a CALL entry to the on-screen debug panel capturing the
     number, whether the native path was used, the intent the native side
     used (ACTION_DIAL), success/failure and any error text. Guarded and
     non-throwing so logging never breaks dialing. Secrets are not involved. */
  function _logCall(rawText, ok) {
    try {
      if (window.MayraDebug && window.MayraDebug.log) {
        window.MayraDebug.log({
          tag: 'CALL',
          path: 'n/a',
          status: ok ? 'ok' : 'failed',
          ok: !!ok,
          rawText: rawText
        });
      }
    } catch (_) { /* logging must never break the call flow */ }
  }

  async function makeCall(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const native = isNative();
    const bridge = _native();

    if (bridge) {
      try {
        const result = (await bridge.makeCall({ phoneNumber: cleaned })) || {};
        const usedIntent = result.intent || 'ACTION_DIAL';
        const ok = result.success !== false; // treat missing success as ok (back-compat)
        _logCall(
          `makeCall number=${cleaned}, native=${native}, intent=${usedIntent}, `
          + `success=${ok}` + (result.error ? `, error=${result.error}` : ''),
          ok
        );
        if (ok) return { success: true, intent: usedIntent };
        /* Native reported a failure: surface it, then fall through to tel:. */
        return { success: false, intent: usedIntent, error: result.error };
      } catch (e) {
        const errText = (e && (e.message || String(e))) || 'bridge_threw';
        _logCall(`makeCall number=${cleaned}, native=${native}, bridge threw: ${errText}, falling back to tel:`, false);
        console.warn('[Bridge] makeCall failed, falling back:', e);
      }
    }

    /* tel: fallback — opens dialer pre-filled */
    _logCall(`makeCall number=${cleaned}, native=${native}, browser fallback path (window.location.href='tel:')`, true);
    window.location.href = `tel:+${cleaned}`;
    return { success: true, method: 'tel_link' };
  }

  /* ── callContact ──────────────────────────────────────── */
  async function callContact(contactName) {
    const native = isNative();
    const bridge = _native();
    if (!bridge) {
      _logCall(`callContact name="${contactName}", native=${native}, unavailable in browser`, false);
      return { success: false, reason: 'contacts_unavailable_in_browser' };
    }

    try {
      const result = await bridge.callContact({ name: contactName });
      const matches = result.matches || [];
      const perm = result.permission || 'granted';
      // Native crash-proof result: contacts permission was denied.
      if (result.permission === 'denied') {
        _logCall(`callContact name="${contactName}", native=${native}, permission=denied (contacts blocked)`, false);
        return { success: false, reason: 'permission_denied' };
      }
      if (matches.length === 0) {
        // Empty either because the contact truly isn't there, or a soft
        // native error occurred (result.error). Treat both as "no match"
        // so Mayra never surfaces a raw error string.
        _logCall(
          `callContact name="${contactName}", native=${native}, permission=${perm}, matches=0, dialed=false`
          + (result.error ? `, error=${result.error}` : ''),
          false
        );
        return { success: false, reason: 'no_match' };
      }
      if (matches.length > 1) {
        _logCall(`callContact name="${contactName}", native=${native}, permission=${perm}, matches=${matches.length}, dialed=false (multiple matches)`, false);
        return { success: false, reason: 'multiple_matches', matches };
      }
      _logCall(`callContact name="${contactName}", native=${native}, permission=${perm}, matches=1, dialed=true (intent=ACTION_DIAL)`, true);
      return { success: true, calledNumber: result.calledNumber };
    } catch (e) {
      // Bridge itself failed — degrade gracefully, no raw error to the user.
      const errText = (e && (e.message || String(e))) || 'bridge_threw';
      _logCall(`callContact name="${contactName}", native=${native}, bridge threw: ${errText}`, false);
      return { success: false, reason: 'no_match' };
    }
  }

  /* ── sendWhatsAppMessage ──────────────────────────────── */
  /* SAFE pre-fill only — opens the WhatsApp chat with the message typed;
     the user taps Send themselves. Params: { contactName?, phoneNumber?, message }.
     Returns { success, reason?, matches? }. Never auto-sends, never throws. */
  async function sendWhatsAppMessage({ contactName, phoneNumber, message } = {}) {
    const native = isNative();
    const bridge = _native();
    if (!bridge) {
      _logCall(`sendWhatsAppMessage name="${contactName || ''}", native=${native}, unavailable in browser`, false);
      return { success: false, reason: 'contacts_unavailable_in_browser' };
    }
    try {
      const args = { message: message || '' };
      if (phoneNumber) args.phoneNumber = String(phoneNumber);
      else if (contactName) args.name = contactName;
      const result = (await bridge.sendWhatsAppMessage(args)) || {};

      if (result.success) {
        _logCall(`sendWhatsAppMessage target="${phoneNumber || contactName}", native=${native}, prefilled=true (user taps Send)`, true);
        return { success: true, name: result.name };
      }
      const reason = result.reason || 'failed';
      if (reason === 'denied' || result.permission === 'denied') {
        _logCall(`sendWhatsAppMessage name="${contactName}", native=${native}, permission=denied`, false);
        return { success: false, reason: 'permission_denied' };
      }
      if (reason === 'ambiguous') {
        _logCall(`sendWhatsAppMessage name="${contactName}", native=${native}, ambiguous matches=${(result.matches || []).length}`, false);
        return { success: false, reason: 'multiple_matches', matches: result.matches || [] };
      }
      if (reason === 'no_match') {
        _logCall(`sendWhatsAppMessage name="${contactName}", native=${native}, no_match`, false);
        return { success: false, reason: 'no_match' };
      }
      if (reason === 'whatsapp_not_found') {
        _logCall(`sendWhatsAppMessage target="${phoneNumber || contactName}", native=${native}, whatsapp_not_found`, false);
        return { success: false, reason: 'whatsapp_not_found' };
      }
      _logCall(`sendWhatsAppMessage target="${phoneNumber || contactName}", native=${native}, reason=${reason}`, false);
      return { success: false, reason };
    } catch (e) {
      const errText = (e && (e.message || String(e))) || 'bridge_threw';
      _logCall(`sendWhatsAppMessage target="${phoneNumber || contactName}", native=${native}, bridge threw: ${errText}`, false);
      return { success: false, reason: 'failed' };
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
    return 'unknown';
  }

  function openSystemSettings() {
    const bridge = _native();
    if (bridge) {
      try { bridge.openSettings(); return; } catch {}
    }
    App.showToast('System settings yahan se nahi khulta — device settings mein jaao manually.');
  }

  /* ── getLocation ──────────────────────────────────────── */
  /* Returns { ok:true, latitude, longitude } on success, or
     { ok:false, reason:'denied'|'unavailable' } on failure.
     NEVER throws — always resolves. Prefers the Capacitor
     Geolocation plugin when present, otherwise falls back to
     navigator.geolocation (works inside the WebView with the
     ACCESS_FINE/COARSE_LOCATION manifest permissions). */
  async function getLocation() {
    /* Capacitor Geolocation plugin path (if installed) */
    const geo = window.Capacitor?.Plugins?.Geolocation;
    if (geo && typeof geo.getCurrentPosition === 'function') {
      try {
        const pos = await geo.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        });
        const lat = pos?.coords?.latitude;
        const lon = pos?.coords?.longitude;
        if (typeof lat === 'number' && typeof lon === 'number') {
          return { ok: true, latitude: lat, longitude: lon };
        }
        return { ok: false, reason: 'unavailable' };
      } catch (e) {
        const msg = (e && (e.message || String(e))) || '';
        const denied = /denied|permission/i.test(msg);
        return { ok: false, reason: denied ? 'denied' : 'unavailable' };
      }
    }

    /* Browser / WebView fallback via navigator.geolocation */
    if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
      return new Promise((resolve) => {
        let settled = false;
        const done = (val) => { if (!settled) { settled = true; resolve(val); } };
        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos?.coords?.latitude;
              const lon = pos?.coords?.longitude;
              if (typeof lat === 'number' && typeof lon === 'number') {
                done({ ok: true, latitude: lat, longitude: lon });
              } else {
                done({ ok: false, reason: 'unavailable' });
              }
            },
            (err) => {
              /* PERMISSION_DENIED === 1 */
              const denied = err && err.code === 1;
              done({ ok: false, reason: denied ? 'denied' : 'unavailable' });
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          );
        } catch (_) {
          done({ ok: false, reason: 'unavailable' });
        }
        /* Safety net: never hang forever if the callback never fires */
        setTimeout(() => done({ ok: false, reason: 'unavailable' }), 12000);
      });
    }

    return { ok: false, reason: 'unavailable' };
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
    sendWhatsAppMessage,
    requestPermission,
    checkPermission,
    openSystemSettings,
    getLocation,
  };
})();
