import { pool } from "../config/db.js";
import { createNotification } from "./notifications.controller.js";
import { updateUserAnalytics } from "./analytics.controller.js";

export async function submitDeliverables(req, res, next) {
  try {
    const { taskId } = req.params;
    const { submissionNotes, fileUrl } = req.body;

    if (!fileUrl && !submissionNotes) {
      return res.status(400).json({ message: "Submission notes or file is required" });
    }

    // Verify task exists and user is assigned solver
    const taskResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND assigned_solver_id = $2`,
      [taskId, req.user.id]
    );

    if (taskResult.rowCount === 0) {
      return res.status(403).json({ message: "Not authorized to submit for this task" });
    }

    const task = taskResult.rows[0];
    if (task.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Task must be IN_PROGRESS to submit deliverables" });
    }

    // Check if submission already exists
    const existingSubmission = await pool.query(
      `SELECT * FROM task_submissions WHERE task_id = $1 AND solver_id = $2`,
      [taskId, req.user.id]
    );

    let submission;
    if (existingSubmission.rowCount > 0) {
      // Update existing submission
      const result = await pool.query(
        `UPDATE task_submissions 
         SET submission_notes = COALESCE($1, submission_notes),
             file_url = COALESCE($2, file_url),
             submitted_at = NOW()
         WHERE task_id = $3 AND solver_id = $4
         RETURNING *`,
        [submissionNotes || null, fileUrl || null, taskId, req.user.id]
      );
      submission = result.rows[0];
    } else {
      // Create new submission
      const result = await pool.query(
        `INSERT INTO task_submissions (task_id, solver_id, submission_notes, file_url, status)
         VALUES ($1, $2, $3, $4, 'SUBMITTED')
         RETURNING *`,
        [taskId, req.user.id, submissionNotes || null, fileUrl || null]
      );
      submission = result.rows[0];
    }

    // Update task status to UNDER_REVIEW
    await pool.query(
      `UPDATE tasks SET status = 'UNDER_REVIEW', updated_at = NOW() WHERE id = $1`,
      [taskId]
    );

    return res.status(201).json({ submission });
  } catch (error) {
    return next(error);
  }
}

export async function getSubmission(req, res, next) {
  try {
    const { taskId } = req.params;

    const result = await pool.query(
      `SELECT s.*, u.name AS solver_name
       FROM task_submissions s
       JOIN users u ON u.id = s.solver_id
       WHERE s.task_id = $1`,
      [taskId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No submission found for this task" });
    }

    return res.json({ submission: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function approveSubmission(req, res, next) {
  try {
    const { taskId } = req.params;

    // Verify user is task creator
    const taskResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND creator_id = $2`,
      [taskId, req.user.id]
    );

    if (taskResult.rowCount === 0) {
      return res.status(403).json({ message: "Only task creator can approve submission" });
    }

    const task = taskResult.rows[0];
    if (task.status !== "UNDER_REVIEW") {
      return res.status(400).json({ message: "Task must be UNDER_REVIEW to approve" });
    }

    // Update task status to COMPLETED
    const result = await pool.query(
      `UPDATE tasks SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [taskId]
    );

    // Update submission status
    await pool.query(
      `UPDATE task_submissions SET status = 'APPROVED' WHERE task_id = $1`,
      [taskId]
    );

    await updateUserAnalytics(task.assigned_solver_id || task.creator_id);
    await updateUserAnalytics(task.creator_id);

    await createNotification(
      task.assigned_solver_id,
      taskId,
      "TASK_APPROVED",
      `Your submission for task \"${task.title}\" was approved`
    );

    await createNotification(
      task.creator_id,
      taskId,
      "TASK_APPROVED",
      `Task \"${task.title}\" has been marked completed`
    );

    return res.json({ task: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function rejectSubmission(req, res, next) {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    // Verify user is task creator
    const taskResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND creator_id = $2`,
      [taskId, req.user.id]
    );

    if (taskResult.rowCount === 0) {
      return res.status(403).json({ message: "Only task creator can reject submission" });
    }

    const task = taskResult.rows[0];
    if (task.status !== "UNDER_REVIEW") {
      return res.status(400).json({ message: "Task must be UNDER_REVIEW to reject" });
    }

    // Update task status back to IN_PROGRESS
    const result = await pool.query(
      `UPDATE tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [taskId]
    );

    // Update submission status
    await pool.query(
      `UPDATE task_submissions SET status = 'REJECTED' WHERE task_id = $1`,
      [taskId]
    );

    await updateUserAnalytics(task.assigned_solver_id || task.creator_id);
    await updateUserAnalytics(task.creator_id);

    await createNotification(
      task.assigned_solver_id,
      taskId,
      "TASK_DISPUTED",
      `Your submission for task \"${task.title}\" was rejected`
    );

    return res.json({ task: result.rows[0], message: reason || "Submission rejected" });
  } catch (error) {
    return next(error);
  }
}
