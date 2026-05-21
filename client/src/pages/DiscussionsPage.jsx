import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

const initialPost = {
  title: "",
  content: "",
  category: "Web Development",
  tags: "",
};

const categories = ["Web Development", "AI", "Cloud", "Security", "Mobile", "DevOps"];

export default function DiscussionsPage() {
  const { isAuthenticated } = useAuth();
  const { postId } = useParams();
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [recommendedPosts, setRecommendedPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [thread, setThread] = useState([]);
  const [form, setForm] = useState(initialPost);
  const [postComment, setPostComment] = useState("");
  const [replyText, setReplyText] = useState("");
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPosts();
    fetchDiscoveryLists();
  }, []);

  useEffect(() => {
    if (postId) {
      viewPost(postId);
    }
  }, [postId]);

  async function fetchPosts(nextSearch = search) {
    try {
      const params = {};
      if (nextSearch.trim()) {
        params.q = nextSearch.trim();
      }

      const response = await api.get("/posts", { params });
      const posts = response.data.posts || [];
      posts.sort((a, b) => {
        const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
        const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
        if (bDate !== aDate) return bDate - aDate;
        return (b.id || 0) - (a.id || 0);
      });
      setPosts(posts);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load discussions");
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    fetchPosts(search);
  }

  async function fetchDiscoveryLists() {
    if (!isAuthenticated) {
      setSavedPosts([]);
      setRecommendedPosts([]);
      return;
    }

    try {
      const [savedResponse, recommendedResponse] = await Promise.all([
        api.get("/posts/saved"),
        api.get("/posts/recommended"),
      ]);

      setSavedPosts(savedResponse.data.posts || []);
      setRecommendedPosts(recommendedResponse.data.posts || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load saved or recommended posts");
    }
  }

  async function viewPost(postId) {
    try {
      const [postResponse, commentsResponse] = await Promise.all([
        api.get(`/posts/${postId}`),
        api.get(`/comments/posts/${postId}/comments`),
      ]);

      setSelectedPost(postResponse.data.post);
      setThread(commentsResponse.data.comments || []);
      setActiveReplyId(null);
      setReplyText("");
      setPostComment("");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load post");
    }
  }

  async function handleCreatePost(event) {
    event.preventDefault();
    setError("");

    try {
      await api.post("/posts", {
        title: form.title,
        content: form.content,
        category: form.category,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setForm(initialPost);
      await fetchPosts();
      await fetchDiscoveryLists();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create post");
    }
  }

  async function handleVote(postId, type) {
    try {
      await api.post(`/posts/${postId}/vote`, { type });
      await fetchPosts();
      if (selectedPost?.id === postId) {
        await viewPost(postId);
      }
      await fetchDiscoveryLists();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to vote");
    }
  }

  async function toggleSavedPost(postId) {
    try {
      await api.post(`/posts/${postId}/save`);
      await fetchDiscoveryLists();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update saved posts");
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    if (!selectedPost || !postComment.trim()) return;

    try {
      await api.post(`/comments/posts/${selectedPost.id}/comments`, {
        content: postComment,
      });
      setPostComment("");
      await viewPost(selectedPost.id);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to add comment");
    }
  }

  async function handleReplySubmit(event, parentCommentId) {
    event.preventDefault();
    if (!selectedPost || !replyText.trim()) return;

    try {
      await api.post(`/comments/posts/${selectedPost.id}/comments`, {
        content: replyText,
        parentCommentId,
      });
      setReplyText("");
      setActiveReplyId(null);
      await viewPost(selectedPost.id);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to add reply");
    }
  }

  async function handleCommentVote(commentId, voteType) {
    try {
      await api.post(`/comments/comments/${commentId}/vote`, { voteType });
      if (selectedPost) {
        await viewPost(selectedPost.id);
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to vote on comment");
    }
  }

  const savedPostIds = new Set(savedPosts.map((post) => post.id));

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] fade-in">
      <div className="space-y-4">
        {isAuthenticated && (
          <form onSubmit={handleCreatePost} className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Create Post</h2>
              <span className="text-xs uppercase tracking-wide text-muted">News feed</span>
            </div>
            <input
              className="input"
              placeholder="Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
            <textarea
              className="input min-h-28"
              placeholder="Content"
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="input"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                required
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Tags (comma separated)"
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              />
            </div>
              <Button>Publish Post</Button>
          </form>
        )}

        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Discover Posts</h2>
              <p className="text-sm text-text/60 mt-1">Search posts by title, content, or tags.</p>
            </div>
            <Button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearch("");
                fetchPosts("");
              }}
            >
              Reset
            </Button>
          </div>
          <form onSubmit={handleSearchSubmit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className="input"
              placeholder="Search posts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button type="submit">Search</Button>
          </form>
        </div>

        <div className="space-y-3">
          {posts.map((post) => (
            <article key={post.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{post.title}</h3>
                  <p className="text-xs text-text/60 mt-1">By {post.author_name}</p>
                </div>
                <span className="rounded-full bg-danger/15 px-2 py-1 text-xs text-danger">{post.category}</span>
              </div>

              <p className="mt-3 text-sm text-text/75 line-clamp-3">{post.content}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => viewPost(post.id)}>Open Thread</Button>
                {isAuthenticated && (
                  <>
                      <Button variant="secondary" onClick={() => handleVote(post.id, "UP")}>Upvote</Button>
                      <Button variant="secondary" onClick={() => handleVote(post.id, "DOWN")}>Downvote</Button>
                      <Button variant="secondary" onClick={() => toggleSavedPost(post.id)}>
                        {savedPostIds.has(post.id) ? "Unsave" : "Save"}
                      </Button>
                  </>
                )}
                <span className="text-xs text-text/60">Score: {post.score}</span>
              </div>
            </article>
          ))}
        </div>

        {isAuthenticated && (
          <div className="grid gap-4 md:grid-cols-2">
            <article className="card space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Recommended Posts</h2>
                <span className="text-xs text-muted">{recommendedPosts.length}</span>
              </div>
              {recommendedPosts.length === 0 ? (
                <p className="text-sm text-text/60">No recommendations yet.</p>
              ) : (
                recommendedPosts.slice(0, 4).map((post) => (
                  <Button
                    key={post.id}
                    type="button"
                    className="w-full rounded-2xl border border-white/10 bg-surface/80 p-3 text-left justify-start"
                    onClick={() => viewPost(post.id)}
                  >
                    <div className="flex flex-col text-left">
                      <p className="font-medium">{post.title}</p>
                      <p className="text-xs text-text/60 mt-1">Score {post.score} | Match {post.match_score ?? 0}</p>
                    </div>
                  </Button>
                ))
              )}
            </article>

            <article className="card space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Saved Posts</h2>
                <span className="text-xs text-muted">{savedPosts.length}</span>
              </div>
              {savedPosts.length === 0 ? (
                <p className="text-sm text-text/60">No saved posts yet.</p>
              ) : (
                savedPosts.slice(0, 4).map((post) => (
                  <Button
                    key={post.id}
                    type="button"
                    className="w-full rounded-2xl border border-white/10 bg-surface/80 p-3 text-left justify-start"
                    onClick={() => viewPost(post.id)}
                  >
                    <div className="flex flex-col text-left">
                      <p className="font-medium">{post.title}</p>
                      <p className="text-xs text-text/60 mt-1">By {post.author_name}</p>
                    </div>
                  </Button>
                ))
              )}
            </article>
          </div>
        )}
      </div>

      <aside className="card h-fit space-y-4">
        <h2 className="text-lg font-semibold">Thread Detail</h2>

        {!selectedPost ? (
          <p className="text-sm text-text/70">Select a post to read and reply.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-surface/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">{selectedPost.title}</h3>
                <span className="text-xs text-text/60">Score {selectedPost.score}</span>
              </div>
              <p className="mt-2 text-sm text-text/80">{selectedPost.content}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Comments</h3>
              {thread.length === 0 ? (
                <p className="text-sm text-text/60">No comments yet.</p>
              ) : (
                thread.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    depth={0}
                    activeReplyId={activeReplyId}
                    setActiveReplyId={setActiveReplyId}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    onReplySubmit={handleReplySubmit}
                    onVote={handleCommentVote}
                  />
                ))
              )}
            </div>

            {isAuthenticated && (
              <form onSubmit={handleCommentSubmit} className="space-y-2 border-t border-white/10 pt-4">
                <textarea
                  className="input min-h-24"
                  placeholder="Add comment"
                  value={postComment}
                  onChange={(event) => setPostComment(event.target.value)}
                  required
                />
                  <Button>Comment on Post</Button>
              </form>
            )}
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {isAuthenticated && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <article className="rounded-2xl border border-white/10 bg-surface/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Saved Posts</h3>
                <span className="text-xs text-muted">{savedPosts.length}</span>
              </div>
              {savedPosts.length === 0 ? (
                <p className="text-sm text-text/60">Saved posts will appear here.</p>
              ) : (
                savedPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className="w-full rounded-xl border border-white/10 p-3 text-left hover:border-neon/30"
                    onClick={() => viewPost(post.id)}
                  >
                    <p className="text-sm font-medium">{post.title}</p>
                    <p className="text-xs text-text/60 mt-1">By {post.author_name}</p>
                  </button>
                ))
              )}
            </article>
          </div>
        )}
      </aside>
    </section>
  );
}

