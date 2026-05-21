import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import Button from "./Button";
import Card from "./Card";
import Badge from "./Badge";

const EMOJI_REACTIONS = ['👍', '🎉', '❤️', '😂', '🔥', '💯'];

export function CommentReactionsBar({ commentId, onEdit, onReply, canEdit }) {
  const [reactions, setReactions] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReactions();
  }, [commentId]);

  const fetchReactions = async () => {
    try {
      const response = await axios.get(`/api/comments-advanced/comments/${commentId}/reactions`);
      const reactionData = response.data.reactions || [];
      
      // Reorganize reactions by type
      const grouped = {};
      reactionData.forEach(r => {
        grouped[r.reaction_type] = {
          count: r.count || 1,
          users: r.user_ids || []
        };
      });
      setReactions(grouped);
    } catch (err) {
      console.error('Error fetching reactions:', err);
    }
  };

  const addReaction = async (emoji) => {
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(
        `/api/comments-advanced/comments/${commentId}/reactions`,
        { reactionType: emoji }
      );
      // Toggle reaction locally
      setUserReactions(prev => ({
        ...prev,
        [emoji]: !prev[emoji]
      }));
      await fetchReactions();
      setShowPicker(false);
    } catch (err) {
      console.error('Error adding reaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeReaction = async (emoji) => {
    if (loading) return;
    setLoading(true);
    try {
      await axios.delete(
        `/api/comments-advanced/comments/${commentId}/reactions/${emoji}`
      );
      setUserReactions(prev => ({
        ...prev,
        [emoji]: false
      }));
      await fetchReactions();
    } catch (err) {
      console.error('Error removing reaction:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-3 flex-wrap">
      {/* Existing Reactions */}
      {Object.entries(reactions).map(([emoji, data]) => (
        <Button
          key={emoji}
          onClick={() => userReactions[emoji] ? removeReaction(emoji) : addReaction(emoji)}
          className={`px-2 py-1 rounded-full text-sm transition flex items-center gap-1 ${
            userReactions[emoji]
              ? 'bg-cyan-500/30 border border-cyan-500 text-cyan-300'
              : 'bg-[#0f172a] border border-gray-600 text-gray-400 hover:border-gray-500'
          }`}
        >
          <span>{emoji}</span>
          <span className="text-xs font-medium">{data.count}</span>
        </Button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative">
        <Button
          onClick={() => setShowPicker(!showPicker)}
          className="px-2 py-1 rounded-full text-sm bg-[#0f172a] border border-gray-600 text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition"
        >
          +
        </Button>

        {showPicker && (
          <div className="absolute top-full left-0 mt-2 z-20 bg-[#1a1f3a] border border-cyan-500/30 rounded-lg p-2 flex gap-1 shadow-lg">
            {EMOJI_REACTIONS.map(emoji => (
              <Button
                key={emoji}
                onClick={() => addReaction(emoji)}
                className="text-xl hover:scale-125 transition cursor-pointer"
              >
                {emoji}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <Button
        onClick={onReply}
        className="ml-2 px-2 py-1 rounded text-sm text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition flex items-center gap-1"
      >
        <MessageCircle className="w-3 h-3" />
        <span className="text-xs">Reply</span>
      </Button>

      {canEdit && (
        <Button
          onClick={onEdit}
          className="px-2 py-1 rounded text-sm text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition flex items-center gap-1"
        >
          <span className="text-xs">Edit</span>
        </Button>
      )}
    </div>
  );
}

// Detailed Reactions Display
export function ReactionsDisplay({ commentId, reactions = [] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {reactions.map((r, idx) => (
        <Card
          key={idx}
          className="bg-[#0f172a] border border-cyan-500/20 rounded-full px-3 py-1 flex items-center gap-2 group cursor-pointer hover:border-cyan-500/50 transition"
        >
          <span className="text-lg">{r.reaction_type}</span>
          <span className="text-xs text-gray-400 group-hover:text-gray-300">{r.count}</span>
        </Card>
      ))}
    </div>
  );
}

// Reactions Summary
export function ReactionsSummary({ commentId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await axios.get(
          `/api/comments-advanced/comments/${commentId}/reactions`
        );
        setSummary(response.data.reactions);
      } catch (err) {
        console.error('Error fetching reaction summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [commentId]);

  if (loading || !summary || summary.length === 0) return null;

  const totalReactions = summary.reduce((sum, r) => sum + (r.count || 1), 0);

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
      <div className="flex -space-x-2">
        {summary.slice(0, 3).map((r, idx) => (
          <span key={idx} className="text-sm">
            {r.reaction_type}
          </span>
        ))}
      </div>
      <span>{totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}</span>
    </div>
  );
}

// Edit History Modal
export function CommentEditHistory({ commentId, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, commentId]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(
        `/api/comments-advanced/comments/${commentId}/history`
      );
      setHistory(response.data.history || []);
    } catch (err) {
      console.error('Error fetching edit history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1f3a] border border-cyan-500/30 rounded-lg max-w-2xl w-full max-h-96 overflow-auto">
        <div className="sticky top-0 bg-[#1a1f3a] border-b border-cyan-500/20 p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-cyan-400">Edit History</h2>
          <Button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            ✕
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center text-gray-400">Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-gray-500">No edit history</div>
          ) : (
            history.map((edit, idx) => (
              <div key={idx} className="border-l-2 border-cyan-500/20 pl-4 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-gray-400">
                    Edited by <span className="text-cyan-400">{edit.editor_name}</span>
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(edit.edited_at).toLocaleString()}
                  </span>
                </div>
                <div className="bg-[#0f172a] p-2 rounded text-sm text-gray-300 max-h-20 overflow-y-auto">
                  {edit.previous_content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
