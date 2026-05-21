import { pool as db } from "../config/db.js";
import { createNotification } from "./notifications.controller.js";
import { updateUserAnalytics } from "./analytics.controller.js";
import { indexKnowledgeItem } from "../services/semantic.service.js";

// Add comment with optional threading support
export async function addComment(postId, authorId, content, parentCommentId = null) {
  try {
    // Validate post exists
    const postCheck = await db.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rows.length === 0) {
      throw new Error("Post not found");
    }

    let replyToAuthorName = null;

    // Validate parent comment if provided and get parent author name
    if (parentCommentId) {
      const parentCheck = await db.query(
        `SELECT c.id, u.name as author_name 
         FROM comments c
         JOIN users u ON c.author_id = u.id
         WHERE c.id = $1`,
        [parentCommentId]
      );
      if (parentCheck.rows.length === 0) {
        throw new Error("Parent comment not found");
      }
      replyToAuthorName = parentCheck.rows[0].author_name;
    }

    const result = await db.query(
      `INSERT INTO comments (post_id, author_id, content, parent_comment_id, reply_to_author_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, post_id, author_id, content, parent_comment_id, reply_to_author_name, created_at`,
      [postId, authorId, content, parentCommentId, replyToAuthorName]
    );

    if (result.rows.length === 0) {
      throw new Error("Failed to add comment");
    }

    // Async: index comment into engineering knowledge
    try {
      indexKnowledgeItem({
        source_type: "comment",
        source_id: result.rows[0].id,
        title: `Comment on post ${postId}`,
        content: result.rows[0].content,
        tags: [],
        metadata: { post_id: postId, author_id: authorId },
      }).catch((err) => console.error("Index comment error:", err?.message || err));
    } catch (err) {
      console.error("Indexing comment failed:", err?.message || err);
    }

    await updateUserAnalytics(authorId);

    const postAuthor = await db.query("SELECT author_id, title FROM posts WHERE id = $1", [postId]);
    if (postAuthor.rows.length > 0 && postAuthor.rows[0].author_id !== authorId) {
      await createNotification(
        postAuthor.rows[0].author_id,
        postId,
        "SUBMISSION_RECEIVED",
        `New comment on your post: ${postAuthor.rows[0].title}`
      );
    }

    if (parentCommentId) {
      const parentAuthor = await db.query("SELECT author_id FROM comments WHERE id = $1", [parentCommentId]);
      if (parentAuthor.rows.length > 0 && parentAuthor.rows[0].author_id !== authorId) {
        await createNotification(
          parentAuthor.rows[0].author_id,
          postId,
          "SUBMISSION_RECEIVED",
          "Someone replied to your comment"
        );
      }
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error adding comment:", error);
    // Best-effort indexing for comment if DB insertion succeeded earlier
    try {
      if (error?.insertedCommentPayload) {
        indexKnowledgeItem({
          source_type: "comment",
          source_id: error.insertedCommentPayload.id,
          title: `Comment on post ${error.insertedCommentPayload.post_id}`,
          content: error.insertedCommentPayload.content,
          tags: [],
          metadata: { post_id: error.insertedCommentPayload.post_id, author_id: error.insertedCommentPayload.author_id },
        }).catch((err) => console.error("Index comment (error path) failed:", err));
      }
    } catch (e) {
      // swallow
    }
    throw error;
  }
}

