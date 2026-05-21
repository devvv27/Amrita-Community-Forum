import { Router } from "express";
import {
  deleteNotification,
  getNotificationPreferences,
  getNotifications,
  markAsRead,
  markAllAsRead,
  updateNotificationPreferences,
} from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, getNotifications);
router.get("/preferences", requireAuth, getNotificationPreferences);
router.put("/preferences", requireAuth, updateNotificationPreferences);
router.patch("/:notificationId/read", requireAuth, markAsRead);
router.patch("/read-all", requireAuth, markAllAsRead);
router.delete("/:notificationId", requireAuth, deleteNotification);

export default router;