function CommentNode({
  comment,
  depth,
  activeReplyId,
  setActiveReplyId,
  replyText,
  setReplyText,
  onReplySubmit,
  onVote,
}) {
  const score = Number(comment.upvotes || 0) - Number(comment.downvotes || 0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Determine background colors based on depth for visual hierarchy
  const getDepthStyles = () => {
    const baseIndent = depth * 6; // 6px per depth level
    const bgColors = [
      "bg-surface/80",           // depth 0: original color
      "bg-slate-800/60",         // depth 1: darker
      "bg-slate-800/40",         // depth 2: even darker
      "bg-slate-800/20",         // depth 3+: very subtle
    ];
    const borderColors = [
      "border-white/10",         // depth 0
      "border-white/8",          // depth 1
      "border-white/5",          // depth 2
      "border-white/5",          // depth 3+
    ];
    
    const bgColor = bgColors[Math.min(depth, 3)];
    const borderColor = borderColors[Math.min(depth, 3)];
    
    return { baseIndent, bgColor, borderColor };
  };
  
  const { baseIndent, bgColor, borderColor } = getDepthStyles();
  const hasReplies = Array.isArray(comment.replies) && comment.replies.length > 0;

  return (
    <div style={{ marginLeft: `${baseIndent}px` }} className="space-y-2">
      <article className={`rounded-lg border ${borderColor} ${bgColor} p-3 transition-all hover:border-white/15`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text">{comment.author_name}</p>
              <p className="text-xs text-muted">Rep {comment.reputation}</p>
            </div>
            
            {/* Reply-to context */}
            {comment.reply_to_author_name && (
              <p className="text-xs text-cyan-400/70 mt-1">
                → replying to <span className="font-medium">{comment.reply_to_author_name}</span>
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {hasReplies && (
                <Button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="text-xs px-2 py-1"
                >
                  {isCollapsed ? `▶ ${comment.replies.length}` : `▼ ${comment.replies.length}`}
                </Button>
            )}
            <span className="text-xs text-muted">Score {score}</span>
          </div>
        </div>

        <p className="mt-2 text-sm text-text/85 leading-relaxed">{comment.content}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => onVote(comment.id, "UP") }>
            Upvote
          </Button>
          <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => onVote(comment.id, "DOWN") }>
            Downvote
          </Button>
          <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => setActiveReplyId(activeReplyId === comment.id ? null : comment.id)}>
            Reply
          </Button>
        </div>
      </article>

      {activeReplyId === comment.id && (
        <form onSubmit={(event) => onReplySubmit(event, comment.id)} className="space-y-2 border-l-2 border-cyan-500/30 pl-3">
          <div className="text-xs text-cyan-400/70 font-medium">Replying to {comment.author_name}</div>
          <textarea
            className="input min-h-20 text-xs"
            placeholder="Write a reply"
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" className="text-xs px-3 py-1">Post Reply</Button>
            <Button variant="secondary" type="button" className="text-xs px-3 py-1" onClick={() => setActiveReplyId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {hasReplies && !isCollapsed && (
        <div className="space-y-2 mt-2">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              activeReplyId={activeReplyId}
              setActiveReplyId={setActiveReplyId}
              replyText={replyText}
              setReplyText={setReplyText}
              onReplySubmit={onReplySubmit}
              onVote={onVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
