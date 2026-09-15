/* ═══════════════════════════════════════════════════════════
   MayraHTTP — unified HTTP helper for LLM REST calls
   ───────────────────────────────────────────────────────────
   WHY THIS EXISTS:
   The app runs inside the Android WebView at origin https://localhost
   (capacitor.config.json server.androidScheme "https"). A cross-origin
   browser fetch() to the LLM REST APIs (Gemini / Groq / OpenAI) is
   blocked by WebView CORS, so fetch() THROWS and the app reports a
   network problem. Relying on Capacitor's transparent window.fetch
   monkey-patch (plugins.CapacitorHttp.enabled) was NOT reliable on the
   user's device, so we call the CapacitorHttp plugin's native request
   API EXPLICITLY when running inside the native app. Native HTTP is not
   subject to WebView CORS, which fixes the issue deterministically.
   In a real browser / PWA there is no Capacitor, so we fall back to a
   normal fetch().

   No bundler in this project — plain browser-global IIFE, exposed as
   window.MayraHTTP, loaded via <script> before the modules that use it.

   API:
     MayraHTTP.request({ url, method='GET', headers={}, data=undefined })
       -> Promise<{ ok, status, data }>
     `data` is the PARSED JSON object when possible, else raw text.
     A genuine transport failure REJECTS (callers catch it).
═══════════════════════════════════════════════════════════ */
window.MayraHTTP = (() => {

  /* Try to parse a string as JSON; return the original string on failure. */
  function _maybeParseJSON(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    const first = trimmed[0];
    /* Only attempt a parse when it plausibly looks like JSON. */
    if (first !== '{' && first !== '[' && first !== '"') return value;
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return value;
    }
  }

  async function request({ url, method = 'GET', headers = {}, data = undefined } = {}) {
    const upperMethod = (method || 'GET').toUpperCase();
    const isBodyless  = upperMethod === 'GET' || upperMethod === 'HEAD';

    const cap = window.Capacitor;
    const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

    /* ── Native path: explicit CapacitorHttp.request (no WebView CORS) ── */
    if (isNative && cap.Plugins && cap.Plugins.CapacitorHttp) {
      try {
        const opts = { url, method: upperMethod, headers: { ...headers } };
        if (!isBodyless && data != null) {
          /* For a POST/PUT, ensure Content-Type is JSON unless the caller
             overrode it. Pass an object through as-is (CapacitorHttp
             serializes it); pass a string through unchanged. */
          if (!('Content-Type' in opts.headers) && !('content-type' in opts.headers)) {
            opts.headers['Content-Type'] = 'application/json';
          }
          opts.data = data;
        }
        const res = await cap.Plugins.CapacitorHttp.request(opts);
        const status = res.status;
        const ok = status >= 200 && status < 300;
        return { ok, status, data: _maybeParseJSON(res.data) };
      } catch (e) {
        try { console.error('[MayraHTTP] native request failed:', e && (e.message || e), e); } catch (_) {}
        throw e;
      }
    }

    /* ── Browser / PWA fallback: normal fetch ── */
    try {
      const init = { method: upperMethod, headers: { ...headers } };
      if (!isBodyless && data != null) {
        init.body = (typeof data === 'string') ? data : JSON.stringify(data);
      }
      const res = await fetch(url, init);
      const status = res.status;
      let parsed;
      try {
        parsed = await res.json();
      } catch (_) {
        parsed = await res.text().catch(() => null);
      }
      return { ok: res.ok, status, data: parsed };
    } catch (e) {
      try { console.error('[MayraHTTP] fetch failed:', e && (e.message || e), e); } catch (_) {}
      throw e;
    }
  }

  return { request };
})();
