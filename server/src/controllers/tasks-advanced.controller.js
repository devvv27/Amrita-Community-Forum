import { pool } from "../config/db.js";

// ADVANCED TASK FEATURES

// Smart recommendations implementation removed — endpoint deprecated

// Get trending tasks with analytics
export async function getTrendingTasks(limit = 15) {
  try {
    const result = await pool.query(
      `SELECT 
        t.*,
        u.name AS creator_name,
        COUNT(p.id) as proposal_count,
        AVG(p.bid_amount) as avg_bid,
        (SELECT COUNT(*) FROM saved_tasks WHERE task_id = t.id) as save_count,
        CASE 
          WHEN t.views > 100 AND t.created_at > NOW() - INTERVAL '7 days' THEN 'HOT'
          WHEN COUNT(p.id) > 5 THEN 'COMPETITIVE'
          WHEN t.created_at > NOW() - INTERVAL '1 day' THEN 'NEW'
          ELSE 'ACTIVE'
        END as trend_status,
        (
          (t.views::float / NULLIF((SELECT AVG(views) FROM tasks), 0)) * 30 +
          ((COUNT(p.id))::float / NULLIF((SELECT AVG(proposal_count) FROM (
            SELECT COUNT(*) as proposal_count FROM proposals GROUP BY task_id
          ) pc), 0)) * 30 +
          (t.success_rate * 20) +
          CASE WHEN t.created_at > NOW() - INTERVAL '3 days' THEN 20 ELSE 0 END
        ) as trend_score
       FROM tasks t
       JOIN users u ON u.id = t.creator_id
       LEFT JOIN proposals p ON p.task_id = t.id
       WHERE t.status = 'OPEN'
       GROUP BY t.id, u.name
       ORDER BY trend_score DESC,  t.views DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting trending tasks:", error);
    throw error;
  }
}

// Bulk update task status
export async function bulkUpdateTaskStatus(taskIds, newStatus, userId) {
  try {
    // Verify user owns all tasks
    const ownershipCheck = await pool.query(
      `SELECT COUNT(*) FROM tasks WHERE id = ANY($1::int[]) AND creator_id <> $2`,
      [taskIds, userId]
    );

    if (ownershipCheck.rows[0].count > 0) {
      throw new Error("You can only update your own tasks");
    }

    const result = await pool.query(
      `UPDATE tasks 
       SET status = $1, updated_at = NOW()
       WHERE id = ANY($2::int[]) AND creator_id = $3
       RETURNING id, status, updated_at`,
      [newStatus, taskIds, userId]
    );

    return result.rows;
  } catch (error) {
    console.error("Error bulk updating tasks:", error);
    throw error;
  }
}

// Auto-assign top proposal to task
export async function autoAssignProposal(taskId, userId) {
  try {
    // Verify task ownership
    const taskCheck = await pool.query(
      "SELECT id FROM tasks WHERE id = $1 AND creator_id = $2",
      [taskId, userId]
    );

    if (taskCheck.rowCount === 0) {
      throw new Error("Task not found or unauthorized");
    }

    // Get top-ranked proposal by solver reputation and bid amount
    const topProposal = await pool.query(
      `SELECT p.id, p.solver_id, u.reputation 
       FROM proposals p
       JOIN users u ON u.id = p.solver_id
       WHERE p.task_id = $1 AND p.status = 'PENDING'
       ORDER BY u.reputation DESC, p.bid_amount ASC
       LIMIT 1`,
      [taskId]
    );

    if (topProposal.rowCount === 0) {
      throw new Error("No proposals available");
    }

    const proposal = topProposal.rows[0];

    // Accept the proposal
    await pool.query(
      `UPDATE proposals SET status = 'ACCEPTED' WHERE id = $1`,
      [proposal.id]
    );

    // Update task status
    await pool.query(
      `UPDATE tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1`,
      [taskId]
    );

    return proposal;
  } catch (error) {
    console.error("Error auto-assigning proposal:", error);
    throw error;
  }
}

// Get task performance metrics
export async function getTaskMetrics(taskId) {
  try {
    const result = await pool.query(
      `SELECT 
        t.id,
        t.title,
        t.status,
        t.views,
        t.complexity_score,
        t.success_rate,
        COUNT(p.id) as total_proposals,
        COUNT(CASE WHEN p.status = 'PENDING' THEN 1 END) as pending_proposals,
        COUNT(CASE WHEN p.status = 'ACCEPTED' THEN 1 END) as accepted_proposals,
        AVG(p.bid_amount) as avg_bid_amount,
        MIN(p.bid_amount) as min_bid_amount,
        MAX(p.bid_amount) as max_bid_amount,
        (SELECT COUNT(*) FROM saved_tasks WHERE task_id = t.id) as saves,
        EXTRACT(EPOCH FROM (t.deadline - NOW()))::int / 86400 as days_remaining,
        CASE 
          WHEN t.views = 0 THEN 'LOW'
          WHEN t.views < 50 THEN 'MEDIUM'
          ELSE 'HIGH'
        END as visibility_level
       FROM tasks t
       LEFT JOIN proposals p ON p.task_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [taskId]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error getting task metrics:", error);
    throw error;
  }
}

// Track task view
export async function trackTaskView(taskId) {
  try {
    await pool.query(
      `UPDATE tasks SET views = COALESCE(views, 0) + 1 WHERE id = $1`,
      [taskId]
    );
  } catch (error) {
    console.error("Error tracking task view:", error);
  }
}

// Calculate task complexity score
export async function calculateComplexityScore(taskId) {
  try {
    const taskResult = await pool.query(
      `SELECT difficulty, budget, tech_stack FROM tasks WHERE id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      throw new Error("Task not found");
    }

    const task = taskResult.rows[0];

    // Complexity formula
    const difficultyScore = {
      BEGINNER: 1,
      INTERMEDIATE: 2.5,
      ADVANCED: 4,
    }[task.difficulty] || 1;

    const budgetScore = Math.min(task.budget / 10000, 2); // Normalized to max 2
    const techStackScore = (task.tech_stack?.length || 0) * 0.3;

    const complexityScore = (difficultyScore * 40 + budgetScore * 30 + techStackScore * 30) / 100;

    // Update task
    await pool.query(
      `UPDATE tasks SET complexity_score = $1 WHERE id = $2`,
      [complexityScore, taskId]
    );

    return complexityScore;
  } catch (error) {
    console.error("Error calculating complexity:", error);
    throw error;
  }
}

// Get task recommendations for workspace
export async function getWorkspaceTaskInsights(teamId) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'OPEN' THEN 1 END) as open_tasks,
        COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) as completed_tasks,
        AVG(t.budget) as avg_budget,
        SUM(t.budget) as total_budget,
        AVG(t.complexity_score) as avg_complexity,
        (SELECT AVG(success_rate) FROM tasks WHERE team_id = $1) as team_success_rate,
        (SELECT COUNT(*) FROM proposals p JOIN tasks t ON p.task_id = t.id WHERE t.team_id = $1) as total_proposals
       FROM tasks t
       WHERE t.team_id = $1`,
      [teamId]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error getting workspace insights:", error);
    throw error;
  }
}
