/* ═══════════════════════════════════════════════════════════
   FUNCTION CALLING — Tool definitions & execution
   Maps Gemini tool-call responses to real device actions.
   Only predefined safe functions ever run — no eval, no
   arbitrary code execution.
═══════════════════════════════════════════════════════════ */
const MayraFunctions = (() => {

  /* ── Tool definitions sent to Gemini API ── */
  const TOOL_DECLARATIONS = [
    {
      name: 'openWhatsApp',
      description: 'Opens WhatsApp on the device. Use when user says things like "WhatsApp kholo", "Open WhatsApp", "WhatsApp open karo", "WhatsApp chalao".',
      parameters: { type: 'OBJECT', properties: {}, required: [] }
    },
    {
      name: 'openApp',
      description: 'Opens a specific app on the device by name.',
      parameters: {
        type: 'OBJECT',
        properties: {
          appName: {
            type: 'STRING',
            description: 'The name of the app to open, e.g. "youtube", "instagram", "chrome", "settings", "spotify".'
          }
        },
        required: ['appName']
      }
    },
    {
      name: 'openUrl',
      description: 'Opens a URL in the browser.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The full URL to open.' }
        },
        required: ['url']
      }
    },
    {
      name: 'makeCall',
      description: 'Makes a phone call to a specific number. Use when user says "Call 9876543210", "Iss number par call karo".',
      parameters: {
        type: 'OBJECT',
        properties: {
          phoneNumber: {
            type: 'STRING',
            description: 'The phone number to call (digits only, no formatting).'
          }
        },
        required: ['phoneNumber']
      }
    }
  ];

  /* ── Execute a function call from Gemini's response ── */
  async function execute(toolName, args = {}) {
    console.log(`[Functions] Executing: ${toolName}`, args);

    switch (toolName) {

      case 'openWhatsApp': {
        const r = await AndroidBridge.openWhatsApp();
        if (r.success) return { ok: true, message: 'WhatsApp khol diya!' };
        return { ok: false, message: 'WhatsApp nahi mila device par.' };
      }

      case 'openApp': {
        const appName = (args.appName || '').toLowerCase();
        if (!appName) return { ok: false, message: 'App ka naam nahi mila.' };
        const r = await AndroidBridge.openApp(appName);
        if (r.success) return { ok: true, message: `${args.appName} khol diya!` };
        return { ok: false, message: `${args.appName} nahi khul paya — shayad install nahi hai.` };
      }

      case 'openUrl': {
        if (!args.url) return { ok: false, message: 'URL nahi mila.' };
        await AndroidBridge.openUrl(args.url);
        return { ok: true, message: `Link khol diya!` };
      }

      case 'makeCall': {
        const num = (args.phoneNumber || '').replace(/\D/g, '');
        if (!num) return { ok: false, message: 'Phone number nahi mila.' };
        const r = await AndroidBridge.makeCall(num);
        /* DIAGNOSTICS: log the outcome as seen at the functions layer. */
        try {
          if (window.MayraDebug && window.MayraDebug.log) {
            window.MayraDebug.log({
              tag: 'CALL',
              path: 'n/a',
              status: r && r.success ? 'ok' : 'failed',
              ok: !!(r && r.success),
              rawText: `functions.makeCall number=${num}, native=${AndroidBridge.isNative()}, `
                + `intent=${(r && r.intent) || 'n/a'}, success=${!!(r && r.success)}`
                + (r && r.error ? `, error=${r.error}` : '')
                + (r && r.method ? `, method=${r.method}` : '')
            });
          }
        } catch (_) {}
        if (r.success) return { ok: true, message: `${num} par call kar rahi hoon...` };
        return { ok: false, message: 'Call nahi laga paya.' };
      }

      default:
        return { ok: false, message: `Unknown function: ${toolName}` };
    }
  }

  /* ── Build natural language follow-up for Gemini ── */
  function buildFollowUpPrompt(toolName, args, result) {
    if (result.ok) {
      const msgs = {
        openWhatsApp: 'WhatsApp khol diya, saheli! ✅',
        openApp:      `${args.appName || 'app'} khol diya! ✅`,
        openUrl:      'Link khol diya! ✅',
        makeCall:     `${args.phoneNumber} par call laga rahi hoon...`,
      };
      return msgs[toolName] || 'Kaam ho gaya! ✅';
    } else {
      return result.message || 'Yeh kaam nahi ho paya, sorry.';
    }
  }

  return { TOOL_DECLARATIONS, execute, buildFollowUpPrompt };
})();
