import { useEffect, useRef, useState } from "react";
import { initSocket } from "../lib/socket";
import { api } from "../lib/api";
import Card from "./Card";
import Button from "./Button";
import { Send, MessageSquare, CornerUpLeft, Check } from "lucide-react";

export default function PrivateChat({ taskId, otherUserId, userId, userName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    socketRef.current = initSocket();
    // join private room
    socketRef.current.emit("join-private-chat", { taskId, userId, otherUserId });

    socketRef.current.on("receive-private-message", (data) => {
      setMessages((prev) => {
        // append or insert if parentMessageId
        const msg = { ...data, replies: [] };
        if (msg.parentMessageId) {
          // try to attach to parent
          const byId = new Map();
          prev.forEach((m) => byId.set(m.id, { ...m }));
          if (byId.has(msg.parentMessageId)) {
            byId.get(msg.parentMessageId).replies = [...(byId.get(msg.parentMessageId).replies || []), msg];
            return Array.from(byId.values());
          }
        }
        return [...prev, msg];
      });
    });

    socketRef.current.on("private-read-receipt", (data) => {
      const { messageId, readerId } = data;
      setMessages((prev) => updateReadCount(prev, messageId));
    });

    fetchMessages();

    return () => {
      socketRef.current?.off("receive-private-message");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, otherUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchMessages() {
    try {
      setLoading(true);
      const res = await api.get(`/messages/${taskId}/private/${otherUserId}`);
      setMessages(res.data.messages || []);
      // mark unread private messages as read for me
      markVisibleMessagesAsRead(res.data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const flattenMessages = (items) => {
    const out = [];
    items.forEach((it) => {
      out.push(it);
      if (Array.isArray(it.replies) && it.replies.length) out.push(...flattenMessages(it.replies));
    });
    return out;
  };

  const updateReadCount = (items, messageId) => {
    return items.map((item) => {
      if (item.id === messageId) return { ...item, read_count: (item.read_count || 0) + 1 };
      if (Array.isArray(item.replies) && item.replies.length) return { ...item, replies: updateReadCount(item.replies, messageId) };
      return item;
    });
  };

  const markVisibleMessagesAsRead = async (loadedMessages) => {
    const flat = flattenMessages(loadedMessages || []);
    const unread = flat.filter((m) => Number(m.recipient_id) === Number(userId) && !m.is_read_by_me);
    await Promise.all(unread.map(async (m) => {
      try {
        await api.post(`/messages/${m.id}/read`);
        socketRef.current?.emit('private-message-read', { taskId, messageId: m.id, fromUserId: m.sender_id, toUserId: userId });
      } catch (e) {
        console.error('mark read', e);
      }
    }));
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const payload = { content: newMessage, recipientId: otherUserId };
    if (replyTo) payload.parentMessageId = replyTo;
    // persist
    try {
      const post = await api.post(`/messages/${taskId}/private`, payload);
      const saved = post.data.message;
      // emit via socket for real-time delivery
      socketRef.current?.emit("send-private-message", { taskId, fromUserId: userId, toUserId: otherUserId, message: saved.content, parentMessageId: saved.parent_message_id, timestamp: saved.created_at });
      await fetchMessages();
    } catch (e) {
      console.error(e);
    }
    setNewMessage("");
    setReplyTo(null);
  };

  return (
    <Card className="flex flex-col h-80 border border-white/10 rounded-lg bg-surface/80 shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div>
          <p className="font-semibold">Private chat</p>
          <p className="text-xs text-text/60">1:1 with the task owner</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} title="Close private chat" aria-label="Close private chat"><MessageSquare size={16} /> Close</Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {loading ? <p className="text-sm text-text/60">Loading...</p> : messages.length === 0 ? <p className="text-sm text-text/60">No private messages yet.</p> : messages.map((m, i) => (
          <div key={i} className={`${(m.fromUserId || m.sender_id) === userId ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block rounded-lg px-3 py-2 ${((m.fromUserId || m.sender_id) === userId) ? 'bg-white/10' : 'bg-white/5'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{m.fromUserId === userId ? userName : m.sender_name}</p>
                <div className="flex items-center gap-2">
                  {Number(m.read_count || 0) > 0 && <span className="text-[11px] text-text/60 flex items-center gap-1"><Check size={12} /> Read</span>}
                </div>
              </div>
              <p className="text-sm">{m.message || m.content}</p>
              <p className="mt-1 text-xs text-muted">{new Date(m.timestamp || m.created_at).toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setReplyTo(m.id)}>Reply</Button>
              </div>
              {/* Render replies */}
              {Array.isArray(m.replies) && m.replies.length > 0 && (
                <div className="mt-2 ml-4 space-y-2">
                  {m.replies.map((r) => (
                    <div key={r.id} className={`inline-block rounded-lg px-2 py-1 ${((r.sender_id) === userId) ? 'bg-white/10' : 'bg-white/5'}`}>
                      <p className="text-xs font-semibold">{r.sender_name}</p>
                      <p className="text-sm">{r.content}</p>
                      <p className="mt-1 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 p-3 bg-obsidian/90">
        <div className="flex gap-2">
          <input ref={inputRef} value={newMessage} onChange={(e) => { setNewMessage(e.target.value); try { inputRef.current?.focus(); } catch(e){} }} placeholder={replyTo ? `Replying to #${replyTo}` : "Message owner..."} className="flex-1 px-3 py-2 rounded-lg bg-surface/80 border border-white/10" aria-label="Private message input" />
          <Button onClick={handleSend} title="Send private message" aria-label="Send private message"><Send size={16} /></Button>
        </div>
      </div>
    </Card>
  );
}
