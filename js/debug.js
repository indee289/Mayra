/* ═══════════════════════════════════════════════════════════
   MayraDebug — on-screen diagnostics panel
   ───────────────────────────────────────────────────────────
   WHY THIS EXISTS:
   The installed APK shows three runtime failures (API-key save,
   chat, voice) that cannot be reproduced or inspected in this
   sandbox (no network) and the user has NO PC / USB debugging.
   So we surface the runtime facts ON SCREEN: this module keeps a
   ring buffer of structured log entries and paints them into a
   fixed overlay panel the user can open with a floating button and
   screenshot. It records, per request, WHICH transport path ran
   (native CapacitorHttp vs fetch fallback vs WebSocket), the exact
   (redacted) URL, the HTTP status (or "no response"/"timeout"/
   "blocked/threw"), and the raw response/error text verbatim.

   DIAGNOSTICS ONLY — this file adds VISIBILITY. It does not change
   any request/voice logic and never fixes the three failures.

   No bundler — plain browser-global IIFE exposed as window.MayraDebug,
   loaded via <script> FIRST (before every other app script) so the
   logger exists before anything logs. All callers guard the call as
   `window.MayraDebug && MayraDebug.log(...)` so the app still works
   if this module is somehow absent.

   Secrets are NEVER logged: any `key=...` query param and any
   Authorization header value are redacted to ***REDACTED*** before
   an entry is stored. The rest of the RAW text is kept verbatim.
═══════════════════════════════════════════════════════════ */
window.MayraDebug = (() => {

  const MAX_ENTRIES = 200;
  const _entries = [];       // newest first
  let _seq = 0;
  let _visible = false;

  /* DOM refs (created lazily on first render) */
  let _root = null;
  let _list = null;
  let _btn  = null;

  /* ── Secret redaction ──────────────────────────────────────
     Replace the value of any `key=...` query param and any
     Authorization header value with ***REDACTED***. Operates on a
     STRING copy so we never mutate the caller's data. */
  const REDACTED = '***REDACTED***';

  function _redactUrl(url) {
    if (typeof url !== 'string' || !url) return url;
    /* key=... up to the next & or end of string */
    return url.replace(/([?&](?:key|api_key|apikey|access_token|token)=)[^&#\s]+/gi,
      (_m, p1) => p1 + REDACTED);
  }

  function _redactText(text) {
    if (typeof text !== 'string' || !text) return text;
    let out = text;
    /* Bearer tokens in raw text (e.g. echoed headers / error dumps) */
    out = out.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/g, (_m, p1) => p1 + REDACTED);
    /* Authorization: <value> */
    out = out.replace(/(authorization\s*[:=]\s*)("?)[^\s",}]+/gi, (_m, p1, q) => p1 + q + REDACTED);
    /* key=... inside any embedded URL/text */
    out = out.replace(/((?:key|api_key|apikey|access_token|token)=)[^&#\s"]+/gi,
      (_m, p1) => p1 + REDACTED);
    return out;
  }

  function _stringify(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); }
    catch (_) {
      try { return String(value); } catch (__) { return '[unserializable]'; }
    }
  }

  function _timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  /* ── Public: log a structured entry ────────────────────────
     entry: {
       tag:    'KEY-SAVE' | 'CHAT' | 'VOICE' | 'ENV' | 'HTTP' ...
       path:   'native' | 'fetch' | 'ws' | 'n/a'
       url:    string (will be redacted)
       method: string
       status: number | null | 'no response' | 'timeout' | 'blocked/threw'
       rawText:string (kept verbatim except secrets)
       ok:     boolean
       state:  'connecting'|'open'|'error'|'closed'  (VOICE only)
       code:   number   (VOICE close only)
       reason: string   (VOICE close only)
     } */
  function log(entry) {
    try {
      const e = entry || {};
      const rec = {
        seq:    ++_seq,
        ts:     _timestamp(),
        tag:    e.tag || 'HTTP',
        path:   e.path || 'n/a',
        url:    _redactUrl(e.url || ''),
        method: e.method || '',
        status: (e.status === undefined ? null : e.status),
        raw:    _redactText(_stringify(e.rawText)),
        ok:     !!e.ok,
        state:  e.state || null,
        code:   (e.code === undefined ? null : e.code),
        reason: (e.reason === undefined ? null : e.reason),
      };
      _entries.unshift(rec);
      if (_entries.length > MAX_ENTRIES) _entries.length = MAX_ENTRIES;
      if (_visible) _renderList();
    } catch (_) { /* logging must never break the app */ }
  }

  /* ── One-time environment line on app start ────────────────
     Instantly tells us whether the native HTTP path is even
     available in the installed APK (the most likely root cause). */
  function logEnv() {
    try {
      const cap = window.Capacitor;
      const present = !!cap;
      let isNative = false;
      try { isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform()); } catch (_) {}
      const httpPlugin = !!(cap && cap.Plugins && cap.Plugins.CapacitorHttp);
      const ua = (navigator && navigator.userAgent) || 'unknown';
      log({
        tag: 'ENV',
        path: 'n/a',
        url: '',
        method: '',
        status: null,
        ok: present && httpPlugin,
        rawText: `Capacitor=${present ? 'present' : 'absent'}, `
               + `isNativePlatform=${isNative}, `
               + `CapacitorHttp plugin=${httpPlugin ? 'present' : 'absent'}, `
               + `userAgent=${ua}`
      });
    } catch (_) {}
  }

  /* ── Rendering ─────────────────────────────────────────────*/
  function _ensureDom() {
    if (_root && _list) return;

    _injectStyles();

    /* Reuse the static anchor from index.html if present, else create one. */
    _root = document.getElementById('mayra-debug-panel');
    if (!_root) {
      _root = document.createElement('div');
      _root.id = 'mayra-debug-panel';
    }
    _root.className = 'mayra-debug-panel hidden';
    _root.setAttribute('role', 'dialog');
    _root.setAttribute('aria-label', 'Debug diagnostics');
    _root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'mayra-debug-header';

    const title = document.createElement('span');
    title.className = 'mayra-debug-title';
    title.textContent = '🐞 Mayra Debug';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'mayra-debug-btn';
    btnCopy.textContent = 'Copy';
    btnCopy.onclick = copyAll;

    const btnClear = document.createElement('button');
    btnClear.className = 'mayra-debug-btn';
    btnClear.textContent = 'Clear';
    btnClear.onclick = clear;

    const btnClose = document.createElement('button');
    btnClose.className = 'mayra-debug-btn mayra-debug-close';
    btnClose.textContent = '×';
    btnClose.setAttribute('aria-label', 'Close debug panel');
    btnClose.onclick = hide;

    header.appendChild(title);
    header.appendChild(btnCopy);
    header.appendChild(btnClear);
    header.appendChild(btnClose);

    _list = document.createElement('div');
    _list.className = 'mayra-debug-list';

    _root.appendChild(header);
    _root.appendChild(_list);
    if (!_root.parentNode) document.body.appendChild(_root);
  }

  function _ensureButton() {
    if (_btn) return;
    _injectStyles();
    /* Reuse the static toggle from index.html if present, else create one. */
    _btn = document.getElementById('mayra-debug-toggle');
    if (!_btn) {
      _btn = document.createElement('button');
      _btn.id = 'mayra-debug-toggle';
      _btn.type = 'button';
      _btn.textContent = '🐞 Debug';
      document.body.appendChild(_btn);
    }
    _btn.className = 'mayra-debug-toggle';
    _btn.setAttribute('aria-label', 'Open debug panel');
    _btn.onclick = toggle;
  }

  function _statusLabel(rec) {
    if (rec.status === null || rec.status === undefined || rec.status === '') {
      return 'no response';
    }
    return String(rec.status);
  }

  function _renderList() {
    if (!_list) return;
    _list.innerHTML = '';
    for (const rec of _entries) {
      _list.appendChild(_renderEntry(rec));
    }
  }

  function _renderEntry(rec) {
    const item = document.createElement('div');
    const isVoice = rec.tag === 'VOICE';
    const failed = !rec.ok && rec.tag !== 'ENV';
    item.className = 'mayra-debug-entry' + (failed ? ' err' : (rec.ok ? ' ok' : ''));

    /* Header line: [TAG] HH:MM:SS */
    const head = document.createElement('div');
    head.className = 'mayra-debug-entry-head';
    head.textContent = `[${rec.tag}] ${rec.ts}`;
    item.appendChild(head);

    const addLine = (label, value) => {
      if (value === '' || value === null || value === undefined) return;
      const line = document.createElement('div');
      line.className = 'mayra-debug-line';
      const l = document.createElement('span');
      l.className = 'mayra-debug-label';
      l.textContent = label + ': ';
      line.appendChild(l);
      line.appendChild(document.createTextNode(String(value)));
      item.appendChild(line);
    };

    if (isVoice) {
      /* VOICE: STATE, URL, then CODE/REASON (closes) or RAW (errors) */
      const pathLabel = 'WebSocket';
      addLine('PATH', pathLabel);
      addLine('STATE', rec.state);
      addLine('URL', rec.url);
      if (rec.code !== null) addLine('CODE', rec.code);
      if (rec.reason !== null && rec.reason !== '') addLine('REASON', rec.reason);
      addLine('RAW', rec.raw);
    } else if (rec.tag === 'ENV') {
      addLine('RAW', rec.raw);
    } else {
      /* HTTP-style (KEY-SAVE / CHAT / HTTP) */
      let pathLabel = 'n/a';
      if (rec.path === 'native') pathLabel = 'native CapacitorHttp';
      else if (rec.path === 'fetch') pathLabel = 'fetch fallback';
      else if (rec.path) pathLabel = rec.path;
      addLine('PATH', pathLabel);
      addLine('URL', rec.url);
      if (rec.method) addLine('METHOD', rec.method);
      addLine('STATUS', _statusLabel(rec));
      addLine('RAW', rec.raw);
    }

    return item;
  }

  /* ── Controls ──────────────────────────────────────────────*/
  function show() {
    _ensureButton();
    _ensureDom();
    _renderList();
    _root.classList.remove('hidden');
    _visible = true;
  }

  function hide() {
    if (_root) _root.classList.add('hidden');
    _visible = false;
  }

  function toggle() {
    if (_visible) hide(); else show();
  }

  function clear() {
    _entries.length = 0;
    if (_visible) _renderList();
  }

  /* Best-effort copy of the whole panel text. Falls back to selecting
     the list text so the user can copy manually if clipboard is blocked. */
  function copyAll() {
    const text = _entries.map(_entryToText).join('\n\n');
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (_) {}
    if (!copied) {
      /* Select the list so the user can long-press → copy. */
      try {
        const range = document.createRange();
        range.selectNodeContents(_list);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    }
    /* Tiny visual acknowledgement without depending on App.showToast. */
    try {
      const btns = _root.querySelectorAll('.mayra-debug-btn');
      for (const b of btns) {
        if (b.textContent === 'Copy' || b.dataset.copyState) {
          b.dataset.copyState = '1';
          const prev = 'Copy';
          b.textContent = copied ? 'Copied!' : 'Select';
          setTimeout(() => { b.textContent = prev; delete b.dataset.copyState; }, 1200);
          break;
        }
      }
    } catch (_) {}
  }

  function _entryToText(rec) {
    const lines = [`[${rec.tag}] ${rec.ts}`];
    if (rec.tag === 'VOICE') {
      lines.push('PATH: WebSocket');
      if (rec.state) lines.push('STATE: ' + rec.state);
      if (rec.url) lines.push('URL: ' + rec.url);
      if (rec.code !== null) lines.push('CODE: ' + rec.code);
      if (rec.reason) lines.push('REASON: ' + rec.reason);
      if (rec.raw) lines.push('RAW: ' + rec.raw);
    } else if (rec.tag === 'ENV') {
      if (rec.raw) lines.push('RAW: ' + rec.raw);
    } else {
      let pathLabel = rec.path === 'native' ? 'native CapacitorHttp'
        : rec.path === 'fetch' ? 'fetch fallback' : (rec.path || 'n/a');
      lines.push('PATH: ' + pathLabel);
      if (rec.url) lines.push('URL: ' + rec.url);
      if (rec.method) lines.push('METHOD: ' + rec.method);
      lines.push('STATUS: ' + _statusLabel(rec));
      if (rec.raw) lines.push('RAW: ' + rec.raw);
    }
    return lines.join('\n');
  }

  /* ── Self-contained styles (dark translucent, readable) ────*/
  function _injectStyles() {
    if (document.getElementById('mayra-debug-styles')) return;
    const style = document.createElement('style');
    style.id = 'mayra-debug-styles';
    style.textContent = `
      .mayra-debug-toggle {
        position: fixed;
        left: 12px;
        bottom: 84px;
        z-index: 2147483646;
        background: rgba(30, 12, 40, 0.82);
        color: #ffd7f0;
        border: 1px solid rgba(220, 150, 210, 0.55);
        border-radius: 20px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        font-family: -apple-system, system-ui, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      }
      .mayra-debug-panel {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 70vh;
        max-height: 70vh;
        z-index: 2147483647;
        background: rgba(18, 10, 26, 0.94);
        color: #f2e8f6;
        border-top: 2px solid rgba(220, 150, 210, 0.6);
        display: flex;
        flex-direction: column;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.4;
      }
      .mayra-debug-panel.hidden { display: none; }
      .mayra-debug-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: rgba(40, 16, 52, 0.96);
        border-bottom: 1px solid rgba(220, 150, 210, 0.4);
        flex: 0 0 auto;
      }
      .mayra-debug-title {
        flex: 1 1 auto;
        font-weight: 700;
        color: #ffb9e6;
        font-size: 13px;
      }
      .mayra-debug-btn {
        background: rgba(220, 150, 210, 0.18);
        color: #ffd7f0;
        border: 1px solid rgba(220, 150, 210, 0.5);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .mayra-debug-close {
        font-size: 16px;
        line-height: 1;
        padding: 2px 9px;
      }
      .mayra-debug-list {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 8px 10px 24px;
        -webkit-overflow-scrolling: touch;
        user-select: text;
        -webkit-user-select: text;
      }
      .mayra-debug-entry {
        border: 1px solid rgba(255,255,255,0.12);
        border-left-width: 4px;
        border-radius: 6px;
        padding: 6px 8px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.03);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .mayra-debug-entry.ok  { border-left-color: #5fd28a; }
      .mayra-debug-entry.err { border-left-color: #ff6b6b; }
      .mayra-debug-entry-head {
        font-weight: 700;
        color: #ffc86b;
        margin-bottom: 3px;
      }
      .mayra-debug-entry.ok  .mayra-debug-entry-head { color: #7ff0a8; }
      .mayra-debug-entry.err .mayra-debug-entry-head { color: #ff8a8a; }
      .mayra-debug-line { margin: 1px 0; }
      .mayra-debug-label { color: #b79ecb; font-weight: 700; }
      .mayra-debug-entry.err .mayra-debug-line { color: #ffd0d0; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /* Ensure the floating button exists as soon as the DOM is ready. */
  function _boot() {
    try { _ensureButton(); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  return { log, logEnv, show, hide, toggle, clear, copyAll };
})();
