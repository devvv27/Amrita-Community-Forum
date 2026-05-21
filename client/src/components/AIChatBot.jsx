import { useState } from 'react';
import Button from './Button';
import { api } from '../lib/api';

export default function AIChatBot() {
  const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', text}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const resp = await api.post('/ai/chat', { prompt: input, history });
      const reply = resp.data.reply || 'No response';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (err) {
      console.error('AI chat error', err);
      setMessages((m) => [...m, { role: 'assistant', text: 'Error contacting AI: ' + (err?.message || '') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">AI Chatbot</h3>
      <div className="max-h-48 overflow-y-auto mt-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-sm text-text/60">Ask the assistant anything about code, tasks, or the project.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`p-2 rounded ${m.role === 'user' ? 'bg-white/5 text-text' : 'bg-neon/5 text-neon'}`}>
              <p className="text-sm">{m.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the assistant..." className="flex-1 px-3 py-2 rounded border border-white/10 bg-surface/80" />
        <Button onClick={send} disabled={loading}>{loading ? 'Thinking...' : 'Send'}</Button>
      </div>
    </div>
  );
}
