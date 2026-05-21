import { Router } from "express";
import {
  addComment,
  createPost,
  getPost,
  listPosts,
  recommendedPosts,
  savedPosts,
  toggleSavedPost,
  trendingPosts,
  votePost,
  summarizePost,
} from "../controllers/posts.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", listPosts);
router.get("/recommended", requireAuth, recommendedPosts);
router.get("/saved", requireAuth, savedPosts);
router.get("/trending", trendingPosts);
router.get("/:id", getPost);
router.post("/", requireAuth, createPost);
router.post("/:id/save", requireAuth, toggleSavedPost);
router.post("/:id/comments", requireAuth, addComment);
router.post("/:id/vote", requireAuth, votePost);
router.post("/:id/summarize", requireAuth, summarizePost);

export default router;
