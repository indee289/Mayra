/* ═══════════════════════════════════════════════════════════
   CHAT ROUTER (module name kept as GeminiChat for compatibility)
   Routes the text message pipeline by the selected provider:
     - 'gemini' : Gemini generateContent REST API, WITH function
                  calling + follow-up turn (full-featured).
     - 'groq'   : Groq OpenAI-compatible chat/completions.
     - 'openai' : OpenAI chat/completions.
   Shares session history context with voice where possible.

   LIMITATION: Function-calling / device actions (openApp, callContact,
   etc.) are Gemini-ONLY. Groq and OpenAI return text-only replies —
   they do NOT execute tool calls. Voice is also Gemini-only (gated in
   app.js _startVoice). MAYRA_SYSTEM_PROMPT is reused as the system
   message for ALL providers so Mayra's personality never forks.

   The public send(userText, apiKey, systemInstruction) signature is
   preserved so app.js and voice callers are unaffected.
═══════════════════════════════════════════════════════════ */
const GeminiChat = (() => {

  const REST_HOST = 'https://generativelanguage.googleapis.com';
  const MODEL     = 'gemini-3.6-flash';
  const MAX_RETRIES = 2;

  /* OpenAI-compatible provider config (Groq + OpenAI share the shape) */
  const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL  = 'llama-3.3-70b-versatile';
  const OPENAI_URL  = 'https://api.openai.com/v1/chat/completions';
  const OPENAI_MODEL = 'gpt-4o-mini';

  /* ── Send a message — routes by selected provider ── */
  async function send(userText, apiKey, systemInstruction) {
    const provider = (typeof Storage !== 'undefined' && Storage.getProvider)
      ? Storage.getProvider()
      : 'gemini';

    if (provider === 'groq') {
      return _sendOpenAICompatible('groq', GROQ_URL, GROQ_MODEL, userText, apiKey, systemInstruction);
    }
    if (provider === 'openai') {
      return _sendOpenAICompatible('openai', OPENAI_URL, OPENAI_MODEL, userText, apiKey, systemInstruction);
    }
    /* Default: Gemini (full function-calling pipeline). */
    return _sendGemini(userText, apiKey, systemInstruction);
  }

  /* ── Gemini text pipeline (UNCHANGED behaviour — function calling
        + follow-up turn preserved) ── */
  async function _sendGemini(userText, apiKey, systemInstruction) {
    const history = _buildHistory(userText);
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const body = {
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: history,
          tools: [{ function_declarations: MayraFunctions.TOOL_DECLARATIONS }],
          generation_config: {
            temperature: 0.85,
            top_p: 0.95,
            max_output_tokens: 600,
          }
        };

        const r = await MayraHTTP.request({
          tag: 'CHAT',
          url: `${REST_HOST}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: body
        });

        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            return { ok: false, error: 'invalid_key', message: 'API key sahi nahi laga. Settings mein check karo.' };
          }
          if (r.status === 429) {
            return { ok: false, error: 'quota', message: 'Abhi thoda busy hoon, thodi der mein phir koshish karo!' };
          }
          throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.data)}`);
        }

        return _processResponse(r.data, userText, apiKey, systemInstruction);

      } catch (e) {
        attempt++;
        /* Log the REAL error every attempt so a genuine transport failure
           (e.g. WebView CORS block when CapacitorHttp isn't active, DNS,
           timeout) is visible in logcat/devtools for debugging. Guard the
           logging itself so an opaque/non-serialisable error never crashes. */
        try {
          console.error(`[GeminiChat] fetch failed (attempt ${attempt}):`, e && (e.message || e), e);
        } catch (_) { /* ignore logging failure */ }
        if (attempt > MAX_RETRIES) {
          return { ok: false, error: 'network', message: 'Network mein dikkat aayi. Thodi der baad try karo.' };
        }
        await _sleep(1000 * attempt);
      }
    }
  }

  /* ── Groq / OpenAI text-only pipeline (OpenAI chat/completions shape) ──
     NOTE: These providers are text-only in Mayra — no function/tool
     execution (device actions stay Gemini-only). We still reuse
     MAYRA_SYSTEM_PROMPT as the system message and persist history so
     context carries across providers and the chat counter keeps working. */
  async function _sendOpenAICompatible(provider, url, model, userText, apiKey, systemInstruction) {
    const messages = _buildOpenAIMessages(userText, systemInstruction);
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const r = await MayraHTTP.request({
          tag: 'CHAT',
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          data: {
            model,
            messages,
            temperature: 0.85
          }
        });

        if (!r.ok) {
          /* Mirror Gemini's warm error handling — never surface raw JSON. */
          if (r.status === 401 || r.status === 403) {
            return { ok: false, error: 'invalid_key', message: 'API key sahi nahi laga. Settings mein check karo.' };
          }
          if (r.status === 429) {
            return { ok: false, error: 'quota', message: 'Abhi thoda busy hoon, thodi der mein phir koshish karo!' };
          }
          throw new Error(`HTTP ${r.status}: ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`);
        }

        const data = r.data;
        const replyText = (data.choices?.[0]?.message?.content || '').trim();
        if (!replyText) {
          return { ok: false, error: 'empty', message: 'Kuch samajh nahi aaya, phir bolo?' };
        }

        /* Persist the turn just like the Gemini text path. */
        Storage.appendMessage('user', userText);
        Storage.appendMessage('model', replyText);
        return { ok: true, text: replyText };

      } catch (e) {
        attempt++;
        /* Log the REAL error every attempt (WebView CORS block, DNS, timeout,
           opaque response). Guard logging so it can never itself throw. */
        try {
          console.error(`[Chat:${provider}] fetch failed (attempt ${attempt}):`, e && (e.message || e), e);
        } catch (_) { /* ignore logging failure */ }
        if (attempt > MAX_RETRIES) {
          return { ok: false, error: 'network', message: 'Network mein dikkat aayi. Thodi der baad try karo.' };
        }
        await _sleep(1000 * attempt);
      }
    }
  }

  /* Build OpenAI-style messages: system prompt first, then recent history
     with stored 'model' role mapped to 'assistant', then the new user turn. */
  function _buildOpenAIMessages(newUserText, systemInstruction) {
    const messages = [{ role: 'system', content: systemInstruction }];
    const history = Storage.getChatHistory().slice(-20);
    for (const msg of history) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    }
    messages.push({ role: 'user', content: newUserText });
    return messages;
  }

  async function _processResponse(data, originalUserText, apiKey, systemInstruction) {
    const candidate = data.candidates?.[0];
    if (!candidate) return { ok: false, error: 'empty', message: 'Koi response nahi aaya.' };

    const parts = candidate.content?.parts || [];
    const texts  = [];
    const fnCalls = [];

    for (const part of parts) {
      if (part.text)         texts.push(part.text);
      if (part.functionCall) fnCalls.push(part.functionCall);
    }

    /* ── Handle function calls ── */
    if (fnCalls.length > 0) {
      const results = [];
      for (const fc of fnCalls) {
        const result = await MayraFunctions.execute(fc.name, fc.args || {});
        results.push({ fc, result });
      }

      /* Build follow-up context */
      const followUps = results.map(({ fc, result }) =>
        MayraFunctions.buildFollowUpPrompt(fc.name, fc.args || {}, result)
      ).join(' ');

      /* Build the follow-up request FIRST — _buildHistoryWithFunctionResults
         appends the current user turn itself. If we persisted it to storage
         beforehand, _buildHistory would read it back AND append it again,
         duplicating the user message in the request. So build now, persist after. */
      const history2 = _buildHistoryWithFunctionResults(originalUserText, fnCalls, results);

      /* Now persist the user turn to session history */
      Storage.appendMessage('user', originalUserText);

      /* Ask Gemini to reply naturally after the function call.
         This follow-up turn ALSO goes through MayraHTTP so it uses native
         HTTP inside the app (not subject to WebView CORS). */
      const r2 = await MayraHTTP.request({
        tag: 'CHAT',
        url: `${REST_HOST}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: history2,
          generation_config: { temperature: 0.85, top_p: 0.95, max_output_tokens: 300 }
        }
      });
      if (r2.ok) {
        const data2 = r2.data;
        const replyText = data2.candidates?.[0]?.content?.parts?.[0]?.text || followUps;
        Storage.appendMessage('model', replyText);
        return { ok: true, text: replyText, functionResults: results };
      }
      /* Fallback: just use the synthesized follow-up */
      Storage.appendMessage('model', followUps);
      return { ok: true, text: followUps, functionResults: results };
    }

    /* ── Plain text reply ── */
    const replyText = texts.join(' ').trim();
    if (!replyText) return { ok: false, error: 'empty', message: 'Kuch samajh nahi aaya, phir bolo?' };

    Storage.appendMessage('user', originalUserText);
    Storage.appendMessage('model', replyText);
    return { ok: true, text: replyText };
  }

  /* Build the message history for this request */
  function _buildHistory(newUserText) {
    const history = Storage.getChatHistory();
    const contents = [];

    /* Include last N turns for context (keep within token limits) */
    const recent = history.slice(-20);
    for (const msg of recent) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    /* Add current user message */
    contents.push({ role: 'user', parts: [{ text: newUserText }] });
    return contents;
  }

  function _buildHistoryWithFunctionResults(userText, fnCalls, results) {
    const contents = _buildHistory(userText);

    /* Add the model's function call turn */
    contents.push({
      role: 'model',
      parts: fnCalls.map(fc => ({ functionCall: fc }))
    });

    /* Add function results */
    contents.push({
      role: 'user',
      parts: results.map(({ fc, result }) => ({
        functionResponse: {
          name: fc.name,
          response: { output: JSON.stringify(result) }
        }
      }))
    });

    return contents;
  }

  /* ── Text-to-Speech: speak a reply in Mayra's voice ──
     Uses Gemini's REST TTS API if available, otherwise
     the voice session. Falls back to none (text-only). ── */
  async function speakText(text, apiKey) {
    /* If voice session is active, send via that */
    if (GeminiVoice.isActive()) {
      /* Inject text as a model turn for the voice session to read */
      /* Note: full TTS via REST would use a separate endpoint.
         For now we skip browser TTS (per PRD) and note this as a
         voice-session-only feature. */
      console.log('[GeminiChat] TTS requested but no standalone TTS in REST mode.');
      return;
    }
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { send, speakText };
})();
