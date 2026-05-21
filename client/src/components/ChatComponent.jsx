import { useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { getSocket, initSocket } from "../lib/socket";
import { api } from "../lib/api";
import Card from "./Card";
import Button from "./Button";

export default function ChatComponent({ taskId, userId, userName, standalone = false, taskStatus = null }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentDataUrl, setAttachmentDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB client-side limit

  useEffect(() => {
    // Initialize socket
    socketRef.current = initSocket();

    // Join task chat room
    socketRef.current.emit("join-task-chat", taskId);

    // Fetch existing messages
    fetchMessages();

    // Listen for incoming messages and normalize payload keys
    socketRef.current.on("receive-message", (data) => {
      const normalized = {
        id: data.id || data.messageId || null,
        task_id: data.taskId || data.task_id || null,
        sender_id: data.userId || data.sender_id || data.senderId || null,
        userName: data.userName || data.sender_name || data.senderName || data.sender_name,
        message: data.message || data.content || data.text || null,
        content: data.content || data.message || null,
        file_url: data.fileUrl || data.file_url || data.file || null,
        created_at: data.created_at || data.createdAt || new Date().toISOString(),
        replies: data.replies || [],
        read_count: data.read_count || 0,
      };

      setMessages((prev) => [...prev, normalized]);
    });

    // Listen for typing indicators
    socketRef.current.on("user-typing", (data) => {
      setTypingUsers((prev) => new Set([...prev, data.userName]));
    });

    socketRef.current.on("user-stop-typing", (data) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.userName);
        return newSet;
      });
    });

    // Listen for read receipts
    socketRef.current.on("read-receipt", (data) => {
      setMessages((prev) =>
        updateReadCount(prev, data.messageId)
      );
    });

    return () => {
      socketRef.current?.off("receive-message");
      socketRef.current?.off("user-typing");
      socketRef.current?.off("user-stop-typing");
      socketRef.current?.off("read-receipt");
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [taskId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/messages/${taskId}`);
      setMessages(response.data.messages || []);
      markVisibleMessagesAsRead(response.data.messages || []);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markVisibleMessagesAsRead = async (loadedMessages) => {
    const unreadMessages = flattenMessages(loadedMessages).filter(
      (message) => (message.userId ?? message.sender_id) !== userId
    );
    await Promise.all(
      unreadMessages.map(async (message) => {
        try {
          await api.post(`/messages/${message.id}/read`);
          socketRef.current?.emit("message-read", { taskId, messageId: message.id });
        } catch (error) {
          console.error("Failed to mark message as read:", error);
        }
      })
    );
  };

  const flattenMessages = (items) => {
    const result = [];
    items.forEach((item) => {
      result.push(item);
      if (Array.isArray(item.replies) && item.replies.length > 0) {
        result.push(...flattenMessages(item.replies));
      }
    });
    return result;
  };

  const updateReadCount = (items, messageId) => {
    return items.map((item) => {
      if (item.id === messageId) {
        return { ...item, read_count: (item.read_count || 0) + 1 };
      }

      if (Array.isArray(item.replies) && item.replies.length > 0) {
        return { ...item, replies: updateReadCount(item.replies, messageId) };
      }

      return item;
    });
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachmentName("");
      setAttachmentDataUrl("");
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert(`Attachment too large. Max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB`);
      event.target.value = null;
      return;
    }

    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentDataUrl(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  // Speech recognition (voice input) — graceful fallback
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript || '';
        setNewMessage((prev) => (prev ? prev + ' ' + text : text));
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error', err);
        setListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (e) {
      console.error('Failed to start recognition', e);
      alert('Unable to start speech recognition');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) {
      alert('Text-to-speech not supported in this browser');
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.error('TTS error', e);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() && !attachmentDataUrl) return;

    const payload = {
      taskId,
      message: newMessage,
      userId,
      userName,
      fileUrl: attachmentDataUrl || null,
      parentMessageId: replyToMessageId,
    };

    // Emit message via socket
    socketRef.current?.emit("send-message", payload);

    // Also save to database
    api.post(`/messages/${taskId}`, {
      content: newMessage,
      fileUrl: attachmentDataUrl || null,
      parentMessageId: replyToMessageId,
    })
      .then(() => fetchMessages())
      .catch((error) => {
        console.error("Failed to save message:", error);
      });

    setNewMessage("");
    setAttachmentDataUrl("");
    setAttachmentName("");
    setReplyToMessageId(null);
    socketRef.current?.emit("stop-typing", { taskId, userName });
  };

  const handleTyping = () => {
    socketRef.current?.emit("typing", { taskId, userName });
  };

  const isClosed = ["COMPLETED", "DISPUTED"].includes((taskStatus || "").toUpperCase());

  const outerClass = "flex flex-col h-[min(80vh,40rem)] border border-white/10 rounded-lg bg-surface/80 shadow-2xl";

  const Wrapper = ({ children }) => (
    standalone ? <div className={outerClass}>{children}</div> : <Card className={outerClass}>{children}</Card>
  );

  return (
    <Wrapper>
      {/* Messages Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-text/60">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-text/60">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              userId={userId}
              onReply={() => setReplyToMessageId(msg.id)}
              onShowAttachment={() => window.open(msg.file_url, "_blank")}
              renderReplies
            />
          ))
        )}

        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <p className="text-xs text-muted italic">
            {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4 bg-obsidian/90">
        {isClosed ? (
          <div className="p-3 rounded-lg bg-white/5 text-sm text-text/60">
            Chat closed — read-only conversation. You can view the history above.
          </div>
        ) : (
          <>
            {replyToMessageId && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-text">
                <span>Replying to message #{replyToMessageId}</span>
                <Button type="button" variant="ghost" onClick={() => setReplyToMessageId(null)} className="font-semibold">
                  Cancel reply
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                ref={inputRef}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                  try { inputRef.current?.focus(); } catch (e) {}
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-white/10 rounded-lg text-sm bg-surface/80 text-text focus:outline-none focus:ring-2 focus:ring-white/50 max-h-32"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (listening ? stopListening() : startListening())}
                  className={`px-3 py-2 rounded-lg text-sm transition border border-white/10 ${listening ? 'bg-white/6 text-text' : 'bg-white/3'}`}
                  aria-pressed={listening}
                  title={listening ? 'Stop voice input' : 'Start voice input'}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                >
                  <Mic size={16} />
                </button>

                <Button
                  onClick={handleSendMessage}
                  className="px-4 py-2 rounded-lg text-sm transition"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-text/60">
                Attachment
                <input type="file" className="ml-2 text-xs" onChange={handleAttachmentChange} aria-label="Add attachment" title="Add attachment" />
              </label>
              {attachmentName && <span className="text-xs text-text/60">Selected: {attachmentName}</span>}
            </div>
          </>
        )}
      </div>
    </Wrapper>
  );
}

function MessageBubble({ msg, userId, onReply, onShowAttachment }) {
  const isMine = msg.userId === userId || msg.sender_id === userId;

  return (
    <div className={`space-y-2 ${isMine ? "text-right" : "text-left"}`}>
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-xs rounded-lg px-3 py-2 ${isMine ? "bg-white/10 text-text border border-white/15" : "bg-white/5 text-text border border-white/10"}`}>
          <p className="text-xs font-semibold">{msg.userName || msg.sender_name}</p>
          {msg.message && <p className="text-sm">{msg.message}</p>}
          {msg.content && <p className="text-sm">{msg.content}</p>}
          {msg.file_url && (
            <button type="button" onClick={onShowAttachment} className="mt-2 text-xs font-semibold text-text underline">
              Open attachment
            </button>
          )}
          <p className="mt-1 text-xs text-muted">
            {new Date(msg.timestamp || msg.created_at).toLocaleTimeString()}
          </p>
          {isMine && Number(msg.read_count || 0) > 0 && <p className="text-[11px] text-text">Read</p>}
        </div>
      </div>

      <div className={`${isMine ? "flex justify-end" : "flex justify-start"}`}>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onReply} className="text-[11px] text-muted hover:text-text" title="Reply to message" aria-label="Reply to message">
            Reply
          </Button>
          <Button type="button" variant="ghost" onClick={() => speakText(msg.message || msg.content || '')} className="text-[11px] text-muted hover:text-text" title="Read message aloud" aria-label="Read message aloud">
            Speak
          </Button>
        </div>
      </div>

      {Array.isArray(msg.replies) && msg.replies.length > 0 && (
        <div className={`${isMine ? "mr-4" : "ml-4"} space-y-2 border-l border-white/10 pl-3`}>
          {msg.replies.map((reply) => (
            <MessageBubble key={reply.id} msg={reply} userId={userId} onReply={onReply} onShowAttachment={onShowAttachment} />
          ))}
        </div>
      )}
    </div>
  );
}
