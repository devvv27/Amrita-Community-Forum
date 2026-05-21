import { Router } from "express";
import {
  submitDeliverables,
  getSubmission,
  approveSubmission,
  rejectSubmission,
} from "../controllers/submissions.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/:taskId/submit", requireAuth, submitDeliverables);
router.get("/:taskId", requireAuth, getSubmission);
router.patch("/:taskId/approve", requireAuth, approveSubmission);
router.patch("/:taskId/reject", requireAuth, rejectSubmission);

export default router;
