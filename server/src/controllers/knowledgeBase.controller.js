import { pool } from "../config/db.js";
import { indexKnowledgeItem } from "../services/semantic.service.js";

function toSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 240);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function calculateReadTime(content) {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function normalizeGapQuery(query) {
  return String(query || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 255);
}

function buildConfidenceColumns(alias = "a") {
  return `
    CASE
      WHEN COALESCE(v.vote_total, 0) >= 5 AND ${alias}.updated_at > NOW() - INTERVAL '30 days' THEN 'VERIFIED'
      WHEN COALESCE(v.vote_total, 0) < 0 OR ${alias}.updated_at < NOW() - INTERVAL '180 days' THEN 'NEEDS_REVIEW'
      ELSE 'TRUSTED'
    END AS confidence_status,
    LEAST(
      100,
      GREATEST(
        0,
        ROUND(
          50
          + COALESCE(v.vote_total, 0) * 8
          + LEAST(COALESCE(${alias}.view_count, 0)::numeric / 10, 20)
          + CASE WHEN ${alias}.featured THEN 10 ELSE 0 END
          - LEAST(EXTRACT(EPOCH FROM (NOW() - COALESCE(${alias}.updated_at, ${alias}.created_at))) / 86400 / 10, 25)
        )
      )
    )::int AS confidence_score,
    CASE
      WHEN COALESCE(v.vote_total, 0) < 0 OR ${alias}.updated_at < NOW() - INTERVAL '180 days' THEN TRUE
      ELSE FALSE
    END AS needs_review,
    COALESCE(${alias}.updated_at, ${alias}.published_at, ${alias}.created_at) AS last_verified_at
  `;
}

async function ensureUniqueSlug(baseSlug, articleId = null) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const params = [slug];
    let query = "SELECT id FROM kb_articles WHERE slug = $1";

    if (articleId) {
      params.push(articleId);
      query += " AND id <> $2";
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function attachTags(articleId, tags) {
  if (!tags.length) {
    return;
  }

  const values = [];
  const placeholders = [];

  tags.forEach((tag, index) => {
    values.push(articleId, tag);
    placeholders.push(`($${index * 2 + 1}, $${index * 2 + 2})`);
  });

  await pool.query(
    `INSERT INTO kb_article_tags (article_id, tag)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (article_id, tag) DO NOTHING`,
    values
  );
}

async function attachLinks(articleId, links) {
  if (!Array.isArray(links) || links.length === 0) {
    return;
  }

  const values = [];
  const placeholders = [];

  links.forEach((link, index) => {
    values.push(articleId, link.entityType, link.entityId, link.entityLabel || null, link.relationType || "RELATED");
    placeholders.push(`($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`);
  });

  await pool.query(
    `INSERT INTO kb_article_links (article_id, entity_type, entity_id, entity_label, relation_type)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (article_id, entity_type, entity_id, relation_type) DO UPDATE SET
       entity_label = COALESCE(EXCLUDED.entity_label, kb_article_links.entity_label)`,
    values
  );
}

async function loadArticle(articleId, includeDrafts = false) {
  const articleQuery = `
    SELECT a.*, u.name AS author_name, c.name AS category_name,
           COALESCE(v.vote_total, 0) AS score,
           COALESCE(b.bookmark_total, 0) AS bookmark_count,
           COALESCE(t.tags, ARRAY[]::text[]) AS tags,
           ${buildConfidenceColumns("a")}
    FROM kb_articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN kb_categories c ON c.id = a.category_id
    LEFT JOIN (
      SELECT article_id, SUM(CASE WHEN vote_type = 'UP' THEN 1 WHEN vote_type = 'DOWN' THEN -1 ELSE 0 END) AS vote_total
      FROM kb_article_votes
      GROUP BY article_id
    ) v ON v.article_id = a.id
    LEFT JOIN (
      SELECT article_id, COUNT(*) AS bookmark_total
      FROM kb_article_bookmarks
      GROUP BY article_id
    ) b ON b.article_id = a.id
    LEFT JOIN (
      SELECT article_id, ARRAY_AGG(tag ORDER BY tag) AS tags
      FROM kb_article_tags
      GROUP BY article_id
    ) t ON t.article_id = a.id
    WHERE a.id = $1
    ${includeDrafts ? "" : "AND a.status = 'PUBLISHED'"}
  `;

  const articleResult = await pool.query(articleQuery, [articleId]);

  return articleResult.rows[0] || null;
}

export async function listKnowledgeBase(req, res, next) {
  try {
    const { q, category, difficulty, status = "PUBLISHED", featured, limit = 20, offset = 0 } = req.query;
    const filters = [];
    const params = [];

    if (status) {
      params.push(status);
      filters.push(`a.status = $${params.length}`);
    }

    if (category) {
      params.push(category);
      filters.push(`c.slug = $${params.length}`);
    }

    if (difficulty) {
      params.push(difficulty);
      filters.push(`a.difficulty = $${params.length}`);
    }

    if (featured === "true") {
      filters.push("a.featured = TRUE");
    }

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(a.title ILIKE $${params.length} OR a.summary ILIKE $${params.length} OR a.content ILIKE $${params.length} OR EXISTS (SELECT 1 FROM kb_article_tags t WHERE t.article_id = a.id AND t.tag ILIKE $${params.length}))`);
    }

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT a.*, u.name AS author_name, c.name AS category_name,
              COALESCE(v.vote_total, 0) AS score,
              COALESCE(b.bookmark_total, 0) AS bookmark_count,
              COALESCE(t.tags, ARRAY[]::text[]) AS tags,
              ${buildConfidenceColumns("a")}
       FROM kb_articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN kb_categories c ON c.id = a.category_id
       LEFT JOIN (
         SELECT article_id, SUM(CASE WHEN vote_type = 'UP' THEN 1 WHEN vote_type = 'DOWN' THEN -1 ELSE 0 END) AS vote_total
         FROM kb_article_votes
         GROUP BY article_id
       ) v ON v.article_id = a.id
       LEFT JOIN (
         SELECT article_id, COUNT(*) AS bookmark_total
         FROM kb_article_bookmarks
         GROUP BY article_id
       ) b ON b.article_id = a.id
       LEFT JOIN (
         SELECT article_id, ARRAY_AGG(tag ORDER BY tag) AS tags
         FROM kb_article_tags
         GROUP BY article_id
       ) t ON t.article_id = a.id
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY a.featured DESC, a.published_at DESC NULLS LAST, a.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ articles: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function getKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;
    const metaResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);

    if (metaResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canViewDraft = metaResult.rows[0].author_id === req.user?.id || Boolean(req.user?.isAdmin);
    const article = await loadArticle(id, canViewDraft);

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    await pool.query("UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1", [id]);

    // load current user's vote/bookmark status when available
    let userVote = null;
    let userBookmarked = false;
    if (req.user?.id) {
      const uv = await pool.query("SELECT vote_type FROM kb_article_votes WHERE article_id = $1 AND user_id = $2", [id, req.user.id]);
      if (uv.rowCount > 0) {
        userVote = uv.rows[0].vote_type;
      }

      const ub = await pool.query("SELECT 1 FROM kb_article_bookmarks WHERE article_id = $1 AND user_id = $2", [id, req.user.id]);
      userBookmarked = ub.rowCount > 0;
    }

    const revisions = await pool.query(
      `SELECT r.*, u.name AS editor_name
       FROM kb_article_revisions r
       JOIN users u ON u.id = r.editor_id
       WHERE r.article_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    const relatedArticles = await pool.query(
      `SELECT rel.id AS relation_id, rel.relation_type, a.id, a.title, a.slug, a.summary, a.difficulty, a.published_at
       FROM kb_article_relations rel
       JOIN kb_articles a ON a.id = rel.related_article_id
       WHERE rel.article_id = $1 AND a.status = 'PUBLISHED'
       ORDER BY a.published_at DESC
       LIMIT 6`,
      [id]
    );

    const linkedEntities = await pool.query(
      `SELECT l.id AS link_id, l.entity_type, l.entity_id, l.entity_label, l.relation_type, l.created_at,
              COALESCE(
                l.entity_label,
                CASE
                  WHEN l.entity_type = 'TASK' THEN t.title
                  WHEN l.entity_type = 'TEAM' THEN team.name
                  WHEN l.entity_type = 'DISCUSSION' THEN p.title
                  WHEN l.entity_type = 'ARTICLE' THEN kb.title
                  ELSE 'Linked item'
                END
              ) AS resolved_label
       FROM kb_article_links l
       LEFT JOIN tasks t ON l.entity_type = 'TASK' AND t.id = l.entity_id
       LEFT JOIN teams team ON l.entity_type = 'TEAM' AND team.id = l.entity_id
       LEFT JOIN posts p ON l.entity_type = 'DISCUSSION' AND p.id = l.entity_id
       LEFT JOIN kb_articles kb ON l.entity_type = 'ARTICLE' AND kb.id = l.entity_id
       WHERE l.article_id = $1
       ORDER BY l.created_at DESC`,
      [id]
    );

    return res.json({
      article: { ...article, user_vote: userVote, bookmarked_by_user: userBookmarked },
      revisions: revisions.rows,
      relatedArticles: relatedArticles.rows,
      linkedEntities: linkedEntities.rows,
    });
  } catch (error) {
    return next(error);
  }
}

export async function voteKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;
    const { vote } = req.body; // expected 'UP' or 'DOWN'

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!vote || !["UP", "DOWN"].includes(String(vote).toUpperCase())) {
      return res.status(400).json({ message: "Invalid vote value" });
    }

    const articleResult = await pool.query("SELECT id FROM kb_articles WHERE id = $1", [id]);
    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    await pool.query(
      `INSERT INTO kb_article_votes (article_id, user_id, vote_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (article_id, user_id) DO UPDATE SET
         vote_type = EXCLUDED.vote_type,
         created_at = NOW()`,
      [id, req.user.id, String(vote).toUpperCase()]
    );

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN vote_type = 'UP' THEN 1 WHEN vote_type = 'DOWN' THEN -1 ELSE 0 END),0) AS total
       FROM kb_article_votes WHERE article_id = $1`,
      [id]
    );

    const total = Number(totalResult.rows[0].total || 0);
    await pool.query("UPDATE kb_articles SET vote_score = $1 WHERE id = $2", [total, id]);

    return res.json({ vote_total: total, user_vote: String(vote).toUpperCase() });
  } catch (error) {
    return next(error);
  }
}

export async function addKnowledgeBaseBookmark(req, res, next) {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const articleResult = await pool.query("SELECT id FROM kb_articles WHERE id = $1", [id]);
    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    await pool.query(
      `INSERT INTO kb_article_bookmarks (article_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (article_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );

    const countResult = await pool.query("SELECT COUNT(*)::int AS cnt FROM kb_article_bookmarks WHERE article_id = $1", [id]);
    return res.json({ bookmark_count: countResult.rows[0].cnt, bookmarked_by_user: true });
  } catch (error) {
    return next(error);
  }
}

