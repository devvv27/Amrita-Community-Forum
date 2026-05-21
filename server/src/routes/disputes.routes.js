import { Router } from "express";
import {
  raiseDispute,
  getDispute,
  getTaskDisputes,
  resolveDispute,
  getAllDisputes,
} from "../controllers/disputes.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", getAllDisputes);
router.post("/:taskId/raise", requireAuth, raiseDispute);
router.get("/:disputeId", getDispute);
router.get("/task/:taskId", getTaskDisputes);
router.patch("/:disputeId/resolve", requireAuth, resolveDispute);

export default router;