// Get comments for a post with threading support
export async function getPostComments(postId, includeReplies = true) {
  try {
    // Get top-level comments
    const mainComments = await db.query(
      `SELECT c.id, c.post_id, c.author_id, c.content, c.parent_comment_id, c.reply_to_author_name, c.created_at,
              u.name as author_name, u.reputation,
              (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'UP') as upvotes,
              (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'DOWN') as downvotes
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
       ORDER BY c.created_at DESC`,
      [postId]
    );

    if (!includeReplies) {
      return mainComments.rows;
    }

    // Get all replies for each main comment
    const commentsWithReplies = await Promise.all(
      mainComments.rows.map(async (comment) => {
        const repliesQuery = await db.query(
          `SELECT c.id, c.post_id, c.author_id, c.content, c.parent_comment_id, c.reply_to_author_name, c.created_at,
                  u.name as author_name, u.reputation,
                  (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'UP') as upvotes,
                  (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'DOWN') as downvotes
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
    console.error("Error fetching comments:", error);
    throw error;
  }
}

// Vote on comment
export async function voteComment(commentId, userId, voteType) {
  try {
    // Validate vote type
    if (!["UP", "DOWN"].includes(voteType)) {
      throw new Error("Invalid vote type");
    }

    // Validate comment exists
    const commentCheck = await db.query("SELECT id, author_id FROM comments WHERE id = $1", [
      commentId,
    ]);
    if (commentCheck.rows.length === 0) {
      throw new Error("Comment not found");
    }

    const authorId = commentCheck.rows[0].author_id;

    // Prevent self-voting
    if (authorId === userId) {
      throw new Error("Cannot vote on your own comment");
    }

    // Check if user already voted
    const existingVote = await db.query(
      `SELECT id, vote_type FROM comment_votes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId]
    );

    if (existingVote.rows.length > 0) {
      const oldVoteType = existingVote.rows[0].vote_type;

      if (oldVoteType === voteType) {
        // Remove vote if voting same way again
        await db.query(
          `DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2`,
          [commentId, userId]
        );
        return { success: true, message: "Vote removed" };
      } else {
        // Update vote
        await db.query(
          `UPDATE comment_votes SET vote_type = $1 WHERE comment_id = $2 AND user_id = $3`,
          [voteType, commentId, userId]
        );
      }
    } else {
      // Add new vote
      await db.query(
        `INSERT INTO comment_votes (comment_id, user_id, vote_type)
         VALUES ($1, $2, $3)`,
        [commentId, userId, voteType]
      );
    }

    await updateUserAnalytics(authorId);

    return { success: true, message: "Vote recorded" };
  } catch (error) {
    console.error("Error voting on comment:", error);
    throw error;
  }
}

// Delete comment
export async function deleteComment(commentId, userId) {
  try {
    // Get comment details
    const commentQuery = await db.query(
      `SELECT author_id FROM comments WHERE id = $1`,
      [commentId]
    );

    if (commentQuery.rows.length === 0) {
      throw new Error("Comment not found");
    }

    const authorId = commentQuery.rows[0].author_id;

    // Check authorization (author or admin)
    const userCheck = await db.query(
      `SELECT is_admin FROM users WHERE id = $1`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error("User not found");
    }

    if (userId !== authorId && !userCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Can only delete your own comments");
    }

    // Delete comment (cascades to replies and votes)
    await db.query(`DELETE FROM comments WHERE id = $1`, [commentId]);

    await updateUserAnalytics(authorId);

    return { success: true, message: "Comment deleted" };
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
}

// Get comment count for post
export async function getCommentCount(postId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM comments WHERE post_id = $1`,
      [postId]
    );
    return result.rows[0].count;
  } catch (error) {
    console.error("Error getting comment count:", error);
    throw error;
  }
}

// Get comment votes summary
export async function getCommentVotesSummary(commentId) {
  try {
    const result = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM comment_votes WHERE comment_id = $1 AND vote_type = 'UP') as upvotes,
        (SELECT COUNT(*) FROM comment_votes WHERE comment_id = $1 AND vote_type = 'DOWN') as downvotes`,
      [commentId]
    );

    if (result.rows.length === 0) {
      return { upvotes: 0, downvotes: 0 };
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error getting comment votes:", error);
    throw error;
  }
}

// Get user's comment history
export async function getUserCommentHistory(userId, limit = 50, offset = 0) {
  try {
    const result = await db.query(
      `SELECT c.id, c.post_id, c.content, c.parent_comment_id, c.created_at,
              p.title as post_title,
              (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'UP') as upvotes,
              (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 'DOWN') as downvotes
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.author_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching user comment history:", error);
    throw error;
  }
}
