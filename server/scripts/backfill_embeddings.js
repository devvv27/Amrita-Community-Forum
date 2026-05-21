#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import { pool } from "../src/config/db.js";
import { indexKnowledgeItem } from "../src/services/semantic.service.js";

async function backfill() {
  console.log("Starting backfill of engineering knowledge...");

  // Posts
  const posts = await pool.query("SELECT id, title, content, tags, author_id FROM posts ORDER BY created_at ASC");
  for (const p of posts.rows) {
    try {
      console.log(`Indexing post ${p.id}`);
      await indexKnowledgeItem({ source_type: "post", source_id: p.id, title: p.title, content: p.content, tags: p.tags || [], metadata: { author_id: p.author_id } });
    } catch (err) {
      console.error("Failed to index post", p.id, err?.message || err);
    }
  }

  // Comments
  const comments = await pool.query("SELECT id, post_id, content, author_id FROM comments ORDER BY created_at ASC");
  for (const c of comments.rows) {
    try {
      console.log(`Indexing comment ${c.id}`);
      await indexKnowledgeItem({ source_type: "comment", source_id: c.id, title: `Comment on post ${c.post_id}`, content: c.content, metadata: { post_id: c.post_id, author_id: c.author_id } });
    } catch (err) {
      console.error("Failed to index comment", c.id, err?.message || err);
    }
  }

  // Published KB Articles
  const articles = await pool.query("SELECT id, title, content, author_id FROM kb_articles WHERE status = 'PUBLISHED' ORDER BY published_at ASC");
  for (const a of articles.rows) {
    try {
      console.log(`Indexing article ${a.id}`);
      const tagRes = await pool.query("SELECT ARRAY_AGG(tag) AS tags FROM kb_article_tags WHERE article_id = $1", [a.id]);
      await indexKnowledgeItem({ source_type: "kb_article", source_id: a.id, title: a.title, content: a.content, tags: tagRes.rows[0]?.tags || [], metadata: { author_id: a.author_id } });
    } catch (err) {
      console.error("Failed to index article", a.id, err?.message || err);
    }
  }

  console.log("Backfill complete.");
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
