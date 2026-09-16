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
    },
    {
      name: 'getWeather',
      description: 'Aaj ka weather / temperature batata hai user ki current location ke hisaab se. Use when user asks aaj weather/mausam kaisa hai, temperature kya hai, bahar garmi/sardi/baarish hai kya.',
      parameters: { type: 'OBJECT', properties: {}, required: [] }
    },
    {
      name: 'getNews',
      description: 'Aaj ki top news headlines laata hai. Use when user asks aaj ki top news, kya ho raha hai India mein, latest khabrein, news sunao.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: {
            type: 'STRING',
            description: 'Optional topic to focus the news on, e.g. "sports", "politics". Leave empty for top headlines.'
          }
        },
        required: []
      }
    }
  ];

  /* ── WMO weather code → short Hinglish/English description ── */
  const WMO_CODES = {
    0:  'saaf aasman (clear sky)',
    1:  'mostly clear',
    2:  'thoda badalwa (partly cloudy)',
    3:  'badal chhaye hue (overcast)',
    45: 'kohra (fog)',
    48: 'rime fog',
    51: 'halki boondabaandi (light drizzle)',
    53: 'boondabaandi (drizzle)',
    55: 'tez boondabaandi (dense drizzle)',
    56: 'freezing drizzle',
    57: 'dense freezing drizzle',
    61: 'halki baarish (light rain)',
    63: 'baarish (rain)',
    65: 'tez baarish (heavy rain)',
    66: 'freezing rain',
    67: 'heavy freezing rain',
    71: 'halki barfbaari (light snow)',
    73: 'barfbaari (snow)',
    75: 'tez barfbaari (heavy snow)',
    77: 'snow grains',
    80: 'baarish ke halke chheente (light showers)',
    81: 'baarish ki bauchhaar (showers)',
    82: 'tez bauchhaar (violent showers)',
    85: 'snow showers',
    86: 'heavy snow showers',
    95: 'aandhi-toofan (thunderstorm)',
    96: 'thunderstorm with hail',
    99: 'thunderstorm with heavy hail'
  };

  function _wmoDescription(code) {
    if (WMO_CODES[code]) return WMO_CODES[code];
    return 'mausam saaf-suthra';
  }

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

      case 'getWeather': {
        /* Location comes from the device — NEVER fabricate weather. */
        const loc = await AndroidBridge.getLocation();
        if (!loc || !loc.ok) {
          return {
            ok: false,
            reason: 'location_denied',
            message: 'Weather batane ke liye mujhe location chahiye — Settings mein location allow kar do, phir turant bata dungi ❤️'
          };
        }
        try {
          const lat = loc.latitude;
          const lon = loc.longitude;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
            + `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`;
          const r = await MayraHTTP.request({ tag: 'WEATHER', method: 'GET', url });
          const cur = r && r.data && r.data.current;
          if (!r.ok || !cur || typeof cur.temperature_2m === 'undefined') {
            return { ok: false, message: 'Weather abhi nahi mil paya, thodi der baad try karo.' };
          }
          return {
            ok: true,
            temperature: Math.round(cur.temperature_2m),
            humidity: (typeof cur.relative_humidity_2m === 'number') ? Math.round(cur.relative_humidity_2m) : null,
            wind: (typeof cur.wind_speed_10m === 'number') ? Math.round(cur.wind_speed_10m) : null,
            condition: _wmoDescription(cur.weather_code)
          };
        } catch (_) {
          return { ok: false, message: 'Weather abhi nahi mil paya, thodi der baad try karo.' };
        }
      }

      case 'getNews': {
        /* Google News RSS — NEVER fabricate headlines. */
        try {
          const r = await MayraHTTP.request({
            tag: 'NEWS',
            method: 'GET',
            url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'
          });
          const xml = (typeof r.data === 'string') ? r.data : (r.data ? String(r.data) : '');
          if (!r.ok || !xml) {
            return { ok: false, message: 'Abhi news nahi laa payi, thodi der baad puchho.' };
          }
          const headlines = _parseNewsHeadlines(xml);
          if (!headlines.length) {
            return { ok: false, message: 'Abhi news nahi laa payi, thodi der baad puchho.' };
          }
          return { ok: true, headlines: headlines.slice(0, 5) };
        } catch (_) {
          return { ok: false, message: 'Abhi news nahi laa payi, thodi der baad puchho.' };
        }
      }

      default:
        return { ok: false, message: `Unknown function: ${toolName}` };
    }
  }

  /* ── Parse up to 5 <item><title> values from a Google News RSS string.
     Prefer DOMParser (available in the WebView); fall back to a regex
     that extracts the first ~5 <title> values inside <item> blocks,
     skipping the channel-level title. Never throws. ── */
  function _parseNewsHeadlines(xml) {
    const out = [];

    /* Preferred: DOMParser */
    try {
      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const items = doc.getElementsByTagName('item');
        for (let i = 0; i < items.length && out.length < 5; i++) {
          const titleNode = items[i].getElementsByTagName('title')[0];
          const t = titleNode && (titleNode.textContent || '').trim();
          if (t) out.push(t);
        }
        if (out.length) return out;
      }
    } catch (_) { /* fall through to regex */ }

    /* Fallback: regex over <item> blocks */
    try {
      const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
      const titleRegex = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
      let m;
      while ((m = itemRegex.exec(xml)) !== null && out.length < 5) {
        const tm = titleRegex.exec(m[0]);
        if (tm && tm[1]) {
          let t = tm[1]
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
          if (t) out.push(t);
        }
      }
    } catch (_) { /* return whatever we have */ }

    return out;
  }

  /* ── Build natural language follow-up for Gemini ── */
  function buildFollowUpPrompt(toolName, args, result) {
    if (result.ok) {
      if (toolName === 'getWeather') {
        const bits = [`Abhi ${result.temperature}°C hai aur ${result.condition}`];
        if (result.humidity != null) bits.push(`humidity ${result.humidity}%`);
        if (result.wind != null) bits.push(`hawa ${result.wind} km/h`);
        return `${bits.join(', ')} ☁️`;
      }
      if (toolName === 'getNews') {
        const list = (result.headlines || []).map((h, i) => `${i + 1}. ${h}`).join('\n');
        return `Aaj ki top khabrein yeh hain:\n${list}`;
      }
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
