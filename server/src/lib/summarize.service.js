import OpenAI from "openai";

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const DEFAULT_MODEL = process.env.SUMMARY_MODEL || "gpt-4o-mini";

export async function summarizeIssue(text) {
  const c = getClient();
  if (!c || !text || !text.trim()) {
    // fallback simple heuristic
    const short = String(text || "").replace(/\s+/g, " ").trim().slice(0, 280);
    return {
      summary: short || "No substantial content to summarize.",
      actions: [
        "Collect deployment logs and configuration files.",
        "Verify required environment variables are present in production.",
        "Attempt a local production build to reproduce the error.",
      ],
    };
  }

  const prompt = `You are an engineering assistant. Given the following discussion or issue text, produce a concise root-cause style summary (1-2 sentences) and a short list of 3 concrete action items that a developer can take to investigate or fix the problem.\n\nText:\n"""\n${text}\n"""\n\nRespond as JSON with keys: summary (string) and actions (array of 3 strings).`;

  const resp = await c.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.1,
  });

  const content = resp?.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(content);
    return { summary: parsed.summary || "", actions: parsed.actions || [] };
  } catch (e) {
    // best-effort extract lines
    const lines = String(content).split(/\n/).map((l) => l.trim()).filter(Boolean);
    return {
      summary: lines.slice(0, 2).join(" ") || text.slice(0, 280),
      actions: lines.filter((l) => /^\d+\.|^-\s|^•/.test(l)).slice(0, 3).map((l) => l.replace(/^\d+\.|^-\s|^•\s*/i, "")) || [
        "Collect logs and configs.",
        "Reproduce locally using production build.",
        "Verify environment variables and secrets.",
      ],
    };
  }
}

export default { summarizeIssue };
