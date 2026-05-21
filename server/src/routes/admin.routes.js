import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as adminController from "../controllers/admin.controller.js";
import { logSystemActivity } from "../controllers/analytics.controller.js";

const router = express.Router();

// Middleware to check admin status
const checkAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all users
router.get("/users", requireAuth, checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const users = await adminController.getAllUsers(limit, offset);
    const count = await adminController.getUserCount();

    await logSystemActivity(req.user.id, "VIEW_USERS_LIST", "user", null, {}, req.ip);

    res.json({ users, count, limit, offset });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all tasks
router.get("/tasks", requireAuth, checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const tasks = await adminController.getAllTasks(limit, offset);

    await logSystemActivity(req.user.id, "VIEW_TASKS", "task", null, {}, req.ip);

    res.json({ tasks, limit, offset });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Suspend user
router.post("/users/:userId/suspend", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, expiresAt } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const result = await adminController.suspendUser(
      req.user.id,
      parseInt(userId),
      reason,
      expiresAt,
      req.ip
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unsuspend user
router.post("/users/:userId/unsuspend", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await adminController.unsuspendUser(
      req.user.id,
      parseInt(userId),
      req.ip
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete("/users/:userId", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const result = await adminController.deleteUser(
      req.user.id,
      parseInt(userId),
      reason,
      req.ip
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get flagged content
router.get("/flagged-content", requireAuth, checkAdmin, async (req, res) => {
  try {
    const status = req.query.status || "REPORTED";
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const content = await adminController.getFlaggedContent(status, limit, offset);

    await logSystemActivity(
      req.user.id,
      "VIEW_FLAGGED_CONTENT",
      "content",
      null,
      { status },
      req.ip
    );

    res.json({ content });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete post
router.delete("/posts/:postId", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const result = await adminController.deletePost(
      req.user.id,
      parseInt(postId),
      reason,
      req.ip
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete comment
router.delete("/comments/:commentId", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const result = await adminController.deleteComment(
      req.user.id,
      parseInt(commentId),
      reason,
      req.ip
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all disputes
router.get("/disputes", requireAuth, checkAdmin, async (req, res) => {
  try {
    const status = req.query.status || null;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const disputes = await adminController.getAllDisputes(status, limit, offset);

    await logSystemActivity(
      req.user.id,
      "VIEW_DISPUTES",
      "dispute",
      null,
      { status },
      req.ip
    );

    res.json({ disputes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resolve dispute
router.patch("/disputes/:disputeId/resolve", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, resolutionNotes } = req.body;

    if (!resolution) {
      return res.status(400).json({ message: "Resolution status is required" });
    }

    if (!["RESOLVED", "REJECTED"].includes(resolution)) {
      return res.status(400).json({ message: "Invalid resolution status" });
    }

    const result = await adminController.resolveDispute(
      req.user.id,
      parseInt(disputeId),
      resolution,
      resolutionNotes || "",
      req.ip
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard stats
router.get("/dashboard/stats", requireAuth, checkAdmin, async (req, res) => {
  try {
    const stats = await adminController.getDashboardStats();

    await logSystemActivity(
      req.user.id,
      "VIEW_DASHBOARD",
      "admin",
      null,
      {},
      req.ip
    );

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get system logs
router.get("/system-logs", requireAuth, checkAdmin, async (req, res) => {
  try {
    const { action, entityType, userId, startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const { getSystemLogs } = await import("../controllers/analytics.controller.js");

    const logs = await getSystemLogs(
      {
        action,
        entityType,
        userId: userId ? parseInt(userId) : null,
        startDate,
        endDate,
      },
      limit,
      offset
    );

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get admin actions log
router.get("/admin-actions", requireAuth, checkAdmin, async (req, res) => {
  try {
    const adminId = req.query.adminId ? parseInt(req.query.adminId) : null;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const actions = await adminController.getAdminActionsLog(adminId, limit, offset);

    res.json({ actions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
