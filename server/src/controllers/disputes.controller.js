import { pool } from "../config/db.js";
import { updateUserAnalytics } from "./analytics.controller.js";

export async function raiseDispute(req, res, next) {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Dispute reason is required" });
    }

    // Verify task exists and user is involved
    const taskResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND (creator_id = $2 OR assigned_solver_id = $2)`,
      [taskId, req.user.id]
    );

    if (taskResult.rowCount === 0) {
      return res.status(403).json({ message: "Not authorized to raise dispute for this task" });
    }

    const task = taskResult.rows[0];

    // Check if task can be disputed (should be in certain states)
    if (!["IN_PROGRESS", "UNDER_REVIEW", "COMPLETED"].includes(task.status)) {
      return res.status(400).json({ message: "Task cannot be disputed in current status" });
    }

    // Check if dispute already exists
    const existingDispute = await pool.query(
      `SELECT * FROM disputes WHERE task_id = $1 AND status != 'RESOLVED' AND status != 'REJECTED'`,
      [taskId]
    );

    if (existingDispute.rowCount > 0) {
      return res.status(400).json({ message: "An active dispute already exists for this task" });
    }

    // Create dispute
    const result = await pool.query(
      `INSERT INTO disputes (task_id, raised_by_id, reason, status)
       VALUES ($1, $2, $3, 'OPEN')
       RETURNING *`,
      [taskId, req.user.id, reason]
    );

    const dispute = result.rows[0];

    // Update task status to DISPUTED
    await pool.query(
      `UPDATE tasks SET status = 'DISPUTED', updated_at = NOW() WHERE id = $1`,
      [taskId]
    );

    // Create notification for admin (user id 1 as placeholder for admin)
    await pool.query(
      `INSERT INTO notifications (user_id, task_id, notification_type, message)
       VALUES (1, $1, 'TASK_DISPUTED', 'Dispute raised for task: ' || $2)`,
      [taskId, task.title]
    );

    await updateUserAnalytics(req.user.id);

    return res.status(201).json({ dispute });
  } catch (error) {
    return next(error);
  }
}

export async function getDispute(req, res, next) {
  try {
    const { disputeId } = req.params;

    const result = await pool.query(
      `SELECT d.*, u.name AS raised_by_name, t.title AS task_title, t.creator_id, t.assigned_solver_id
       FROM disputes d
       JOIN users u ON u.id = d.raised_by_id
       JOIN tasks t ON t.id = d.task_id
       WHERE d.id = $1`,
      [disputeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    return res.json({ dispute: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function getTaskDisputes(req, res, next) {
  try {
    const { taskId } = req.params;

    const result = await pool.query(
      `SELECT d.*, u.name AS raised_by_name
       FROM disputes d
       JOIN users u ON u.id = d.raised_by_id
       WHERE d.task_id = $1
       ORDER BY d.created_at DESC`,
      [taskId]
    );

    return res.json({ disputes: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function resolveDispute(req, res, next) {
  try {
    const { disputeId } = req.params;
    const { resolution, resolutionNotes } = req.body;

    if (!["RESOLVED", "REJECTED"].includes(resolution)) {
      return res.status(400).json({ message: "Resolution must be RESOLVED or REJECTED" });
    }

    // Get dispute
    const disputeResult = await pool.query(
      `SELECT * FROM disputes WHERE id = $1`,
      [disputeId]
    );

    if (disputeResult.rowCount === 0) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    const dispute = disputeResult.rows[0];

    // Update dispute
    const result = await pool.query(
      `UPDATE disputes
       SET status = $1, resolution_notes = $2, resolved_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [resolution, resolutionNotes || null, disputeId]
    );

    // Get the task
    const taskResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1`,
      [dispute.task_id]
    );

    const task = taskResult.rows[0];

    // Update task status based on resolution
    let newTaskStatus = "COMPLETED";
    if (resolution === "REJECTED") {
      newTaskStatus = task.assigned_solver_id ? "IN_PROGRESS" : "OPEN";
    }

    await pool.query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newTaskStatus, dispute.task_id]
    );

    await updateUserAnalytics(task.creator_id);
    if (task.assigned_solver_id) {
      await updateUserAnalytics(task.assigned_solver_id);
    }

    // Notify involved parties
    const notificationMessage = `Dispute resolved: ${resolution}`;
    await pool.query(
      `INSERT INTO notifications (user_id, task_id, notification_type, message)
       VALUES ($1, $2, 'DISPUTE_RESOLVED', $3)`,
      [task.creator_id, dispute.task_id, notificationMessage]
    );

    if (task.assigned_solver_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, notification_type, message)
         VALUES ($1, $2, 'DISPUTE_RESOLVED', $3)`,
        [task.assigned_solver_id, dispute.task_id, notificationMessage]
      );
    }

    return res.json({ dispute: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function getAllDisputes(req, res, next) {
  try {
    const { status = "OPEN" } = req.query;

    let query = `SELECT d.*, u.name AS raised_by_name, t.title AS task_title
                 FROM disputes d
                 JOIN users u ON u.id = d.raised_by_id
                 JOIN tasks t ON t.id = d.task_id`;

    const params = [];
    if (status) {
      query += ` WHERE d.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(query, params);
    return res.json({ disputes: result.rows });
  } catch (error) {
    return next(error);
  }
}
