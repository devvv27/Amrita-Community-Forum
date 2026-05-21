import { pool as db } from "../config/db.js";
import { logSystemActivity, updateUserAnalytics } from "./analytics.controller.js";

// Get all users with admin privileges
export async function getAllUsers(limit = 50, offset = 0) {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.reputation, u.skills, u.created_at,
              u.is_admin,
              COALESCE(um.status, 'ACTIVE') as moderation_status,
              COALESCE(ua.tasks_completed, 0) as tasks_completed,
              COALESCE(ua.average_rating, 0) as average_rating
       FROM users u
       LEFT JOIN user_moderation um ON u.id = um.user_id
       LEFT JOIN user_analytics ua ON u.id = ua.user_id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

// Delete user (admin action)
export async function deleteUser(adminId, userId, reason, ipAddress) {
  try {
    const adminCheck = await db.query("SELECT is_admin FROM users WHERE id = $1", [adminId]);

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    if (adminId === userId) {
      throw new Error("You cannot delete your own admin account");
    }

    const userResult = await db.query("SELECT id, is_admin FROM users WHERE id = $1", [userId]);

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    if (userResult.rows[0].is_admin) {
      throw new Error("Admin accounts cannot be deleted from the admin panel");
    }

    await logSystemActivity(adminId, "DELETE_USER", "user", userId, { reason }, ipAddress);

    await db.query(
      `INSERT INTO admin_actions (admin_id, action, target_user_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [adminId, "DELETE_USER", userId, reason]
    );

    const deleteResult = await db.query("DELETE FROM users WHERE id = $1", [userId]);

    if (deleteResult.rowCount === 0) {
      throw new Error("User not found");
    }

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

// Get all tasks for admin overview
export async function getAllTasks(limit = 50, offset = 0) {
  try {
    const result = await db.query(
      `SELECT t.id, t.title, t.status, t.difficulty, t.budget, t.deadline, t.created_at, t.updated_at,
              creator.name AS creator_name,
              solver.name AS solver_name,
              COALESCE((SELECT COUNT(*) FROM proposals p WHERE p.task_id = t.id), 0) AS proposal_count,
              COALESCE((SELECT COUNT(*) FROM disputes d WHERE d.task_id = t.id), 0) AS dispute_count
       FROM tasks t
       JOIN users creator ON creator.id = t.creator_id
       LEFT JOIN users solver ON solver.id = t.assigned_solver_id
       ORDER BY t.updated_at DESC, t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
}

// Get user count
export async function getUserCount() {
  try {
    const result = await db.query("SELECT COUNT(*) as count FROM users");
    return result.rows[0].count;
  } catch (error) {
    console.error("Error fetching user count:", error);
    throw error;
  }
}

// Flag/suspend user
export async function suspendUser(adminId, userId, reason, expiresAt, ipAddress) {
  try {
    // Check if admin
    const adminCheck = await db.query("SELECT is_admin FROM users WHERE id = $1", [
      adminId,
    ]);

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Update or create moderation record
    await db.query(
      `INSERT INTO user_moderation (user_id, status, reason, suspended_by_id, suspended_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (user_id) DO UPDATE SET
        status = $2,
        reason = $3,
        suspended_by_id = $4,
        suspended_at = NOW(),
        expires_at = $5`,
      [userId, "SUSPENDED", reason, adminId, expiresAt]
    );

    // Log admin action
    await logSystemActivity(
      adminId,
      "SUSPEND_USER",
      "user",
      userId,
      { reason, expiresAt },
      ipAddress
    );

    // Record admin action
    await db.query(
      `INSERT INTO admin_actions (admin_id, action, target_user_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [adminId, "SUSPEND_USER", userId, reason]
    );

    return { success: true, message: "User suspended successfully" };
  } catch (error) {
    console.error("Error suspending user:", error);
    throw error;
  }
}

// Unsuspend user
export async function unsuspendUser(adminId, userId, ipAddress) {
  try {
    // Check if admin
    const adminCheck = await db.query("SELECT is_admin FROM users WHERE id = $1", [
      adminId,
    ]);

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    await db.query(
      `UPDATE user_moderation SET status = 'ACTIVE' WHERE user_id = $1`,
      [userId]
    );

    // Log admin action
    await logSystemActivity(adminId, "UNSUSPEND_USER", "user", userId, {}, ipAddress);

    return { success: true, message: "User unsuspended successfully" };
  } catch (error) {
    console.error("Error unsuspending user:", error);
    throw error;
  }
}

// Flag content (post or comment)
export async function flagContent(userId, reason, postId = null, commentId = null) {
  try {
    if (!postId && !commentId) {
      throw new Error("Either postId or commentId must be provided");
    }

    const result = await db.query(
      `INSERT INTO content_flags (reported_by_id, post_id, comment_id, reason, status)
       VALUES ($1, $2, $3, $4, 'REPORTED')
       RETURNING id`,
      [userId, postId, commentId, reason]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error flagging content:", error);
    throw error;
  }
}

// Get flagged content
export async function getFlaggedContent(status = "REPORTED", limit = 50, offset = 0) {
  try {
    const result = await db.query(
      `SELECT 
        cf.id, cf.reported_by_id, cf.post_id, cf.comment_id, cf.reason, cf.status,
        cf.created_at, u.name as reporter_name,
        p.title as post_title, p.content as post_content,
        c.content as comment_content
       FROM content_flags cf
       JOIN users u ON cf.reported_by_id = u.id
       LEFT JOIN posts p ON cf.post_id = p.id
       LEFT JOIN comments c ON cf.comment_id = c.id
       WHERE cf.status = $1
       ORDER BY cf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching flagged content:", error);
    throw error;
  }
}

// Delete post (admin action)
export async function deletePost(adminId, postId, reason, ipAddress) {
  try {
    // Check if admin
    const adminCheck = await db.query("SELECT is_admin FROM users WHERE id = $1", [
      adminId,
    ]);

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Delete post
    const deleteResult = await db.query("DELETE FROM posts WHERE id = $1 RETURNING author_id", [
      postId,
    ]);

    if (deleteResult.rows.length === 0) {
      throw new Error("Post not found");
    }

    // Update content flags
    await db.query(
      `UPDATE content_flags SET status = 'RESOLVED' WHERE post_id = $1`,
      [postId]
    );

    // Log admin action
    await logSystemActivity(adminId, "DELETE_POST", "post", postId, { reason }, ipAddress);

    await db.query(
      `INSERT INTO admin_actions (admin_id, action, target_post_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [adminId, "DELETE_POST", postId, reason]
    );

    return { success: true, message: "Post deleted successfully" };
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
}

// Delete comment (admin action)
export async function deleteComment(adminId, commentId, reason, ipAddress) {
  try {
    // Check if admin
    const adminCheck = await db.query("SELECT is_admin FROM users WHERE id = $1", [
      adminId,
    ]);

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Delete comment
    const deleteResult = await db.query(
      "DELETE FROM comments WHERE id = $1 RETURNING author_id",
      [commentId]
    );

    if (deleteResult.rows.length === 0) {
      throw new Error("Comment not found");
    }

    // Update content flags
    await db.query(
      `UPDATE content_flags SET status = 'RESOLVED' WHERE comment_id = $1`,
      [commentId]
    );

    // Log admin action
    await logSystemActivity(
      adminId,
      "DELETE_COMMENT",
      "comment",
      commentId,
      { reason },
      ipAddress
    );

    await db.query(
      `INSERT INTO admin_actions (admin_id, action, target_comment_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [adminId, "DELETE_COMMENT", commentId, reason]
    );

    return { success: true, message: "Comment deleted successfully" };
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
}

// Resolve dispute (admin action)
export async function resolveDispute(adminId, disputeId, resolution, resolutionNotes, ipAddress) {
  try {
    // Check if admin
    const adminCheck = await db.query("SELECT is_admin FROM users WHERE id = $1", [
      adminId,
    ]);

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Get dispute details
    const disputeQuery = await db.query(
      `SELECT task_id, raised_by_id FROM disputes WHERE id = $1`,
      [disputeId]
    );

    if (disputeQuery.rows.length === 0) {
      throw new Error("Dispute not found");
    }

    const { task_id, raised_by_id } = disputeQuery.rows[0];

    // Update dispute
    await db.query(
      `UPDATE disputes SET status = $1, resolution_notes = $2, resolved_at = NOW() WHERE id = $3`,
      [resolution, resolutionNotes, disputeId]
    );

    // Update task status based on resolution
    if (resolution === "RESOLVED") {
      await db.query(`UPDATE tasks SET status = 'COMPLETED' WHERE id = $1`, [task_id]);
    } else if (resolution === "REJECTED") {
      await db.query(`UPDATE tasks SET status = 'IN_PROGRESS' WHERE id = $1`, [task_id]);
    }

    const taskQuery = await db.query(`SELECT creator_id, assigned_solver_id, title FROM tasks WHERE id = $1`, [task_id]);
    const task = taskQuery.rows[0];

    if (task) {
      await updateUserAnalytics(task.creator_id);
      if (task.assigned_solver_id) {
        await updateUserAnalytics(task.assigned_solver_id);
      }
    }

    if (task && task.assigned_solver_id) {
      await db.query(
        `INSERT INTO notifications (user_id, task_id, notification_type, message)
         VALUES ($1, $2, 'DISPUTE_RESOLVED', $3)`,
        [task.assigned_solver_id, task_id, `Dispute resolved for task: ${task.title}`]
      );
    }

    if (task) {
      await db.query(
        `INSERT INTO notifications (user_id, task_id, notification_type, message)
         VALUES ($1, $2, 'DISPUTE_RESOLVED', $3)`,
        [task.creator_id, task_id, `Dispute resolved for task: ${task.title}`]
      );
    }

    // Log admin action
    await logSystemActivity(
      adminId,
      "RESOLVE_DISPUTE",
      "dispute",
      disputeId,
      { task_id, resolution, resolutionNotes },
      ipAddress
    );

    await db.query(
      `INSERT INTO admin_actions (admin_id, action, reason, details)
       VALUES ($1, $2, $3, $4)`,
      [adminId, "RESOLVE_DISPUTE", resolutionNotes, JSON.stringify({ disputeId, task_id })]
    );

    return { success: true, message: "Dispute resolved successfully" };
  } catch (error) {
    console.error("Error resolving dispute:", error);
    throw error;
  }
}

// Get all disputes
export async function getAllDisputes(status = null, limit = 50, offset = 0) {
  try {
    let query = `SELECT 
                  d.id, d.task_id, d.raised_by_id, d.reason, d.status, d.resolution_notes,
                  d.created_at, d.resolved_at,
                  u.name as raised_by_name, t.title as task_title
                 FROM disputes d
                 JOIN users u ON d.raised_by_id = u.id
                 JOIN tasks t ON d.task_id = t.id
                 WHERE 1=1`;

    const params = [];

    if (status) {
      query += ` AND d.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error fetching disputes:", error);
    throw error;
  }
}

// Get dashboard statistics
export async function getDashboardStats() {
  try {
    const stats = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM tasks) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE status = 'COMPLETED') as completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE status = 'DISPUTED') as disputed_tasks,
        (SELECT COUNT(*) FROM disputes WHERE status = 'OPEN') as open_disputes,
        (SELECT COUNT(*) FROM content_flags WHERE status = 'REPORTED') as flagged_content,
        (SELECT COUNT(*) FROM user_moderation WHERE status = 'SUSPENDED') as suspended_users,
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM comments) as total_comments`
    );

    return stats.rows[0];
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
}

// Get admin actions log
export async function getAdminActionsLog(adminId = null, limit = 50, offset = 0) {
  try {
    let query = `SELECT aa.*, u.name as admin_name, tu.name as target_user_name
                 FROM admin_actions aa
                 JOIN users u ON aa.admin_id = u.id
                 LEFT JOIN users tu ON aa.target_user_id = tu.id
                 WHERE 1=1`;

    const params = [];

    if (adminId) {
      query += ` AND aa.admin_id = $1`;
      params.push(adminId);
    }

    query += ` ORDER BY aa.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error fetching admin actions:", error);
    throw error;
  }
}
