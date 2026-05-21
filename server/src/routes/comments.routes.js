import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as commentsController from "../controllers/comments.controller.js";

const router = express.Router();

// Add comment to post with optional threading
router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const comment = await commentsController.addComment(
      parseInt(postId),
      req.user.id,
      content,
      parentCommentId ? parseInt(parentCommentId) : null
    );

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all comments for a post (with threading)
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const { postId } = req.params;
    const includeReplies = req.query.includeReplies !== "false";

    const comments = await commentsController.getPostComments(
      parseInt(postId),
      includeReplies
    );

    res.json({ comments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Vote on comment
router.post("/comments/:commentId/vote", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { voteType } = req.body;

    if (!voteType) {
      return res.status(400).json({ message: "Vote type is required" });
    }

    const result = await commentsController.voteComment(
      parseInt(commentId),
      req.user.id,
      voteType
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete comment
router.delete("/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;

    const result = await commentsController.deleteComment(parseInt(commentId), req.user.id);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get comment votes summary
router.get("/comments/:commentId/votes", async (req, res) => {
  try {
    const { commentId } = req.params;

    const votes = await commentsController.getCommentVotesSummary(parseInt(commentId));

    res.json(votes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's comment history
router.get("/users/:userId/comment-history", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const comments = await commentsController.getUserCommentHistory(
      parseInt(userId),
      limit,
      offset
    );

    res.json({ comments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
