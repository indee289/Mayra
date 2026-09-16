/* ═══════════════════════════════════════════════════════════
   GEMINI LIVE — Real-time voice-to-voice pipeline
   Uses Gemini Multimodal Live API (WebSocket).
   Handles: PCM audio streaming → model → PCM playback,
   interruption, function calling, and session management.
═══════════════════════════════════════════════════════════ */
const GeminiVoice = (() => {

  /* NOTE: Voice uses a WebSocket (wss://) transport, NOT fetch/HTTP, so
     CapacitorHttp / MayraHTTP does not apply here — WebSockets are not
     subject to the same WebView CORS block. Voice transport is out of
     scope for the native-HTTP LLM fix. */

  /* ── Constants ── */
  const WS_HOST      = 'generativelanguage.googleapis.com';
  const MODEL        = 'models/gemini-3.1-flash-live-preview';
  const SAMPLE_RATE  = 16000;   // input PCM: 16kHz mono
  const OUT_RATE     = 24000;   // output PCM: 24kHz
  const CHUNK_MS     = 100;     // audio chunk interval

  /* ── State ── */
  let _ws            = null;
  let _audioCtx      = null;
  let _sourceNode    = null;
  let _processor     = null;
  let _mediaStream   = null;
  let _playQueue     = [];
  let _playing       = false;
  let _sessionActive = false;
  let _interrupted   = false;
  let _onStatusCb    = null;
  let _onTranscriptCb = null;
  let _onFunctionCallCb = null;
  let _onErrorCb     = null;
  let _apiKey        = null;

  /* ── Voice timing/diagnostics state (DIAGNOSTICS ONLY) ──
     Timestamps (ms, via _now()) captured at key lifecycle moments so the
     on-screen debug panel can show WHERE any delay happens. None of these
     affect voice behaviour; they only feed rawText strings in _debugVoice. */
  let _tOpen          = 0;   // WebSocket 'open'
  let _tSetupComplete = 0;   // setupComplete received
  let _tTurnStart     = 0;   // start of the current model turn (reset each turn)
  let _tFirstAudio    = 0;   // first audio chunk timestamp of the current turn
  let _firstAudioSeen = false; // whether first audio chunk of the current turn was logged

  function _now() {
    try {
      if (window.performance && typeof window.performance.now === 'function') {
        return window.performance.now();
      }
    } catch (_) {}
    return Date.now();
  }

  /* Round a ms delta for readable log strings. */
  function _ms(a, b) {
    if (!a || !b) return 'n/a';
    return Math.round(b - a) + 'ms';
  }

  /* Callbacks */
  function onStatus(cb)       { _onStatusCb = cb; }
  function onTranscript(cb)   { _onTranscriptCb = cb; }
  function onFunctionCall(cb) { _onFunctionCallCb = cb; }
  function onError(cb)        { _onErrorCb = cb; }

  function _emit(event, data) {
    if (event === 'status'   && _onStatusCb)       _onStatusCb(data);
    if (event === 'transcript' && _onTranscriptCb) _onTranscriptCb(data);
    if (event === 'function_call' && _onFunctionCallCb) _onFunctionCallCb(data);
    if (event === 'error'    && _onErrorCb)        _onErrorCb(data);
  }

  /* Push a VOICE lifecycle entry to the on-screen debug panel.
     DIAGNOSTICS ONLY — guarded so a missing MayraDebug never breaks voice,
     and the key in the logged URL is redacted inside MayraDebug.log. */
  function _debugVoice(state, extra) {
    try {
      if (window.MayraDebug && window.MayraDebug.log) {
        const wsUrl = `wss://${WS_HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${_apiKey || ''}`;
        window.MayraDebug.log(Object.assign({
          tag: 'VOICE',
          path: 'ws',
          url: wsUrl,
          state: state,
          ok: state === 'open',
        }, extra || {}));
      }
    } catch (_) { /* logging must never break voice */ }
  }

  /* ── Session Setup ── */
  async function start(apiKey, systemInstruction) {
    if (_sessionActive) return;
    _apiKey = apiKey;

    _emit('status', { state: 'connecting' });

    const wsUrl = `wss://${WS_HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${_apiKey}`;

    _debugVoice('connecting', { rawText: 'Opening WebSocket to Gemini Live...' });

    _ws = new WebSocket(wsUrl);
    _ws.binaryType = 'arraybuffer';

    _debugVoice('connecting', { rawText: `WebSocket created, readyState=${_ws.readyState}` });

    _ws.onopen = () => {
      _tOpen = _now();
      _tSetupComplete = 0;
      _tTurnStart = 0;
      _tFirstAudio = 0;
      _firstAudioSeen = false;
      _debugVoice('open', { rawText: `WebSocket open, readyState=${_ws && _ws.readyState}` });
      /* Send session setup */
      _ws.send(JSON.stringify({
        setup: {
          model: MODEL,
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: { voice_name: 'Aoede' } /* Most natural female voice */
              }
            }
          },
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [{ function_declarations: MayraFunctions.TOOL_DECLARATIONS }]
        }
      }));
    };

    _ws.onmessage = _handleMessage;

    _ws.onerror = (e) => {
      /* WebSocket error events are famously information-poor — capture
         whatever the event exposes plus the current readyState so the
         on-screen panel still shows something actionable. */
      let raw = 'WebSocket error event';
      try {
        const rs = _ws ? _ws.readyState : 'n/a';
        const type = (e && e.type) || 'error';
        const msg = (e && (e.message || e.error)) ? (e.message || String(e.error)) : '';
        raw = `type=${type}, readyState=${rs}` + (msg ? `, message=${msg}` : ', message=(WebSocket error events expose no detail)');
      } catch (_) {}
      _debugVoice('error', { rawText: raw });
      console.error('[GeminiVoice] WS error:', e);
      _emit('error', { message: 'Connection mein dikkat aayi. Dobara koshish karo.' });
      _cleanupSession();
    };

    _ws.onclose = (e) => {
      _debugVoice('closed', {
        code: (e && e.code !== undefined) ? e.code : null,
        reason: (e && e.reason) ? e.reason : '',
        ok: false,
        rawText: `closed code=${e && e.code}, reason=${(e && e.reason) || '(none)'}, wasClean=${e && e.wasClean}`
      });
      if (_sessionActive) {
        console.warn('[GeminiVoice] WS closed unexpectedly:', e.code, e.reason);
        _emit('error', { message: 'Connection toot gayi. Mic dabao phir se.' });
      }
      _cleanupSession();
    };
  }

  function _handleMessage(event) {
    let msg;
    try {
      const text = typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(event.data);
      msg = JSON.parse(text);
    } catch (e) {
      /* Raw binary audio chunk (some API versions) */
      if (event.data instanceof ArrayBuffer) {
        _queueAudio(event.data);
      }
      return;
    }

    /* Session ready */
    if (msg.setupComplete) {
      _sessionActive = true;
      _tSetupComplete = _now();
      _debugVoice('setup-complete', {
        ok: true,
        rawText: `Setup complete, mic starting (open\u2192setup ${_ms(_tOpen, _tSetupComplete)})`
      });
      _emit('status', { state: 'ready' });
      _startMicCapture();
      return;
    }

    /* Server content (audio / text / function call) */
    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.interrupted) {
        _interrupted = true;
        _debugVoice('interrupted', {
          ok: true,
          rawText: 'Model turn interrupted by user, playback stopped'
        });
        _stopPlayback();
        _emit('status', { state: 'listening' });
        return;
      }

      if (sc.modelTurn?.parts) {
        /* Mark the start of this model turn the first time we see any model
           content for it, so first-audio delay can be measured. */
        if (!_tTurnStart) _tTurnStart = _now();
        for (const part of sc.modelTurn.parts) {
          /* Audio output */
          if (part.inlineData?.mimeType?.includes('audio')) {
            /* Log only the FIRST audio chunk of this turn (avoid flooding). */
            if (!_firstAudioSeen) {
              _firstAudioSeen = true;
              _tFirstAudio = _now();
              _debugVoice('model-audio', {
                ok: true,
                rawText: `First audio chunk received, ms since turn start=${_ms(_tTurnStart, _tFirstAudio)}`
              });
            }
            const pcm = _base64ToPCM(part.inlineData.data);
            _queueAudio(pcm);
          }
          /* Text transcript (from model's output) */
          if (part.text) {
            _emit('transcript', { role: 'model', text: part.text });
          }
        }
      }

      if (sc.turnComplete) {
        _debugVoice('turn-complete', {
          ok: true,
          rawText: `Model turn complete (turnStart\u2192firstAudio ${_ms(_tTurnStart, _tFirstAudio)}, turnStart\u2192complete ${_ms(_tTurnStart, _now())})`
        });
        /* Reset per-turn timing so the next turn measures fresh. */
        _tTurnStart = 0;
        _tFirstAudio = 0;
        _firstAudioSeen = false;
        _emit('status', { state: 'listening' });
        _interrupted = false;
      }
    }

    /* Tool / function call */
    if (msg.toolCall) {
      _stopPlayback();
      /* Log function NAME(s) only — never args (may contain PII). */
      try {
        const names = (msg.toolCall.functionCalls || [])
          .map((fc) => fc && fc.name ? fc.name : '(unnamed)')
          .join(', ');
        _debugVoice('tool-call', {
          ok: true,
          rawText: `Tool call: ${names || '(none)'}`
        });
      } catch (_) {}
      for (const fc of msg.toolCall.functionCalls || []) {
        _emit('function_call', { name: fc.name, args: fc.args, callId: fc.id });
      }
    }

    /* Input transcript (what the user said) */
    if (msg.inputTranscript) {
      _emit('transcript', { role: 'user', text: msg.inputTranscript });
    }

    /* Status updates */
    if (msg.goAway) {
      _cleanupSession();
      _emit('error', { message: 'Session khatam ho gayi. Phir se shuru karo.' });
    }
  }

  /* Send function call result back to the model */
  function sendFunctionResult(callId, name, result) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
    _ws.send(JSON.stringify({
      toolResponse: {
        functionResponses: [{
          id: callId,
          name,
          response: { output: JSON.stringify(result) }
        }]
      }
    }));
  }

  /* ── Microphone Capture ── */
  async function _startMicCapture() {
    try {
      _mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      _audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      _sourceNode = _audioCtx.createMediaStreamSource(_mediaStream);
      _processor  = _audioCtx.createScriptProcessor(4096, 1, 1);

      _processor.onaudioprocess = (e) => {
        if (!_sessionActive || _interrupted) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16   = _float32ToPCM16(float32);
        _sendAudioChunk(pcm16);
      };

      _sourceNode.connect(_processor);
      _processor.connect(_audioCtx.destination);
      _emit('status', { state: 'listening' });

    } catch (e) {
      console.error('[GeminiVoice] Mic error:', e);
      _emit('error', { message: 'Microphone access nahi mila. Settings mein allow karo.' });
    }
  }

  function _sendAudioChunk(pcm16Buffer) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
    const base64 = _pcm16ToBase64(pcm16Buffer);
    /* Newer Gemini Live API: realtimeInput.mediaChunks[] is deprecated
       (server closes with 1007). Audio now goes under realtimeInput.audio
       as a single Blob { data, mimeType }. */
    _ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64
        }
      }
    }));
  }

  /* ── Audio Playback Queue ── */
  let _playbackCtx = null;

  function _queueAudio(arrayBufferOrPCM) {
    _playQueue.push(arrayBufferOrPCM);
    if (!_playing) _drainQueue();
    _emit('status', { state: 'speaking' });
  }

  async function _drainQueue() {
    if (_playing || _playQueue.length === 0) return;
    _playing = true;

    if (!_playbackCtx || _playbackCtx.state === 'closed') {
      _playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUT_RATE });
    }

    while (_playQueue.length > 0 && !_interrupted) {
      const raw = _playQueue.shift();
      try {
        const buffer = await _decodePCM(raw, _playbackCtx);
        if (!buffer) continue;

        await new Promise((resolve) => {
          const src = _playbackCtx.createBufferSource();
          src.buffer = buffer;
          src.connect(_playbackCtx.destination);
          src.onended = resolve;
          src.start();
        });
      } catch (e) {
        console.warn('[GeminiVoice] Playback error:', e);
      }
    }

    _playing = false;
    if (!_interrupted) {
      _emit('status', { state: 'listening' });
    }
  }

  function _stopPlayback() {
    _playQueue = [];
    _playing   = false;
    try { _playbackCtx?.suspend(); } catch {}
  }

  /* Interrupt: stop speaking, process new input */
  function interrupt() {
    _interrupted = true;
    _stopPlayback();
    if (_ws?.readyState === WebSocket.OPEN) {
      /* Signal the model to stop */
      _ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  }

  /* ── Session teardown ── */
  function stop() {
    _sessionActive = false;
    _stopPlayback();
    if (_processor) { try { _processor.disconnect(); } catch {} }
    if (_sourceNode) { try { _sourceNode.disconnect(); } catch {} }
    if (_mediaStream) { _mediaStream.getTracks().forEach(t => t.stop()); }
    if (_audioCtx) { try { _audioCtx.close(); } catch {} }
    if (_ws && _ws.readyState <= WebSocket.OPEN) { _ws.close(); }
    _ws = _processor = _sourceNode = _mediaStream = _audioCtx = null;
    _emit('status', { state: 'idle' });
  }

  function _cleanupSession() {
    _sessionActive = false;
    _playing = false;
    _playQueue = [];
  }

  function isActive() { return _sessionActive; }

  /* ── Audio Utilities ── */
  function _float32ToPCM16(float32) {
    const buf = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buf;
  }

  function _pcm16ToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function _base64ToPCM(base64) {
    const bin  = atob(base64);
    const buf  = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }

  async function _decodePCM(arrayBuffer, audioCtx) {
    /* Raw 16-bit PCM (little-endian, mono, 24kHz) → AudioBuffer */
    const view    = new DataView(arrayBuffer);
    const samples = arrayBuffer.byteLength / 2;
    const buffer  = audioCtx.createBuffer(1, samples, OUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      channel[i] = view.getInt16(i * 2, true) / 32768;
    }
    return buffer;
  }

  return {
    start, stop, interrupt, isActive,
    sendFunctionResult,
    onStatus, onTranscript, onFunctionCall, onError,
  };
})();
