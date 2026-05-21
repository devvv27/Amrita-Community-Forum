import { pool as db } from "../config/db.js";

// Calculate reputation using weighted formula
export async function calculateReputation(userId) {
  try {
    const userQuery = await db.query(
      `SELECT u.id, u.reputation, u.skills,
              COALESCE(ua.tasks_completed, 0) as tasks_completed,
              COALESCE(ua.tasks_disputed, 0) as tasks_disputed,
              COALESCE(ua.average_rating, 0) as average_rating,
              COALESCE(ua.completion_rate, 0) as completion_rate,
              COALESCE(ua.dispute_rate, 0) as dispute_rate,
              COALESCE(ua.posts_created, 0) as posts_created,
              COALESCE(ua.comments_contributed, 0) as comments_contributed,
              COALESCE(ua.upvotes_received, 0) as upvotes_received
       FROM users u
       LEFT JOIN user_analytics ua ON u.id = ua.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userQuery.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userQuery.rows[0];

    let reputation = 10;
    reputation += user.tasks_completed * 2.5;
    reputation += user.average_rating * 8;
    reputation += user.completion_rate * 0.15;
    reputation -= user.dispute_rate * 0.25;
    reputation += user.posts_created * 0.4;
    reputation += user.comments_contributed * 0.2;
    reputation += user.upvotes_received * 0.1;
    reputation -= user.tasks_disputed * 3;

    // Cap between 1 and 100
    reputation = Math.max(1, Math.min(100, Math.round(reputation)));

    // Record reputation change in history
    if (reputation !== user.reputation) {
      await db.query(
        `INSERT INTO reputation_history (user_id, old_reputation, new_reputation, reason)
         VALUES ($1, $2, $3, $4)`,
        [userId, user.reputation, reputation, "Reputation recalculation"]
      );

      // Update user reputation
      await db.query(`UPDATE users SET reputation = $1 WHERE id = $2`, [
        reputation,
        userId,
      ]);
    }

    return reputation;
  } catch (error) {
    console.error("Error calculating reputation:", error);
    throw error;
  }
}

// Update user analytics after task completion
export async function updateUserAnalytics(userId) {
  try {
    const analyticsQuery = await db.query(
      `WITH user_tasks AS (
         SELECT DISTINCT t.id, t.creator_id, t.assigned_solver_id, t.status, t.budget
         FROM tasks t
         WHERE t.creator_id = $1 OR t.assigned_solver_id = $1
       ),
       completed_tasks AS (
         SELECT * FROM user_tasks WHERE status = 'COMPLETED'
       )
       SELECT
         COALESCE((SELECT COUNT(*) FROM tasks WHERE creator_id = $1), 0) as tasks_created,
         COALESCE((SELECT COUNT(*) FROM tasks WHERE assigned_solver_id = $1 AND status = 'COMPLETED'), 0) as tasks_completed,
         COALESCE((SELECT COUNT(*) FROM user_tasks WHERE status = 'DISPUTED'), 0) as tasks_disputed,
         COALESCE((SELECT COUNT(*) FROM proposals WHERE solver_id = $1), 0) as proposals_submitted,
         COALESCE((SELECT COUNT(*) FROM proposals WHERE solver_id = $1 AND status = 'ACCEPTED'), 0) as proposals_accepted,
         COALESCE((SELECT AVG(rating_score) FROM ratings WHERE rated_user_id = $1), 0)::NUMERIC(3,2) as average_rating,
         COALESCE((SELECT COUNT(*) FROM posts WHERE author_id = $1), 0) as posts_created,
         COALESCE((SELECT COUNT(*) FROM comments WHERE author_id = $1), 0) as comments_contributed,
         COALESCE((SELECT COUNT(*) FROM post_votes pv JOIN posts p ON p.id = pv.post_id WHERE p.author_id = $1 AND pv.vote_type = 'UP'), 0)
         + COALESCE((SELECT COUNT(*) FROM comment_votes cv JOIN comments c ON c.id = cv.comment_id WHERE c.author_id = $1 AND cv.vote_type = 'UP'), 0) as upvotes_received,
         COALESCE((SELECT SUM(budget) FROM completed_tasks), 0)::NUMERIC(12,2) as total_earnings,
         COALESCE((SELECT COUNT(*) FROM user_tasks), 0) as total_tasks
       `,
      [userId]
    );

    if (analyticsQuery.rows.length === 0) {
      return;
    }

    const stats = analyticsQuery.rows[0];
    const completionRate =
      stats.total_tasks > 0 ? Number(((stats.tasks_completed / stats.total_tasks) * 100).toFixed(2)) : 0;
    const disputeRate =
      stats.total_tasks > 0 ? Number(((stats.tasks_disputed / stats.total_tasks) * 100).toFixed(2)) : 0;

    await db.query(
      `INSERT INTO user_analytics (
        user_id,
        tasks_created,
        tasks_completed,
        tasks_disputed,
        proposals_submitted,
        proposals_accepted,
        average_rating,
        completion_rate,
        dispute_rate,
        posts_created,
        comments_contributed,
        upvotes_received,
        total_earnings,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      )
       ON CONFLICT (user_id) DO UPDATE SET
        tasks_created = EXCLUDED.tasks_created,
        tasks_completed = EXCLUDED.tasks_completed,
        tasks_disputed = EXCLUDED.tasks_disputed,
        proposals_submitted = EXCLUDED.proposals_submitted,
        proposals_accepted = EXCLUDED.proposals_accepted,
        average_rating = EXCLUDED.average_rating,
        completion_rate = EXCLUDED.completion_rate,
        dispute_rate = EXCLUDED.dispute_rate,
        posts_created = EXCLUDED.posts_created,
        comments_contributed = EXCLUDED.comments_contributed,
        upvotes_received = EXCLUDED.upvotes_received,
        total_earnings = EXCLUDED.total_earnings,
        updated_at = NOW()`,
      [
        userId,
        stats.tasks_created,
        stats.tasks_completed,
        stats.tasks_disputed,
        stats.proposals_submitted,
        stats.proposals_accepted,
        stats.average_rating,
        completionRate,
        disputeRate,
        stats.posts_created,
        stats.comments_contributed,
        stats.upvotes_received,
        stats.total_earnings,
      ]
    );

    // Fetch user skills from users table (avoid using undefined `userQuery`)
    const userRes = await db.query(`SELECT skills FROM users WHERE id = $1`, [userId]);
    const skills = Array.isArray(userRes.rows[0]?.skills) ? userRes.rows[0].skills : [];
    for (const skill of skills) {
      await updateSkillPerformance(userId, skill);
    }

    // Recalculate reputation after updating analytics
    await calculateReputation(userId);
  } catch (error) {
    console.error("Error updating user analytics:", error);
    throw error;
  }
}

// Update skill performance
export async function updateSkillPerformance(userId, skill) {
  try {
    const skillQuery = await db.query(
      `SELECT 
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) as tasks_completed,
        COALESCE(AVG(r.rating_score), 0)::NUMERIC(3,2) as average_rating,
        COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN t.budget ELSE 0 END), 0) as total_earnings
       FROM tasks t
       LEFT JOIN ratings r ON t.id = r.task_id AND r.rated_user_id = $1
       WHERE t.assigned_solver_id = $1
       AND t.status = 'COMPLETED'
       AND $2 = ANY(t.tech_stack)`,
      [userId, skill]
    );

    if (skillQuery.rows.length === 0) {
      return;
    }

    const skillStats = skillQuery.rows[0];

    await db.query(
      `INSERT INTO skill_performance (user_id, skill, tasks_completed, average_rating, total_earnings, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, skill) DO UPDATE SET
        tasks_completed = $3,
        average_rating = $4,
        total_earnings = $5,
        updated_at = NOW()`,
      [
        userId,
        skill,
        skillStats.tasks_completed,
        skillStats.average_rating,
        skillStats.total_earnings,
      ]
    );
  } catch (error) {
    console.error("Error updating skill performance:", error);
    throw error;
  }
}

// Get user analytics
export async function getUserAnalytics(userId) {
  try {
    const analyticsQuery = await db.query(
      `SELECT ua.*, u.reputation, u.skills
       FROM user_analytics ua
       JOIN users u ON ua.user_id = u.id
       WHERE ua.user_id = $1`,
      [userId]
    );

    if (analyticsQuery.rows.length === 0) {
      throw new Error("Analytics not found");
    }

    return analyticsQuery.rows[0];
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    throw error;
  }
}

// Get skill performance breakdown
export async function getSkillPerformance(userId) {
  try {
    const skillQuery = await db.query(
      `SELECT * FROM skill_performance WHERE user_id = $1 ORDER BY average_rating DESC`,
      [userId]
    );

    return skillQuery.rows;
  } catch (error) {
    console.error("Error fetching skill performance:", error);
    throw error;
  }
}

// Log system activity
export async function logSystemActivity(userId, action, entityType, entityId, details, ipAddress) {
  try {
    await db.query(
      `INSERT INTO system_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error("Error logging system activity:", error);
    // Don't throw - just log error
  }
}

