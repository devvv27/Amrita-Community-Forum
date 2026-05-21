import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Card from "../components/Card";
import Button from "../components/Button";

export default function ChatsPage() {
  const [chats, setChats] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSummaries() {
      try {
        const res = await api.get('/messages/chats/summaries');
        setChats(res.data.chats || []);
      } catch (e) {
        setError(e.response?.data?.message || 'Unable to load chats');
      }
    }
    fetchSummaries();
  }, []);

  return (
    <section className="space-y-6 fade-in">
      <Card>
        <h1 className="text-2xl font-semibold">Chats</h1>
        <p className="text-sm text-text/70 mt-1">Ongoing conversations across your tasks.</p>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid gap-4">
        {/* AI Assistant chat entry (standalone) */}
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold">AI Chatbot</p>
            <p className="text-xs text-text/60 mt-1">Ask the chatbot questions about code, tasks, or the project.</p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <p className="text-xs text-muted">&nbsp;</p>
            <Button variant="secondary" onClick={() => window.location.href = '/assistant'}>Open Chat</Button>
          </div>
        </Card>
        {chats.length === 0 ? (
          <Card>
            <p className="text-sm text-text/60">No active chats yet.</p>
          </Card>
        ) : (
          chats.map((c) => (
            <Card key={c.task_id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-xs text-text/60 mt-1">{c.last_message ?? 'No messages yet'}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <p className="text-xs text-muted">{c.unread_count} unread</p>
                {c.status && (c.status === 'COMPLETED' || c.status === 'DISPUTED') ? (
                  <Button variant="secondary" disabled>Closed</Button>
                ) : (
                  <Button variant="secondary" onClick={() => window.location.href = `/chat/${c.task_id}`}>Open Chat</Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
