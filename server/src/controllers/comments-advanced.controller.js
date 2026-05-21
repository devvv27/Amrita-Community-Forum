import { pool as db } from "../config/db.js";

// ADVANCED COMMENT FEATURES

// Edit comment with history tracking
export async function editComment(commentId, userId, newContent, contentHtml = null) {
  try {
    const commentCheck = await db.query(
      "SELECT author_id, content FROM comments WHERE id = $1",
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      throw new Error("Comment not found");
    }

    if (commentCheck.rows[0].author_id !== userId) {
      throw new Error("Can only edit your own comments");
    }

    // Store edit history
    await db.query(
      `INSERT INTO comment_edit_history (comment_id, previous_content, edited_by_id)
       VALUES ($1, $2, $3)`,
      [commentId, commentCheck.rows[0].content, userId]
    );

    // Update comment
    const result = await db.query(
      `UPDATE comments
       SET content = $1, content_html = $2, is_edited = true, edited_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newContent, contentHtml, commentId]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error editing comment:", error);
    throw error;
  }
}

// Add reaction to comment
export async function addCommentReaction(commentId, userId, reactionType) {
  try {
    const result = await db.query(
      `INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (comment_id, user_id, reaction_type) DO NOTHING
       RETURNING *`,
      [commentId, userId, reactionType]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error adding reaction:", error);
    throw error;
  }
}

// Remove reaction from comment
export async function removeCommentReaction(commentId, userId, reactionType) {
  try {
    await db.query(
      `DELETE FROM comment_reactions
       WHERE comment_id = $1 AND user_id = $2 AND reaction_type = $3`,
      [commentId, userId, reactionType]
    );

    return { success: true };
  } catch (error) {
    console.error("Error removing reaction:", error);
    throw error;
  }
}

// Get comment reactions
export async function getCommentReactions(commentId) {
  try {
    const result = await db.query(
      `SELECT reaction_type, COUNT(*) as count, 
              array_agg(user_id) as user_ids
       FROM comment_reactions
       WHERE comment_id = $1
       GROUP BY reaction_type`,
      [commentId]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting reactions:", error);
    throw error;
  }
}

// Get edit history for comment
export async function getCommentEditHistory(commentId) {
  try {
    const result = await db.query(
      `SELECT ceh.id, ceh.previous_content, ceh.edited_by_id, u.name as edited_by_name, ceh.edited_at
       FROM comment_edit_history ceh
       JOIN users u ON u.id = ceh.edited_by_id
       WHERE ceh.comment_id = $1
       ORDER BY ceh.edited_at DESC`,
      [commentId]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting edit history:", error);
    throw error;
  }
}

// Get enriched comments with reactions, edit history, mentions
export async function getEnrichedComments(postId, includeReplies = true) {
  try {
    const mainComments = await db.query(
      `SELECT c.id, c.post_id, c.author_id, c.content, c.content_html, c.parent_comment_id, 
              c.reply_to_author_name, c.is_edited, c.edited_at, c.created_at,
              u.name as author_name, u.reputation,
              (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'UP') as upvotes,
              (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'DOWN') as downvotes,
              (SELECT json_agg(json_build_object('type', reaction_type, 'count', count)) 
               FROM (SELECT reaction_type, COUNT(*) as count 
                     FROM comment_reactions WHERE comment_id = c.id GROUP BY reaction_type) r) as reactions,
              (SELECT COUNT(*) FROM comments WHERE parent_comment_id = c.id) as reply_count
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
       ORDER BY c.created_at DESC`,
      [postId]
    );

    if (!includeReplies) {
      return mainComments.rows;
    }

    const commentsWithReplies = await Promise.all(
      mainComments.rows.map(async (comment) => {
        const repliesQuery = await db.query(
          `SELECT c.id, c.post_id, c.author_id, c.content, c.content_html, c.parent_comment_id,
                  c.reply_to_author_name, c.is_edited, c.edited_at, c.created_at,
                  u.name as author_name, u.reputation,
                  (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'UP') as upvotes,
                  (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'DOWN') as downvotes,
                  (SELECT json_agg(json_build_object('type', reaction_type, 'count', count))
                   FROM (SELECT reaction_type, COUNT(*) as count
                         FROM comment_reactions WHERE comment_id = c.id GROUP BY reaction_type) r) as reactions
           FROM comments c
           JOIN users u ON c.author_id = u.id
           WHERE c.post_id = $1 AND c.parent_comment_id = $2
           ORDER BY c.created_at ASC`,
          [postId, comment.id]
        );

        return {
          ...comment,
          replies: repliesQuery.rows,
        };
      })
    );

    return commentsWithReplies;
  } catch (error) {
    console.error("Error fetching enriched comments:", error);
    throw error;
  }
}

// Extract and validate mentions from content
export function extractMentions(content) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return [...new Set(mentions)]; // Remove duplicates
}

// Add mentions to comment
export async function addMentions(commentId, mentionedUserIds) {
  try {
    if (!mentionedUserIds || mentionedUserIds.length === 0) {
      return;
    }

    await db.query(
      `UPDATE comments SET mentioned_users = $1 WHERE id = $2`,
      [mentionedUserIds, commentId]
    );
  } catch (error) {
    console.error("Error adding mentions:", error);
    throw error;
  }
}

// Get mentioned users
export async function getMentionedUsers(commentId) {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email FROM users u
       WHERE u.id = ANY(
         SELECT unnest(mentioned_users) FROM comments WHERE id = $1
       )`,
      [commentId]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting mentioned users:", error);
    throw error;
  }
}
