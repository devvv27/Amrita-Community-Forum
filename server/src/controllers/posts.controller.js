import { pool } from "../config/db.js";
import { indexKnowledgeItem, vectorSearch } from "../services/semantic.service.js";
import { createNotification } from "./notifications.controller.js";
import { updateUserAnalytics } from "./analytics.controller.js";
import { summarizeIssue } from "../lib/summarize.service.js";

export async function listPosts(req, res, next) {
  try {
    const { category, q } = req.query;

    const params = [];
    let whereClause = "";

    if (category) {
      params.push(category);
      whereClause = `WHERE p.category = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      const queryClause = `(
        p.title ILIKE $${params.length}
        OR p.content ILIKE $${params.length}
        OR EXISTS (SELECT 1 FROM unnest(p.tags) AS tag WHERE tag ILIKE $${params.length})
      )`;
      whereClause = whereClause ? `${whereClause} AND ${queryClause}` : `WHERE ${queryClause}`;
    }

    const result = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(SUM(CASE WHEN v.vote_type = 'UP' THEN 1 WHEN v.vote_type = 'DOWN' THEN -1 ELSE 0 END), 0) AS score
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_votes v ON v.post_id = p.id
       ${whereClause}
       GROUP BY p.id, u.name
       ORDER BY p.created_at DESC`,
      params
    );

    return res.json({ posts: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function recommendedPosts(req, res, next) {
  try {
    const userResult = await pool.query("SELECT skills FROM users WHERE id = $1", [req.user.id]);
    const skills = Array.isArray(userResult.rows[0]?.skills) ? userResult.rows[0].skills : [];

    const params = [req.user.id];
    let matchSelect = ", 0 AS match_score";

    if (skills.length > 0) {
      params.push(skills);
      matchSelect = `,
              (
                SELECT COUNT(*)
                FROM unnest(p.tags) AS tag
                WHERE tag = ANY($2::text[])
              ) AS match_score`;
    }

    const result = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(SUM(CASE WHEN v.vote_type = 'UP' THEN 1 WHEN v.vote_type = 'DOWN' THEN -1 ELSE 0 END), 0) AS score,
              COUNT(c.id) AS comment_count
              ${matchSelect}
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_votes v ON v.post_id = p.id
       LEFT JOIN comments c ON c.post_id = p.id
       WHERE p.author_id <> $1
       GROUP BY p.id, u.name
       ORDER BY match_score DESC, score DESC, comment_count DESC, p.created_at DESC
       LIMIT 8`,
      params
    );

    return res.json({ posts: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function savedPosts(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(SUM(CASE WHEN v.vote_type = 'UP' THEN 1 WHEN v.vote_type = 'DOWN' THEN -1 ELSE 0 END), 0) AS score,
              sp.created_at AS saved_at
       FROM saved_posts sp
       JOIN posts p ON p.id = sp.post_id
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_votes v ON v.post_id = p.id
       WHERE sp.user_id = $1
       GROUP BY p.id, u.name, sp.created_at
       ORDER BY sp.created_at DESC`,
      [req.user.id]
    );

    return res.json({ posts: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function toggleSavedPost(req, res, next) {
  try {
    const { id } = req.params;

    const postResult = await pool.query("SELECT id FROM posts WHERE id = $1", [id]);
    if (postResult.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existing = await pool.query(
      "SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2",
      [req.user.id, id]
    );

    if (existing.rowCount > 0) {
      await pool.query("DELETE FROM saved_posts WHERE id = $1", [existing.rows[0].id]);
      return res.json({ saved: false });
    }

    await pool.query("INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)", [req.user.id, id]);
    return res.status(201).json({ saved: true });
  } catch (error) {
    return next(error);
  }
}

export async function trendingPosts(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(SUM(CASE WHEN v.vote_type = 'UP' THEN 1 WHEN v.vote_type = 'DOWN' THEN -1 ELSE 0 END), 0) AS score,
              COUNT(c.id) AS comment_count
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_votes v ON v.post_id = p.id
       LEFT JOIN comments c ON c.post_id = p.id
       GROUP BY p.id, u.name
       ORDER BY score DESC, comment_count DESC, p.created_at DESC
       LIMIT 8`
    );

    return res.json({ posts: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function createPost(req, res, next) {
  try {
    const { title, content, category, tags = [] } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ message: "Title, content and category are required" });
    }

    const result = await pool.query(
      `INSERT INTO posts (author_id, title, content, category, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, content, category, tags]
    );

    await updateUserAnalytics(req.user.id);

    // Async: index post into engineering knowledge (best-effort)
    try {
      indexKnowledgeItem({
        source_type: "post",
        source_id: result.rows[0].id,
        title: result.rows[0].title,
        content: result.rows[0].content,
        tags: result.rows[0].tags || [],
        metadata: { author_id: req.user.id, category },
      }).catch((err) => console.error("Index post error:", err?.message || err));
    } catch (err) {
      console.error("Indexing post failed:", err?.message || err);
    }

    // AI features: duplicate detection, smart tagging, severity, and summary/actions
    const composed = `${title}\n\n${content}`;

    // Duplicate detection (try vector search, fallback to lexical overlap)
    let duplicateSuggestions = [];
    try {
      const vectorResults = await vectorSearch({ queryText: composed, limit: 6 });
      duplicateSuggestions = vectorResults.map((r) => ({ id: r.id, title: r.title, snippet: (r.content || "").slice(0, 240), similarity: r.similarity }));
    } catch (err) {
      try {
        const recent = await pool.query("SELECT id, title, content, created_at FROM posts ORDER BY created_at DESC LIMIT 80");
        duplicateSuggestions = recent.rows
          .map((p) => ({ id: p.id, title: p.title, snippet: (p.content || "").slice(0, 240), similarity: scoreOverlap(composed, `${p.title} ${p.content}`) }))
          .filter((d) => d.similarity > 0)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 6);
      } catch (e) {
        duplicateSuggestions = [];
      }
    }

    // Smart tagging & platform/framework detection (heuristic)
    const lower = composed.toLowerCase();
    const suggestedTags = new Set([...(tags || [])]);
    const suggestedPlatforms = [];
    const suggestedFrameworks = [];
    const platformChecks = [
      [/vercel|vercel\.json/i, 'Vercel'],
      [/render|render\.ya?ml/i, 'Render'],
      [/railway/i, 'Railway'],
      [/dockerfile|docker-compose|\bdocker\b/i, 'Docker'],
    ];
    platformChecks.forEach(([rx, name]) => { if (rx.test(lower)) suggestedPlatforms.push(name); });
    const fwChecks = [
      [/\breact\b|\bvite\b|\bnext\b/i, 'React/Vite/Next'],
      [/\bexpress\b|\bfastify\b/i, 'Express'],
      [/\bfastapi\b|\buvicorn\b/i, 'FastAPI'],
      [/postgres|postgresql|\bpg\b/i, 'PostgreSQL'],
      [/mongodb|mongoose/i, 'MongoDB'],
    ];
    fwChecks.forEach(([rx, name]) => { if (rx.test(lower)) suggestedFrameworks.push(name); });
    suggestedPlatforms.forEach((p) => suggestedTags.add(p));
    suggestedFrameworks.forEach((f) => suggestedTags.add(f));

    // Severity heuristics
    let suggestedSeverity = 'LOW';
    if (/(production|down|crash|failed|fatal|panic|urgent)/i.test(lower)) suggestedSeverity = 'CRITICAL';
    else if (/(error|timeout|unreachable|failed to|cannot)/i.test(lower)) suggestedSeverity = 'HIGH';
    else if (/(warning|degraded|slow|partial)/i.test(lower)) suggestedSeverity = 'MEDIUM';

    // Summarization / action items
    let aiSummary = null;
    let aiActions = [];
    try {
      const s = await summarizeIssue(composed + "\n\n(If available, recent comments will be considered in a later summary.)");
      aiSummary = s.summary;
      aiActions = s.actions || [];
    } catch (err) {
      aiSummary = (String(content).replace(/\s+/g, ' ').trim().slice(0, 280)) || '';
      aiActions = [
        'Collect logs and platform configuration.',
        'Verify environment variables and secrets in production.',
        'Reproduce locally using the production build.'
      ];
    }

    return res.status(201).json({
      post: result.rows[0],
      ai: {
        duplicates: duplicateSuggestions,
        suggested_tags: Array.from(suggestedTags),
        suggested_platforms: suggestedPlatforms,
        suggested_frameworks: suggestedFrameworks,
        suggested_severity: suggestedSeverity,
        summary: aiSummary,
        actions: aiActions,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPost(req, res, next) {
  try {
    const { id } = req.params;

    const postResult = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(SUM(CASE WHEN v.vote_type = 'UP' THEN 1 WHEN v.vote_type = 'DOWN' THEN -1 ELSE 0 END), 0) AS score
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_votes v ON v.post_id = p.id
       WHERE p.id = $1
       GROUP BY p.id, u.name`,
      [id]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const commentsResult = await pool.query(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );

    return res.json({ post: postResult.rows[0], comments: commentsResult.rows });
  } catch (error) {
    return next(error);
  }
}

export async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    const { content, parentCommentId = null } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const postExists = await pool.query("SELECT id FROM posts WHERE id = $1", [id]);
    if (postExists.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (parentCommentId) {
      const parentExists = await pool.query("SELECT id FROM comments WHERE id = $1 AND post_id = $2", [
        parentCommentId,
        id,
      ]);

      if (parentExists.rowCount === 0) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, author_id, content, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, req.user.id, content, parentCommentId]
    );

    const postAuthorResult = await pool.query("SELECT author_id, title FROM posts WHERE id = $1", [id]);
    if (postAuthorResult.rowCount > 0 && postAuthorResult.rows[0].author_id !== req.user.id) {
      await createNotification(
        postAuthorResult.rows[0].author_id,
        id,
        "SUBMISSION_RECEIVED",
        `New comment on your post: ${postAuthorResult.rows[0].title}`
      );
    }

    if (parentCommentId) {
      const parentCommentResult = await pool.query("SELECT author_id FROM comments WHERE id = $1", [parentCommentId]);
      if (parentCommentResult.rowCount > 0 && parentCommentResult.rows[0].author_id !== req.user.id) {
        await createNotification(
          parentCommentResult.rows[0].author_id,
          id,
          "SUBMISSION_RECEIVED",
          "Someone replied to your comment"
        );
      }
    }

    await updateUserAnalytics(req.user.id);

    // Async: index comment into engineering knowledge
    try {
      indexKnowledgeItem({
        source_type: "comment",
        source_id: result.rows[0].id,
        title: `Comment on post ${id}`,
        content: result.rows[0].content,
        tags: [],
        metadata: { post_id: id, author_id: req.user.id },
      }).catch((err) => console.error("Index comment error:", err?.message || err));
    } catch (err) {
      console.error("Indexing comment failed:", err?.message || err);
    }

    return res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function votePost(req, res, next) {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (!["UP", "DOWN"].includes((type || "").toUpperCase())) {
      return res.status(400).json({ message: "Vote type must be UP or DOWN" });
    }

    const postExists = await pool.query("SELECT id FROM posts WHERE id = $1", [id]);
    if (postExists.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const result = await pool.query(
      `INSERT INTO post_votes (post_id, user_id, vote_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id)
       DO UPDATE SET vote_type = EXCLUDED.vote_type
       RETURNING *`,
      [id, req.user.id, type.toUpperCase()]
    );

    const authorResult = await pool.query("SELECT author_id FROM posts WHERE id = $1", [id]);
    if (authorResult.rowCount > 0 && authorResult.rows[0].author_id !== req.user.id) {
      await updateUserAnalytics(authorResult.rows[0].author_id);
    }

    return res.json({ vote: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function summarizePost(req, res, next) {
  try {
    const { id } = req.params;

    const postResult = await pool.query(
      `SELECT p.title, p.content, p.category, u.name AS author_name
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.id = $1`,
      [id]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const commentsResult = await pool.query(
      `SELECT c.content, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT 20`,
      [id]
    );

    const post = postResult.rows[0];
    const discussionText = [
      `Title: ${post.title}`,
      `Category: ${post.category}`,
      `Author: ${post.author_name}`,
      `Content: ${post.content}`,
      commentsResult.rows.length > 0
        ? `Comments:\n${commentsResult.rows
            .map((comment) => `- ${comment.author_name}: ${comment.content}`)
            .join("\n")}`
        : "Comments: None",
    ].join("\n\n");

    const summaryResult = await summarizeIssue(discussionText);

    return res.json({
      summary: summaryResult.summary,
      actions: summaryResult.actions,
    });
  } catch (error) {
    return next(error);
  }
}