// Get system logs with filters
export async function getSystemLogs(filters = {}, limit = 100, offset = 0) {
  try {
    let query = "SELECT * FROM system_logs WHERE 1=1";
    const params = [];
    let paramCount = 1;

    if (filters.action) {
      query += ` AND action = $${paramCount}`;
      params.push(filters.action);
      paramCount++;
    }

    if (filters.entityType) {
      query += ` AND entity_type = $${paramCount}`;
      params.push(filters.entityType);
      paramCount++;
    }

    if (filters.userId) {
      query += ` AND user_id = $${paramCount}`;
      params.push(filters.userId);
      paramCount++;
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.endDate);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error fetching system logs:", error);
    throw error;
  }
}

// Get reputation history for user
export async function getReputationHistory(userId, limit = 50) {
  try {
    const result = await db.query(
      `SELECT rh.*, t.title as task_title
       FROM reputation_history rh
       LEFT JOIN tasks t ON rh.task_id = t.id
       WHERE rh.user_id = $1
       ORDER BY rh.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching reputation history:", error);
    throw error;
  }
}

export async function getLeaderboard(limit = 10) {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.skills, u.reputation,
              COALESCE(ua.tasks_completed, 0) AS tasks_completed,
              COALESCE(ua.proposals_accepted, 0) AS proposals_accepted,
              COALESCE(ua.average_rating, 0) AS average_rating,
              COALESCE(ua.total_earnings, 0) AS total_earnings,
              COALESCE(ua.posts_created, 0) AS posts_created,
              COALESCE(ua.comments_contributed, 0) AS comments_contributed
       FROM users u
       LEFT JOIN user_analytics ua ON ua.user_id = u.id
       ORDER BY u.reputation DESC, tasks_completed DESC, average_rating DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }
}
