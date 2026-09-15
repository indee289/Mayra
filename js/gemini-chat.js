/* ═══════════════════════════════════════════════════════════
   GEMINI CHAT — Text message pipeline
   Uses Gemini generateContent REST API.
   Shares session history context with voice where possible.
   Handles function calling inline.
═══════════════════════════════════════════════════════════ */
const GeminiChat = (() => {

  const REST_HOST = 'https://generativelanguage.googleapis.com';
  const MODEL     = 'gemini-2.0-flash';
  const MAX_RETRIES = 2;

  /* ── Send a message ── */
  async function send(userText, apiKey, systemInstruction) {
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

        const res = await fetch(
          `${REST_HOST}/v1beta/${MODEL}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401 || res.status === 403) {
            return { ok: false, error: 'invalid_key', message: 'API key sahi nahi laga. Settings mein check karo.' };
          }
          if (res.status === 429) {
            return { ok: false, error: 'quota', message: 'Abhi thoda busy hoon, thodi der mein phir koshish karo!' };
          }
          throw new Error(`HTTP ${res.status}: ${JSON.stringify(err)}`);
        }

        const data = await res.json();
        return _processResponse(data, userText, apiKey, systemInstruction);

      } catch (e) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          console.error('[GeminiChat] Failed after retries:', e);
          return { ok: false, error: 'network', message: 'Network mein dikkat aayi. Thodi der baad try karo.' };
        }
        await _sleep(1000 * attempt);
      }
    }
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

      /* Store the user turn */
      Storage.appendMessage('user', originalUserText);

      /* Ask Gemini to reply naturally after the function call */
      const history2 = _buildHistoryWithFunctionResults(originalUserText, fnCalls, results);
      const res2 = await fetch(
        `${REST_HOST}/v1beta/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: history2,
            generation_config: { temperature: 0.85, top_p: 0.95, max_output_tokens: 300 }
          })
        }
      );
      if (res2.ok) {
        const data2 = await res2.json();
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