export async function removeKnowledgeBaseBookmark(req, res, next) {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    await pool.query("DELETE FROM kb_article_bookmarks WHERE article_id = $1 AND user_id = $2", [id, req.user.id]);

    const countResult = await pool.query("SELECT COUNT(*)::int AS cnt FROM kb_article_bookmarks WHERE article_id = $1", [id]);
    return res.json({ bookmark_count: countResult.rows[0].cnt, bookmarked_by_user: false });
  } catch (error) {
    return next(error);
  }
}

export async function createKnowledgeBaseArticle(req, res, next) {
  try {
    const { title, summary = "", content, categoryId = null, categoryName, tags = [], links = [], difficulty = "BEGINNER", visibility = "PUBLIC" } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    let resolvedCategoryId = categoryId;
    if (!resolvedCategoryId && categoryName) {
      const categorySlug = toSlug(categoryName);
      const categoryResult = await pool.query(
        `INSERT INTO kb_categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [categoryName, categorySlug]
      );
      resolvedCategoryId = categoryResult.rows[0].id;
    }

    const baseSlug = toSlug(title);
    const slug = await ensureUniqueSlug(baseSlug);
    const readTimeMinutes = calculateReadTime(content);
    const normalizedTags = normalizeTags(tags);

    const articleResult = await pool.query(
      `INSERT INTO kb_articles (
        category_id, author_id, title, slug, summary, content, content_format,
        status, visibility, difficulty, read_time_minutes, published_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'MARKDOWN', 'DRAFT', $7, $8, $9, NULL)
       RETURNING *`,
      [resolvedCategoryId, req.user.id, title, slug, summary, content, visibility, difficulty, readTimeMinutes]
    );

    await attachTags(articleResult.rows[0].id, normalizedTags);
    await attachLinks(articleResult.rows[0].id, links);

    return res.status(201).json({ article: articleResult.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function updateKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;
    const { title, summary = "", content, categoryId = null, categoryName, tags = [], difficulty, visibility, status } = req.body;
    const hasLinks = Object.prototype.hasOwnProperty.call(req.body, "links");
    const links = hasLinks ? req.body.links : undefined;

    const existingResult = await pool.query("SELECT * FROM kb_articles WHERE id = $1", [id]);
    if (existingResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const existing = existingResult.rows[0];
    const canEdit = existing.author_id === req.user.id || req.user.isAdmin;
    if (!canEdit) {
      return res.status(403).json({ message: "You do not have permission to edit this article" });
    }

    let resolvedCategoryId = categoryId ?? existing.category_id;
    if (!resolvedCategoryId && categoryName) {
      const categorySlug = toSlug(categoryName);
      const categoryResult = await pool.query(
        `INSERT INTO kb_categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [categoryName, categorySlug]
      );
      resolvedCategoryId = categoryResult.rows[0].id;
    }

    const nextTitle = title ?? existing.title;
    const nextSummary = summary ?? existing.summary;
    const nextContent = content ?? existing.content;
    const nextDifficulty = difficulty ?? existing.difficulty;
    const nextVisibility = visibility ?? existing.visibility;
    const nextStatus = status ?? existing.status;
    const nextSlug = title ? await ensureUniqueSlug(toSlug(title), existing.id) : existing.slug;

    await pool.query(
      `INSERT INTO kb_article_revisions (
        article_id, editor_id, previous_title, previous_summary, previous_content
       ) VALUES ($1, $2, $3, $4, $5)`,
      [existing.id, req.user.id, existing.title, existing.summary, existing.content]
    );

    const updatedResult = await pool.query(
      `UPDATE kb_articles
       SET category_id = $1,
           title = $2,
           slug = $3,
           summary = $4,
           content = $5,
           difficulty = $6,
           visibility = $7,
           status = $8,
           read_time_minutes = $9,
           updated_at = NOW(),
           published_at = CASE WHEN $8 = 'PUBLISHED' AND published_at IS NULL THEN NOW() ELSE published_at END
       WHERE id = $10
       RETURNING *`,
      [resolvedCategoryId, nextTitle, nextSlug, nextSummary, nextContent, nextDifficulty, nextVisibility, nextStatus, calculateReadTime(nextContent), existing.id]
    );

    const normalizedTags = normalizeTags(tags);
    if (normalizedTags.length > 0) {
      await pool.query("DELETE FROM kb_article_tags WHERE article_id = $1", [existing.id]);
      await attachTags(existing.id, normalizedTags);
    }

    if (hasLinks && Array.isArray(links)) {
      await pool.query("DELETE FROM kb_article_links WHERE article_id = $1", [existing.id]);
      await attachLinks(existing.id, links);
    }

    return res.json({ article: updatedResult.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function deleteKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;
    const articleResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);

    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canDelete = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canDelete) {
      return res.status(403).json({ message: "You do not have permission to delete this article" });
    }

    await pool.query("DELETE FROM kb_articles WHERE id = $1", [id]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function listKnowledgeBaseCategories(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(a.id) AS article_count
       FROM kb_categories c
       LEFT JOIN kb_articles a ON a.category_id = c.id AND a.status = 'PUBLISHED'
       GROUP BY c.id
       ORDER BY c.name ASC`
    );

    return res.json({ categories: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function listKnowledgeBaseRevisions(req, res, next) {
  try {
    const { id } = req.params;
    const revisions = await pool.query(
      `SELECT r.*, u.name AS editor_name
       FROM kb_article_revisions r
       JOIN users u ON u.id = r.editor_id
       WHERE r.article_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    return res.json({ revisions: revisions.rows });
  } catch (error) {
    return next(error);
  }
}

export async function publishKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;
    const articleResult = await pool.query("SELECT author_id, status FROM kb_articles WHERE id = $1", [id]);

    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canPublish = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canPublish) {
      return res.status(403).json({ message: "You do not have permission to publish this article" });
    }

    const result = await pool.query(
      `UPDATE kb_articles
       SET status = 'PUBLISHED', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Async: index the published article into engineering knowledge
    try {
      const article = result.rows[0];
      indexKnowledgeItem({
        source_type: "kb_article",
        source_id: article.id,
        title: article.title,
        content: article.content,
        tags: (await (async () => {
          const t = await pool.query("SELECT ARRAY_AGG(tag) AS tags FROM kb_article_tags WHERE article_id = $1", [article.id]);
          return t.rows[0]?.tags || [];
        })()),
        metadata: { author_id: article.author_id, category_id: article.category_id },
      }).catch((err) => console.error("Index KB article error:", err?.message || err));
    } catch (err) {
      console.error("Indexing KB article failed:", err?.message || err);
    }

    return res.json({ article: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function unpublishKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;
    const articleResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);

    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canUnpublish = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canUnpublish) {
      return res.status(403).json({ message: "You do not have permission to unpublish this article" });
    }

    const result = await pool.query(
      `UPDATE kb_articles
       SET status = 'DRAFT', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return res.json({ article: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function addKnowledgeBaseLink(req, res, next) {
  try {
    const { id } = req.params;
    const { entityType, entityId, relationType = "RELATED" } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({ message: "Entity type and entity id are required" });
    }

    const articleResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);
    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canManage = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canManage) {
      return res.status(403).json({ message: "You do not have permission to update links for this article" });
    }

    let entityLabel = null;
    const typeKey = String(entityType).toUpperCase();

    if (typeKey === "TASK") {
      const result = await pool.query("SELECT title FROM tasks WHERE id = $1", [entityId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Task not found" });
      }
      entityLabel = result.rows[0].title;
    } else if (typeKey === "TEAM") {
      const result = await pool.query("SELECT name FROM teams WHERE id = $1", [entityId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Team not found" });
      }
      entityLabel = result.rows[0].name;
    } else if (typeKey === "DISCUSSION") {
      const result = await pool.query("SELECT title FROM posts WHERE id = $1", [entityId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      entityLabel = result.rows[0].title;
    } else if (typeKey === "ARTICLE") {
      const result = await pool.query("SELECT title FROM kb_articles WHERE id = $1", [entityId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Article not found" });
      }
      entityLabel = result.rows[0].title;
    } else {
      return res.status(400).json({ message: "Unsupported entity type" });
    }

    const result = await pool.query(
      `INSERT INTO kb_article_links (article_id, entity_type, entity_id, entity_label, relation_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (article_id, entity_type, entity_id, relation_type) DO UPDATE SET
         entity_label = EXCLUDED.entity_label
       RETURNING *`,
      [id, typeKey, entityId, entityLabel, relationType]
    );

    return res.status(201).json({ link: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function removeKnowledgeBaseLink(req, res, next) {
  try {
    const { id, linkId } = req.params;

    const articleResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);
    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canManage = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canManage) {
      return res.status(403).json({ message: "You do not have permission to update links for this article" });
    }

    await pool.query("DELETE FROM kb_article_links WHERE id = $1 AND article_id = $2", [linkId, id]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function listKnowledgeBaseGaps(req, res, next) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const result = await pool.query(
      `SELECT * FROM kb_search_gaps
       WHERE status = 'OPEN'
       ORDER BY occurrence_count DESC, last_seen_at DESC
       LIMIT 20`
    );

    return res.json({ gaps: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function logKnowledgeBaseGap(req, res, next) {
  try {
    const { queryText, source = "SEARCH", resultCount = 0 } = req.body;

    if (!queryText || !String(queryText).trim()) {
      return res.status(400).json({ message: "Query text is required" });
    }

    const normalizedQuery = normalizeGapQuery(queryText);
    if (!normalizedQuery) {
      return res.status(400).json({ message: "Query text is required" });
    }

    const result = await pool.query(
      `INSERT INTO kb_search_gaps (query_text, normalized_query, source, result_count, occurrence_count, status, last_seen_at)
       VALUES ($1, $2, $3, $4, 1, 'OPEN', NOW())
       ON CONFLICT (normalized_query, source) DO UPDATE SET
         query_text = EXCLUDED.query_text,
         result_count = LEAST(kb_search_gaps.result_count, EXCLUDED.result_count),
         occurrence_count = kb_search_gaps.occurrence_count + 1,
         status = 'OPEN',
         last_seen_at = NOW()
       RETURNING *`,
      [queryText, normalizedQuery, source, Number(resultCount) || 0]
    );

    return res.status(201).json({ gap: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function updateKnowledgeBaseGap(req, res, next) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const allowed = ['OPEN','IN_PROGRESS','RESOLVED','DISMISSED'];
    if (!allowed.includes(String(status).toUpperCase())) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE kb_search_gaps
       SET status = $2,
           last_seen_at = NOW(),
           resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE resolved_at END
       WHERE id = $1
       RETURNING *`,
      [id, String(status).toUpperCase()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Gap not found' });
    }

    return res.json({ gap: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function convertKnowledgeBaseGapToArticle(req, res, next) {
  try {
    const { id } = req.params;

    const gapResult = await pool.query("SELECT * FROM kb_search_gaps WHERE id = $1", [id]);
    if (gapResult.rowCount === 0) {
      return res.status(404).json({ message: 'Gap not found' });
    }

    const gap = gapResult.rows[0];

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { title, summary, content, categoryName, tags = [] } = req.body;

    const derivedTitle = title || `Guide: ${String(gap.query_text).slice(0,200)}`;
    const slug = await ensureUniqueSlug(toSlug(derivedTitle));
    const bodyContent = content || `Draft for requested topic: ${gap.query_text}\n\nPlease refine and publish.`;
    const readTimeMinutes = calculateReadTime(bodyContent);
    const normalizedTags = normalizeTags(tags || ['gap-request']);

    const articleResult = await pool.query(
      `INSERT INTO kb_articles (category_id, author_id, title, slug, summary, content, content_format, status, visibility, difficulty, read_time_minutes, published_at)
       VALUES (NULL, $1, $2, $3, $4, $5, 'MARKDOWN', 'DRAFT', 'PUBLIC', 'BEGINNER', $6, NULL)
       RETURNING *`,
      [req.user.id, derivedTitle, slug, summary || gap.query_text, bodyContent, readTimeMinutes]
    );

    await attachTags(articleResult.rows[0].id, normalizedTags);

    await pool.query("UPDATE kb_search_gaps SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1", [id]);

    return res.status(201).json({ article: articleResult.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function synthesizeKnowledgeBaseArticleFromTask(req, res, next) {
  try {
    const { taskId } = req.params;

    const taskResult = await pool.query(
      `SELECT t.*, u.name AS creator_name, solver.name AS solver_name, team.name AS team_name
       FROM tasks t
       JOIN users u ON u.id = t.creator_id
       LEFT JOIN users solver ON solver.id = t.assigned_solver_id
       LEFT JOIN teams team ON team.id = t.team_id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rowCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    const task = taskResult.rows[0];
    const canDraft = req.user?.isAdmin || task.creator_id === req.user.id || task.assigned_solver_id === req.user.id;
    if (!canDraft) {
      return res.status(403).json({ message: "You do not have permission to synthesize an article for this task" });
    }

    if (!["COMPLETED", "UNDER_REVIEW", "DISPUTED"].includes(task.status)) {
      return res.status(400).json({ message: "Knowledge base drafts can only be created from resolved work" });
    }

    const title = `${task.title}: Resolution Guide`;
    const summary = `Reusable guide distilled from the resolution of ${task.title}.`;
    const content = [
      `# ${title}`,
      "",
      "## Context",
      task.description,
      "",
      "## Solution Summary",
      `Task difficulty: ${task.difficulty}. Budget: Rs ${task.budget}.`,
      task.solver_name ? `Primary solver: ${task.solver_name}.` : "",
      task.team_name ? `Team context: ${task.team_name}.` : "",
      "",
      "## Key Steps",
      "- Revisit the original constraints and acceptance criteria.",
      "- Capture the implementation choices that worked.",
      "- Record validation steps and edge cases.",
      "",
      "## Follow-up Notes",
      "- Add screenshots, commands, or snippets that helped resolve the work.",
      "- Link the task, team, and any related discussion threads.",
      "",
      "## Outcome",
      `This draft was synthesized from the completed task \"${task.title}\" and is ready for refinement.`,
    ]
      .filter(Boolean)
      .join("\n");

    const slug = await ensureUniqueSlug(toSlug(title));
    const tags = normalizeTags([...(task.tech_stack || []), "resolution", "playbook"]);
    const readTimeMinutes = calculateReadTime(content);

    const articleResult = await pool.query(
      `INSERT INTO kb_articles (
        category_id, author_id, title, slug, summary, content, content_format,
        status, visibility, difficulty, read_time_minutes, published_at
       ) VALUES (NULL, $1, $2, $3, $4, $5, 'MARKDOWN', 'DRAFT', 'PUBLIC', $6, $7, NULL)
       RETURNING *`,
      [req.user.id, title, slug, summary, content, task.difficulty, readTimeMinutes]
    );

    await attachTags(articleResult.rows[0].id, tags);
    await attachLinks(articleResult.rows[0].id, [
      { entityType: "TASK", entityId: task.id, entityLabel: task.title, relationType: "RESOLUTION_OF" },
      ...(task.team_id ? [{ entityType: "TEAM", entityId: task.team_id, entityLabel: task.team_name, relationType: "TEAM_CONTEXT" }] : []),
    ]);

    return res.status(201).json({ article: articleResult.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function moderateKnowledgeBaseArticle(req, res, next) {
  try {
    const { id } = req.params;

    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const existingResult = await pool.query("SELECT * FROM kb_articles WHERE id = $1", [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const existing = existingResult.rows[0];
    const { visibility = existing.visibility, status = existing.status, featured = existing.featured } = req.body;

    const result = await pool.query(
      `UPDATE kb_articles
       SET visibility = $2,
           status = $3,
           featured = $4,
           updated_at = NOW(),
           published_at = CASE WHEN $3 = 'PUBLISHED' AND published_at IS NULL THEN NOW() ELSE published_at END
       WHERE id = $1
       RETURNING *`,
      [id, visibility, status, Boolean(featured)]
    );

    return res.json({ article: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function addKnowledgeBaseRelation(req, res, next) {
  try {
    const { id } = req.params;
    const { relatedArticleId, relationType = "RELATED" } = req.body;

    if (!relatedArticleId) {
      return res.status(400).json({ message: "Related article id is required" });
    }

    const articleResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);
    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canManage = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canManage) {
      return res.status(403).json({ message: "You do not have permission to update relations for this article" });
    }

    if (String(id) === String(relatedArticleId)) {
      return res.status(400).json({ message: "An article cannot be related to itself" });
    }

    const relatedResult = await pool.query("SELECT id FROM kb_articles WHERE id = $1", [relatedArticleId]);
    if (relatedResult.rowCount === 0) {
      return res.status(404).json({ message: "Related article not found" });
    }

    await pool.query(
      `INSERT INTO kb_article_relations (article_id, related_article_id, relation_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (article_id, related_article_id, relation_type) DO NOTHING`,
      [id, relatedArticleId, relationType]
    );

    return res.status(201).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

export async function removeKnowledgeBaseRelation(req, res, next) {
  try {
    const { id, relatedArticleId } = req.params;
    const { relationType = "RELATED" } = req.query;

    const articleResult = await pool.query("SELECT author_id FROM kb_articles WHERE id = $1", [id]);
    if (articleResult.rowCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    const canManage = articleResult.rows[0].author_id === req.user.id || req.user.isAdmin;
    if (!canManage) {
      return res.status(403).json({ message: "You do not have permission to update relations for this article" });
    }

    await pool.query(
      `DELETE FROM kb_article_relations
       WHERE article_id = $1 AND related_article_id = $2 AND relation_type = $3`,
      [id, relatedArticleId, relationType]
    );

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
