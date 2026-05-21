import OpenAI from "openai";

let client = null;
const DEFAULT_MODEL = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function embedText(text) {
  if (!text || !text.trim()) return null;
  const c = getClient();
  if (!c) return null;

  const cleaned = String(text).slice(0, 8192);

  const res = await c.embeddings.create({
    model: DEFAULT_MODEL,
    input: cleaned,
  });

  const vector = res.data?.[0]?.embedding || null;
  return vector;
}

export default { embedText };
