import { Router } from "express";
import { submitRating, getRatings, getTaskRatings } from "../controllers/ratings.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/:taskId", requireAuth, submitRating);
router.get("/user/:userId", getRatings);
router.get("/:taskId", getTaskRatings);

export default router;
