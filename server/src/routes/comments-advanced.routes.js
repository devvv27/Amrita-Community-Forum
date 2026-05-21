import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as advancedCommentsController from "../controllers/comments-advanced.controller.js";

const router = express.Router();

// Edit comment with rich text
router.put("/comments/:commentId/edit", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, contentHtml } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const updatedComment = await advancedCommentsController.editComment(
      parseInt(commentId),
      req.user.id,
      content,
      contentHtml
    );

    res.json({ comment: updatedComment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add reaction to comment
router.post("/comments/:commentId/reactions", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reactionType } = req.body;

    if (!reactionType) {
      return res.status(400).json({ message: "Reaction type is required" });
    }

    const reaction = await advancedCommentsController.addCommentReaction(
      parseInt(commentId),
      req.user.id,
      reactionType
    );

    res.status(201).json({ reaction });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove reaction from comment
router.delete("/comments/:commentId/reactions/:reactionType", requireAuth, async (req, res) => {
  try {
    const { commentId, reactionType } = req.params;

    await advancedCommentsController.removeCommentReaction(
      parseInt(commentId),
      req.user.id,
      reactionType
    );

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get reactions for comment
router.get("/comments/:commentId/reactions", async (req, res) => {
  try {
    const { commentId } = req.params;

    const reactions = await advancedCommentsController.getCommentReactions(
      parseInt(commentId)
    );

    res.json({ reactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get comment edit history
router.get("/comments/:commentId/history", async (req, res) => {
  try {
    const { commentId } = req.params;

    const history = await advancedCommentsController.getCommentEditHistory(
      parseInt(commentId)
    );

    res.json({ history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get enriched comments with all metadata
router.get("/posts/:postId/comments/enriched", async (req, res) => {
  try {
    const { postId } = req.params;
    const includeReplies = req.query.includeReplies !== "false";

    const comments = await advancedCommentsController.getEnrichedComments(
      parseInt(postId),
      includeReplies
    );

    res.json({ comments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get mentioned users in comment
router.get("/comments/:commentId/mentions", async (req, res) => {
  try {
    const { commentId } = req.params;

    const mentions = await advancedCommentsController.getMentionedUsers(
      parseInt(commentId)
    );

    res.json({ mentions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
