import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as advancedTasksController from "../controllers/tasks-advanced.controller.js";

const router = express.Router();

// Smart recommendations endpoint removed (server-side implementation deleted)

// Get trending tasks
router.get("/trending", async (req, res) => {
  try {
    const { limit = 15 } = req.query;

    const tasks = await advancedTasksController.getTrendingTasks(parseInt(limit));

    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update task status
router.patch("/bulk/status", requireAuth, async (req, res) => {
  try {
    const { taskIds, status } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "Task IDs array is required" });
    }

    if (!status) {
      return res.status(400).json({ message: "New status is required" });
    }

    const updated = await advancedTasksController.bulkUpdateTaskStatus(
      taskIds,
      status,
      req.user.id
    );

    res.json({ updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Auto-assign top proposal
router.post("/:taskId/auto-assign", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;

    const proposal = await advancedTasksController.autoAssignProposal(
      parseInt(taskId),
      req.user.id
    );

    res.json({ assigned: proposal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get task metrics
router.get("/:taskId/metrics", async (req, res) => {
  try {
    const { taskId } = req.params;

    const metrics = await advancedTasksController.getTaskMetrics(parseInt(taskId));

    res.json({ metrics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Track task view
router.post("/:taskId/view", async (req, res) => {
  try {
    const { taskId } = req.params;

    await advancedTasksController.trackTaskView(parseInt(taskId));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get workspace insights
router.get("/team/:teamId/insights", requireAuth, async (req, res) => {
  try {
    const { teamId } = req.params;

    const insights = await advancedTasksController.getWorkspaceTaskInsights(
      parseInt(teamId)
    );

    res.json({ insights });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
