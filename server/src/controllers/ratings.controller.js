import { pool } from "../config/db.js";

export async function submitRating(req, res, next) {
  try {
    const { taskId } = req.params;
    const { ratedUserId, ratingScore, feedback } = req.body;

    if (!ratingScore || ratingScore < 1 || ratingScore > 5) {
      return res.status(400).json({ message: "Rating score must be between 1 and 5" });
    }

    // Verify task exists and is completed
    const taskResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND status = 'COMPLETED'`,
      [taskId]
    );

    if (taskResult.rowCount === 0) {
      return res.status(404).json({ message: "Task not found or not completed" });
    }

    const task = taskResult.rows[0];

    // Verify rater is either creator or solver
    if (task.creator_id !== req.user.id && task.assigned_solver_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to rate this task" });
    }

    // Verify rated user is involved in task
    if (ratedUserId !== task.creator_id && ratedUserId !== task.assigned_solver_id) {
      return res.status(400).json({ message: "Rated user is not part of this task" });
    }

    // Cannot rate yourself
    if (ratedUserId === req.user.id) {
      return res.status(400).json({ message: "Cannot rate yourself" });
    }

    // Check if rating already exists
    const existingRating = await pool.query(
      `SELECT * FROM ratings WHERE task_id = $1 AND rater_id = $2 AND rated_user_id = $3`,
      [taskId, req.user.id, ratedUserId]
    );

    let rating;
    if (existingRating.rowCount > 0) {
      // Update existing rating
      const result = await pool.query(
        `UPDATE ratings 
         SET rating_score = $1, feedback = $2
         WHERE task_id = $3 AND rater_id = $4 AND rated_user_id = $5
         RETURNING *`,
        [ratingScore, feedback || null, taskId, req.user.id, ratedUserId]
      );
      rating = result.rows[0];
    } else {
      // Create new rating
      const result = await pool.query(
        `INSERT INTO ratings (task_id, rater_id, rated_user_id, rating_score, feedback)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [taskId, req.user.id, ratedUserId, ratingScore, feedback || null]
      );
      rating = result.rows[0];
    }

    // Update user reputation based on rating
    await updateUserReputation(ratedUserId);

    return res.status(201).json({ rating });
  } catch (error) {
    return next(error);
  }
}

export async function updateUserReputation(userId) {
  try {
    // Calculate average rating
    const ratingResult = await pool.query(
      `SELECT AVG(rating_score) as avg_rating, COUNT(*) as total_ratings
       FROM ratings WHERE rated_user_id = $1`,
      [userId]
    );

    const { avg_rating, total_ratings } = ratingResult.rows[0];
    const avgRating = avg_rating ? Math.round(parseFloat(avg_rating)) : 0;

    // Base reputation is 10, add 5 points per rating point (max bonus 25)
    const reputationBonus = Math.min(avgRating * 5, 25);
    const newReputation = 10 + reputationBonus;

    await pool.query(
      `UPDATE users SET reputation = $1 WHERE id = $2`,
      [newReputation, userId]
    );
  } catch (error) {
    console.error("Error updating reputation:", error);
  }
}

export async function getRatings(req, res, next) {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT r.*, u.name AS rater_name, t.title AS task_title
       FROM ratings r
       JOIN users u ON u.id = r.rater_id
       JOIN tasks t ON t.id = r.task_id
       WHERE r.rated_user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const stats = await pool.query(
      `SELECT 
        AVG(rating_score) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN rating_score >= 4 THEN 1 END) as positive_ratings
       FROM ratings WHERE rated_user_id = $1`,
      [userId]
    );

    return res.json({
      ratings: result.rows,
      stats: stats.rows[0] || { avg_rating: null, total_ratings: 0, positive_ratings: 0 },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getTaskRatings(req, res, next) {
  try {
    const { taskId } = req.params;

    const result = await pool.query(
      `SELECT r.*, u.name AS rater_name
       FROM ratings r
       JOIN users u ON u.id = r.rater_id
       WHERE r.task_id = $1
       ORDER BY r.created_at DESC`,
      [taskId]
    );

    return res.json({ ratings: result.rows });
  } catch (error) {
    return next(error);
  }
}
