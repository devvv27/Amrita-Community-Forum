import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as analyticsController from "../controllers/analytics.controller.js";

const router = express.Router();

// Get user analytics
router.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const analytics = await analyticsController.getUserAnalytics(parseInt(userId));

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get skill performance breakdown
router.get("/user/:userId/skills", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const skills = await analyticsController.getSkillPerformance(parseInt(userId));

    res.json({ skills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get reputation history
router.get("/user/:userId/reputation-history", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const history = await analyticsController.getReputationHistory(parseInt(userId), limit);

    res.json({ history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get leaderboard
router.get("/leaderboard", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await analyticsController.getLeaderboard(limit);

    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trigger reputation recalculation (for admin or system)
router.post("/user/:userId/recalculate-reputation", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const newReputation = await analyticsController.calculateReputation(parseInt(userId));

    res.json({ reputation: newReputation, message: "Reputation recalculated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user analytics (internal endpoint)
router.post("/user/:userId/update-analytics", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    await analyticsController.updateUserAnalytics(parseInt(userId));

    res.json({ message: "Analytics updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
