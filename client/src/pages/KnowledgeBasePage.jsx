import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

const initialArticleForm = {
  title: "",
  summary: "",
  content: "",
  categoryName: "",
  tags: "",
  difficulty: "BEGINNER",
  visibility: "PUBLIC",
};

export default function KnowledgeBasePage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [linkedEntities, setLinkedEntities] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(false);
  const [error, setError] = useState("");
  const [gapMessage, setGapMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(initialArticleForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [relationForm, setRelationForm] = useState({ relatedArticleId: "", relationType: "RELATED" });
  const [linkForm, setLinkForm] = useState({ entityType: "TASK", entityId: "", relationType: "RELATED" });
  const [moderationForm, setModerationForm] = useState({ visibility: "PUBLIC", status: "DRAFT", featured: false });

  const canEditArticle = useMemo(() => {
    if (!selectedArticle) {
      return false;
    }

    return Boolean(user?.isAdmin || selectedArticle.author_id === user?.id);
  }, [selectedArticle, user]);

  useEffect(() => {
    loadKnowledgeBase();
  }, [user?.isAdmin]);

  useEffect(() => {
    const draftArticleId = location.state?.draftArticleId;

    if (draftArticleId) {
      openArticle(draftArticleId);
      navigate("/knowledge-base", { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.draftArticleId]);

  async function loadKnowledgeBase(nextSearch = search, nextCategory = category) {
    try {
      setLoading(true);
      const params = {};

      if (nextSearch.trim()) {
        params.q = nextSearch.trim();
      }

      if (nextCategory) {
        params.category = nextCategory;
      }

      const requests = [
        api.get("/knowledge-base", { params }),
        api.get("/knowledge-base/categories"),
      ];

      if (user?.isAdmin) {
        requests.push(api.get("/knowledge-base/gaps"));
      }

      const [articlesResponse, categoriesResponse, gapsResponse] = await Promise.all(requests);

      setArticles(articlesResponse.data.articles || []);
      setCategories(categoriesResponse.data.categories || []);
      setGaps(gapsResponse?.data?.gaps || []);
      setError("");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load knowledge base");
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(articleId) {
    try {
      setArticleLoading(true);
      const response = await api.get(`/knowledge-base/${articleId}`);
      setSelectedArticle(response.data.article);
      setRevisions(response.data.revisions || []);
      setRelatedArticles(response.data.relatedArticles || []);
      setLinkedEntities(response.data.linkedEntities || []);
      setModerationForm({
        visibility: response.data.article.visibility || "PUBLIC",
        status: response.data.article.status || "DRAFT",
        featured: Boolean(response.data.article.featured),
      });
      setRelationForm({ relatedArticleId: "", relationType: "RELATED" });
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load article");
    } finally {
      setArticleLoading(false);
    }
  }

  async function handleCreateArticle(event) {
    event.preventDefault();

    try {
      await api.post("/knowledge-base", {
        title: form.title,
        summary: form.summary,
        content: form.content,
        categoryName: form.categoryName,
        tags: form.tags,
        difficulty: form.difficulty,
        visibility: form.visibility,
      });

      setForm(initialArticleForm);
      setShowCreateForm(false);
      await loadKnowledgeBase();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create article");
    }
  }

  async function handlePublishArticle(articleId) {
    try {
      await api.patch(`/knowledge-base/${articleId}/publish`);
      await loadKnowledgeBase();
      if (selectedArticle?.id === articleId) {
        await openArticle(articleId);
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to publish article");
    }
  }

  async function handleUnpublishArticle(articleId) {
    try {
      await api.patch(`/knowledge-base/${articleId}/unpublish`);
      await loadKnowledgeBase();
      if (selectedArticle?.id === articleId) {
        await openArticle(articleId);
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to unpublish article");
    }
  }

  async function handleModerateArticle(event) {
    event.preventDefault();

    if (!selectedArticle) {
      return;
    }

    try {
      await api.patch(`/knowledge-base/${selectedArticle.id}/moderate`, moderationForm);
      await loadKnowledgeBase();
      await openArticle(selectedArticle.id);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update moderation settings");
    }
  }

  async function handleVote(articleId, voteType) {
    try {
      await api.post(`/knowledge-base/${articleId}/vote`, { vote: voteType });
      await openArticle(articleId);
      await loadKnowledgeBase();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to record vote");
    }
  }

  async function handleToggleBookmark(articleId) {
    try {
      if (selectedArticle?.bookmarked_by_user) {
        await api.delete(`/knowledge-base/${articleId}/bookmark`);
      } else {
        await api.post(`/knowledge-base/${articleId}/bookmark`);
      }

      await openArticle(articleId);
      await loadKnowledgeBase();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update bookmark");
    }
  }

  async function handleAddRelation(event) {
    event.preventDefault();

    if (!selectedArticle || !relationForm.relatedArticleId.trim()) {
      return;
    }

    try {
      await api.post(`/knowledge-base/${selectedArticle.id}/relations`, {
        relatedArticleId: relationForm.relatedArticleId,
        relationType: relationForm.relationType,
      });
      await openArticle(selectedArticle.id);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to add relation");
    }
  }

  async function handleAddEntityLink(event) {
    event.preventDefault();

    if (!selectedArticle || !linkForm.entityId.trim()) {
      return;
    }

    try {
      await api.post(`/knowledge-base/${selectedArticle.id}/links`, {
        entityType: linkForm.entityType,
        entityId: Number(linkForm.entityId),
        relationType: linkForm.relationType,
      });
      await openArticle(selectedArticle.id);
      setLinkForm({ entityType: "TASK", entityId: "", relationType: "RELATED" });
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to add link");
    }
  }

  async function handleRequestGap(queryText = search) {
    if (!queryText.trim()) {
      return;
    }

    try {
      await api.post("/knowledge-base/gaps", {
        queryText,
        source: "KB_PAGE",
        resultCount: articles.length,
      });
      setGapMessage(`Queued a KB request for "${queryText}".`);
      await loadKnowledgeBase();
    } catch (apiError) {
      setGapMessage(apiError.response?.data?.message || "Unable to record KB request");
    }
  }

  async function handleMarkGap(gapId, nextStatus) {
    try {
      await api.patch(`/knowledge-base/gaps/${gapId}`, { status: nextStatus });
      await loadKnowledgeBase();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update gap status");
    }
  }

  async function handleConvertGap(gapId) {
    try {
      const resp = await api.post(`/knowledge-base/gaps/${gapId}/convert`, {});
      const newArticle = resp.data.article;
      await loadKnowledgeBase();
      if (newArticle?.id) {
        openArticle(newArticle.id);
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to convert gap to article");
    }
  }

  async function handleRemoveRelation(relatedArticleId, relationType = "RELATED") {
    if (!selectedArticle) {
      return;
    }

    try {
      await api.delete(`/knowledge-base/${selectedArticle.id}/relations/${relatedArticleId}`, {
        params: { relationType },
      });
      await openArticle(selectedArticle.id);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to remove relation");
    }
  }

  const canManageArticle = useMemo(() => {
    if (!selectedArticle) {
      return false;
    }

    return Boolean(user?.isAdmin || selectedArticle.author_id === user?.id);
  }, [selectedArticle, user]);

  const canModerateArticle = Boolean(user?.isAdmin);
  const canInteractWithArticle = Boolean(isAuthenticated);

  const selectedTags = selectedArticle?.tags || [];

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] fade-in">
      <div className="space-y-4">
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Knowledge Base</h1>
              <p className="mt-1 text-sm text-text/70">Curated guides, workflows, and platform know-how.</p>
            </div>
            {isAuthenticated && (
              <Button className="text-sm" onClick={() => setShowCreateForm((prev) => !prev)}>
                {showCreateForm ? "Close" : "New Article"}
              </Button>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
            <input
              className="input"
              placeholder="Search knowledge base"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" type="button" onClick={() => loadKnowledgeBase()}>
              Filter
            </Button>
          </div>
        </div>

        {showCreateForm && isAuthenticated && (
          <form onSubmit={handleCreateArticle} className="card space-y-3">
            <h2 className="text-lg font-semibold">Create Article</h2>
            <input
              className="input"
              placeholder="Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
            <input
              className="input"
              placeholder="Category name"
              value={form.categoryName}
              onChange={(event) => setForm((prev) => ({ ...prev, categoryName: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Tags comma separated"
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
            <select
              className="input"
              value={form.difficulty}
              onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
            <select
              className="input"
              value={form.visibility}
              onChange={(event) => setForm((prev) => ({ ...prev, visibility: event.target.value }))}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <input
              className="input"
              placeholder="Summary"
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            />
            <textarea
              className="input min-h-[180px]"
              placeholder="Article content"
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              required
            />
            <Button type="submit">Save Draft</Button>
          </form>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="text-sm text-text/60">Loading knowledge base...</p>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => openArticle(article.id)}
                className={`w-full rounded-3xl border p-4 text-left transition ${
                  selectedArticle?.id === article.id
                    ? "border-neon bg-neon/10"
                    : "border-white/10 bg-surface/80 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-text/60">
                  <span>{article.category_name || "Uncategorized"}</span>
                  <span>•</span>
                  <span>{article.difficulty}</span>
                  <span>•</span>
                  <span>{article.read_time_minutes || 1} min read</span>
                  {article.featured && <Badge tone="neon" className="px-2 py-0.5">Featured</Badge>}
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      article.confidence_status === "VERIFIED"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : article.confidence_status === "NEEDS_REVIEW"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-white/5 text-text/60"
                    }`}
                  >
                    {article.confidence_status || "TRUSTED"} · {article.confidence_score ?? 0}
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-text">{article.title}</p>
                <p className="mt-1 text-sm text-text/70 line-clamp-2">{article.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                  {(article.tags || []).slice(0, 4).map((tag) => (
                    <Badge key={tag} className="px-2 py-1">#{tag}</Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card min-h-[480px] space-y-4">
          {!selectedArticle ? (
            <div className="flex h-full min-h-[420px] items-center justify-center text-center text-text/60">
              Select an article to read the full guide, revisions, and related resources.
            </div>
          ) : articleLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-text/60">Loading article...</div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs text-text/60">
                    <span>{selectedArticle.category_name || "Uncategorized"}</span>
                    <span>•</span>
                    <span>{selectedArticle.difficulty}</span>
                    <span>•</span>
                    <span>{selectedArticle.visibility}</span>
                    <span>•</span>
                    <span>
                      {selectedArticle.confidence_status || "TRUSTED"} · {selectedArticle.confidence_score ?? 0}
                    </span>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-text">{selectedArticle.title}</h2>
                  <p className="mt-2 text-sm text-text/70">{selectedArticle.summary}</p>
                </div>
                {canEditArticle && (
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.status === "PUBLISHED" ? (
                      <Button variant="secondary" className="text-sm" onClick={() => handleUnpublishArticle(selectedArticle.id)}>
                        Unpublish
                      </Button>
                    ) : (
                      <Button className="text-sm" onClick={() => handlePublishArticle(selectedArticle.id)}>
                        Publish
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {canInteractWithArticle ? (
                    <>
                      <Button variant="ghost" onClick={() => handleVote(selectedArticle.id, 'UP')}>👍</Button>
                      <Button variant="ghost" onClick={() => handleVote(selectedArticle.id, 'DOWN')}>👎</Button>
                      <Button variant="secondary" className={`${selectedArticle.bookmarked_by_user ? 'bg-white/10' : ''}`} onClick={() => handleToggleBookmark(selectedArticle.id)}>
                        {selectedArticle.bookmarked_by_user ? 'Bookmarked' : 'Bookmark'}
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => navigate("/auth")}>Login to interact</Button>
                  )}
                </div>
              </div>

              {canModerateArticle && (
                <form onSubmit={handleModerateArticle} className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">Moderation</h3>
                    <span className="text-xs text-text/60">Admin controls</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-sm text-text/70">
                      <span>Visibility</span>
                      <select
                        className="input"
                        value={moderationForm.visibility}
                        onChange={(event) => setModerationForm((prev) => ({ ...prev, visibility: event.target.value }))}
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="PRIVATE">Private</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-text/70">
                      <span>Status</span>
                      <select
                        className="input"
                        value={moderationForm.status}
                        onChange={(event) => setModerationForm((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-surface/60 px-3 py-2 text-sm text-text/80">
                      <input
                        type="checkbox"
                        checked={moderationForm.featured}
                        onChange={(event) => setModerationForm((prev) => ({ ...prev, featured: event.target.checked }))}
                      />
                      Featured article
                    </label>
                  </div>
                  <button type="submit" className="btn-secondary text-sm">
                    Apply moderation
                  </button>
                </form>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-text/70">
                    #{tag}
                  </span>
                ))}
              </div>

              {canManageArticle && (
                <form onSubmit={handleAddEntityLink} className="grid gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[140px_1fr_160px_auto]">
                  <select
                    className="input"
                    value={linkForm.entityType}
                    onChange={(event) => setLinkForm((prev) => ({ ...prev, entityType: event.target.value }))}
                  >
                    <option value="TASK">Task</option>
                    <option value="TEAM">Team</option>
                    <option value="DISCUSSION">Discussion</option>
                    <option value="ARTICLE">Article</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Entity ID"
                    value={linkForm.entityId}
                    onChange={(event) => setLinkForm((prev) => ({ ...prev, entityId: event.target.value }))}
                  />
                  <select
                    className="input"
                    value={linkForm.relationType}
                    onChange={(event) => setLinkForm((prev) => ({ ...prev, relationType: event.target.value }))}
                  >
                    <option value="RELATED">Related</option>
                    <option value="REFERENCE">Reference</option>
                    <option value="DEPENDS_ON">Depends on</option>
                  </select>
                  <button type="submit" className="btn-secondary">
                    Link resource
                  </button>
                </form>
              )}

              <article className="prose prose-invert max-w-none rounded-3xl border border-white/10 bg-obsidian/60 p-4 text-sm leading-7 text-text/80">
                <pre className="whitespace-pre-wrap font-sans">{selectedArticle.content}</pre>
              </article>

              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard label="Views" value={selectedArticle.view_count || 0} />
                <InfoCard label="Score" value={selectedArticle.score ?? selectedArticle.vote_score ?? 0} />
                <InfoCard label="Bookmarks" value={selectedArticle.bookmark_count || 0} />
                <InfoCard label="Confidence" value={`${selectedArticle.confidence_score ?? 0}/100`} />
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">Revision History</h3>
                {revisions.length > 0 ? (
                  <div className="space-y-3">
                    {revisions.map((revision) => (
                      <div key={revision.id} className="rounded-2xl border border-white/10 bg-surface/80 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text/60">
                          <span>{revision.editor_name}</span>
                          <span>{new Date(revision.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 font-medium text-text">{revision.previous_title}</p>
                        {revision.previous_summary && <p className="mt-1 text-text/70">{revision.previous_summary}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text/60">No revisions yet.</p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">Knowledge Graph</h3>
                {linkedEntities.length > 0 && (
                  <div className="space-y-2">
                    {linkedEntities.map((link) => (
                      <div key={link.link_id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-text">{link.resolved_label}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-text/50">
                              {link.entity_type} · {link.relation_type}
                            </p>
                          </div>
                          {link.entity_type === "TASK" && (
                            <button type="button" className="text-xs text-neon" onClick={() => navigate(`/task/${link.entity_id}`)}>
                              Open
                            </button>
                          )}
                          {link.entity_type === "ARTICLE" && (
                            <button type="button" className="text-xs text-neon" onClick={() => openArticle(link.entity_id)}>
                              Open
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">Related Articles</h3>
                {canManageArticle && (
                  <form onSubmit={handleAddRelation} className="grid gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[1fr_180px_auto]">
                    <input
                      className="input"
                      placeholder="Related article ID"
                      value={relationForm.relatedArticleId}
                      onChange={(event) => setRelationForm((prev) => ({ ...prev, relatedArticleId: event.target.value }))}
                    />
                    <select
                      className="input"
                      value={relationForm.relationType}
                      onChange={(event) => setRelationForm((prev) => ({ ...prev, relationType: event.target.value }))}
                    >
                      <option value="RELATED">Related</option>
                      <option value="SEE_ALSO">See also</option>
                      <option value="DEPENDENCY">Dependency</option>
                    </select>
                    <button type="submit" className="btn-secondary">
                      Link article
                    </button>
                  </form>
                )}
                {relatedArticles.length > 0 ? (
                  <div className="space-y-2">
                    {relatedArticles.map((article) => (
                      <div
                        key={`${article.relation_id}-${article.id}`}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-neon/50 hover:bg-neon/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" onClick={() => openArticle(article.id)} className="text-left">
                            <p className="font-medium text-text">{article.title}</p>
                            <p className="mt-1 text-text/60 line-clamp-2">{article.summary}</p>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-text/60">
                              {article.relation_type || "RELATED"}
                            </span>
                            {canManageArticle && (
                              <button
                                type="button"
                                className="text-xs text-text/50 hover:text-danger"
                                onClick={() => handleRemoveRelation(article.id, article.relation_type || "RELATED")}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text/60">No related articles linked yet.</p>
                )}
              </section>

              {canModerateArticle && gaps.length > 0 && (
                <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">Open KB Requests</h3>
                    <span className="text-xs text-text/50">Gap detection</span>
                  </div>
                  <div className="space-y-2">
                    {gaps.map((gap) => (
                      <div key={gap.id} className="w-full rounded-2xl border border-white/10 bg-surface/80 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-left">
                            <p className="font-medium text-text">{gap.query_text}</p>
                            <p className="text-xs text-text/50">{gap.occurrence_count} requests · {gap.status}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" className="btn-ghost text-xs" onClick={() => setSearch(gap.query_text)}>
                              Search
                            </button>
                            <button type="button" className="btn-ghost text-xs" onClick={() => handleMarkGap(gap.id, 'IN_PROGRESS')}>
                              Mark In Progress
                            </button>
                            <button type="button" className="btn-ghost text-xs" onClick={() => handleMarkGap(gap.id, 'RESOLVED')}>
                              Resolve
                            </button>
                            <button type="button" className="btn-secondary text-xs" onClick={() => handleConvertGap(gap.id)}>
                              Convert to Draft
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {!canModerateArticle && search.trim() && articles.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-text/70">
                  <p>No articles match this topic yet.</p>
                  <button type="button" className="mt-3 btn-secondary text-sm" onClick={() => handleRequestGap(search)}>
                    Request an article for this topic
                  </button>
                </div>
              )}

              {gapMessage && <p className="text-sm text-text/60">{gapMessage}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-text">{value}</p>
    </div>
  );
}
