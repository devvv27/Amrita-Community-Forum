import { pool } from "../config/db.js";

async function loadNotificationPreferences(userId) {
  const result = await pool.query(
    `SELECT task_updates, discussion_activity, recommendations, marketing
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    return {
      task_updates: true,
      discussion_activity: true,
      recommendations: true,
      marketing: false,
    };
  }

  return result.rows[0];
}

function notificationGroup(notificationType) {
  if ([
    "PROPOSAL_ACCEPTED",
    "PROPOSAL_REJECTED",
    "PROPOSAL_RECEIVED",
    "MESSAGE_RECEIVED",
    "TASK_ASSIGNED",
    "TASK_APPROVED",
    "TASK_DISPUTED",
    "DISPUTE_RESOLVED",
  ].includes(notificationType)) {
    return "task_updates";
  }

  return "discussion_activity";
}

export async function createNotification(userId, taskId, notificationType, message) {
  try {
    const preferences = await loadNotificationPreferences(userId);
    const preferenceKey = notificationGroup(notificationType);

    if (preferences[preferenceKey] === false) {
      return;
    }

    await pool.query(
      `INSERT INTO notifications (user_id, task_id, notification_type, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, taskId, notificationType, message]
    );
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

export async function getNotifications(req, res, next) {
  try {
    const { unreadOnly = false } = req.query;

    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const params = [req.user.id];

    if (unreadOnly === "true") {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);
    return res.json({ notifications: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { notificationId } = req.params;

    const notificationResult = await pool.query(
      `SELECT * FROM notifications WHERE id = $1`,
      [notificationId]
    );

    if (notificationResult.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const notification = notificationResult.rows[0];
    if (notification.user_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to mark this notification" });
    }

    const result = await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`,
      [notificationId]
    );

    return res.json({ notification: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    return next(error);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const { notificationId } = req.params;

    const notificationResult = await pool.query(
      `SELECT * FROM notifications WHERE id = $1`,
      [notificationId]
    );

    if (notificationResult.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const notification = notificationResult.rows[0];
    if (notification.user_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this notification" });
    }

    await pool.query(`DELETE FROM notifications WHERE id = $1`, [notificationId]);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function getNotificationPreferences(req, res, next) {
  try {
    const preferences = await loadNotificationPreferences(req.user.id);
    return res.json({ preferences });
  } catch (error) {
    return next(error);
  }
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    const incoming = req.body || {};
    const nextPreferences = {
      task_updates: Boolean(incoming.task_updates),
      discussion_activity: Boolean(incoming.discussion_activity),
      recommendations: Boolean(incoming.recommendations),
      marketing: Boolean(incoming.marketing),
    };

    const result = await pool.query(
      `INSERT INTO notification_preferences (
        user_id,
        task_updates,
        discussion_activity,
        recommendations,
        marketing,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         task_updates = EXCLUDED.task_updates,
         discussion_activity = EXCLUDED.discussion_activity,
         recommendations = EXCLUDED.recommendations,
         marketing = EXCLUDED.marketing,
         updated_at = NOW()
       RETURNING *`,
      [
        req.user.id,
        nextPreferences.task_updates,
        nextPreferences.discussion_activity,
        nextPreferences.recommendations,
        nextPreferences.marketing,
      ]
    );

    return res.json({ preferences: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}
