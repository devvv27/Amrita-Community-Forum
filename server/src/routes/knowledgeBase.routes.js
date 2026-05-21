import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  addKnowledgeBaseLink,
  listKnowledgeBaseGaps,
  updateKnowledgeBaseGap,
  voteKnowledgeBaseArticle,
  addKnowledgeBaseBookmark,
  removeKnowledgeBaseBookmark,
  addKnowledgeBaseRelation,
  convertKnowledgeBaseGapToArticle,
  createKnowledgeBaseArticle,
  deleteKnowledgeBaseArticle,
  getKnowledgeBaseArticle,
  listKnowledgeBase,
  listKnowledgeBaseCategories,
  listKnowledgeBaseRevisions,
  moderateKnowledgeBaseArticle,
  publishKnowledgeBaseArticle,
  removeKnowledgeBaseRelation,
  removeKnowledgeBaseLink,
  logKnowledgeBaseGap,
  synthesizeKnowledgeBaseArticleFromTask,
  unpublishKnowledgeBaseArticle,
  updateKnowledgeBaseArticle,
} from "../controllers/knowledgeBase.controller.js";

const router = Router();

router.get("/", listKnowledgeBase);
router.get("/categories", listKnowledgeBaseCategories);
router.get("/gaps", requireAuth, listKnowledgeBaseGaps);
router.post("/gaps", logKnowledgeBaseGap);
router.patch("/gaps/:id", requireAuth, updateKnowledgeBaseGap);
router.post("/gaps/:id/convert", requireAuth, convertKnowledgeBaseGapToArticle);
router.post("/synthesize/task/:taskId", requireAuth, synthesizeKnowledgeBaseArticleFromTask);
router.post("/:id/links", requireAuth, addKnowledgeBaseLink);
router.delete("/:id/links/:linkId", requireAuth, removeKnowledgeBaseLink);
router.post("/:id/vote", requireAuth, voteKnowledgeBaseArticle);
router.post("/:id/bookmark", requireAuth, addKnowledgeBaseBookmark);
router.delete("/:id/bookmark", requireAuth, removeKnowledgeBaseBookmark);
router.get("/:id", getKnowledgeBaseArticle);
router.get("/:id/revisions", listKnowledgeBaseRevisions);
router.post("/", requireAuth, createKnowledgeBaseArticle);
router.put("/:id", requireAuth, updateKnowledgeBaseArticle);
router.patch("/:id/moderate", requireAuth, moderateKnowledgeBaseArticle);
router.patch("/:id/publish", requireAuth, publishKnowledgeBaseArticle);
router.patch("/:id/unpublish", requireAuth, unpublishKnowledgeBaseArticle);
router.post("/:id/relations", requireAuth, addKnowledgeBaseRelation);
router.delete("/:id/relations/:relatedArticleId", requireAuth, removeKnowledgeBaseRelation);
router.delete("/:id", requireAuth, deleteKnowledgeBaseArticle);

export default router;
