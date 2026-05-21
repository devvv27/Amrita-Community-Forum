// POST /api/ai/chat
function extractJsonBlob(text) {
  const input = String(text || '').trim();
  if (!input) return null;

  const firstBrace = input.indexOf('{');
  if (firstBrace < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < input.length; i += 1) {
    const char = input[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return input.slice(firstBrace, i + 1);
      }
    }
  }

  return null;
}

function parseOllamaResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    // fall through
  }

  const extracted = extractJsonBlob(raw);
  if (extracted) {
    try {
      return JSON.parse(extracted);
    } catch (_) {
      // fall through
    }
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^data:\s*/i, '').trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('{') || line.startsWith('['));

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch (_) {
      // continue
    }
  }

  return null;
}

export async function chatWithAI(req, res, next) {
  try {
    const { prompt, history } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt (string) is required' });
    }

    const ollamaBase = process.env.OLLAMA_URL || process.env.OLLAMA_HOST || 'http://localhost:11434';
    const preferredModel = process.env.OLLAMA_MODEL || 'llama3.2:latest';
    const fallbackModels = [preferredModel, 'llama3.2:latest', 'llama3.1:latest', 'llama3:latest']
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);

    if (!ollamaBase) {
      return res.status(501).json({ message: 'OLLAMA_URL not configured. Set OLLAMA_URL to your ollama instance.' });
    }

    // Use Ollama's chat completions endpoint (/v1/chat/completions)
    const url = `${ollamaBase.replace(/\/$/, '')}/v1/chat/completions`;

    // Build messages: include optional history then the current user prompt
    const msgs = [];
    // Optional system instruction to keep responses relevant to the project
    msgs.push({ role: 'system', content: 'You are a helpful assistant for the project. Answer concisely and reference code or tasks when relevant.' });
    if (Array.isArray(history)) {
      for (const h of history) {
        const role = h.role === 'assistant' ? 'assistant' : 'user';
        msgs.push({ role, content: String(h.text || h.content || '') });
      }
    }
    msgs.push({ role: 'user', content: String(prompt) });

    let lastError = null;

    for (const model of fallbackModels) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: msgs, stream: false }),
      });

      const text = await resp.text();
      const data = parseOllamaResponse(text);

      if (!data) {
        if (resp.ok) {
          return res.json({ reply: text, model });
        }

        lastError = text;
        continue;
      }

      if (!resp.ok) {
        lastError = data?.error?.message || data?.error || JSON.stringify(data);
        continue;
      }

      let reply = null;
      if (data?.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        reply = data.choices[0]?.message?.content || data.choices[0]?.message?.content?.text || data.choices[0]?.text || null;
      }
      if (!reply && data?.output && Array.isArray(data.output) && data.output.length > 0) {
        reply = data.output.map((o) => (o?.content ? o.content : o)).join('\n');
      }
      if (!reply && data?.text) reply = data.text;
      if (!reply) reply = JSON.stringify(data);

      return res.json({ reply, model });
    }

    return res.status(502).json({
      message: 'Ollama request failed',
      details: lastError || 'All fallback models failed',
      triedModels: fallbackModels,
    });
  } catch (err) {
    return next(err);
  }
}
