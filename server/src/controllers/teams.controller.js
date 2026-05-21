import { pool } from "../config/db.js";
import crypto from "crypto";

const ROLE_PERMISSIONS = {
  OWNER: {
    view: true,
    edit_team: true,
    manage_members: true,
    delete_team: true,
    access_analytics: true,
    manage_settings: true,
    create_tasks: true,
    comment: true,
    propose: true,
  },
  ADMIN: {
    view: true,
    edit_team: true,
    manage_members: true,
    access_analytics: true,
    manage_settings: true,
    create_tasks: true,
    comment: true,
    propose: true,
  },
  LEAD: {
    view: true,
    edit_team: false,
    manage_members: false,
    create_tasks: true,
    comment: true,
    propose: true,
    access_analytics: true,
  },
  MEMBER: {
    view: true,
    create_tasks: true,
    comment: true,
    propose: true,
  },
  VIEWER: {
    view: true,
    comment: false,
    propose: false,
  },
};

async function logActivity(teamId, userId, action, details) {
  try {
    await pool.query(
      `INSERT INTO team_activity_logs (team_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [teamId, userId, action, JSON.stringify(details)]
    );
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function createTeam(req, res, next) {
  try {
    const { name, description = "", isPublic = false, tier = "FREE" } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Team name is required" });
    }

    const result = await pool.query(
      `INSERT INTO teams (name, description, created_by_id, is_public, tier, settings)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, created_by_id, is_public, tier, settings, created_at`,
      [name, description, req.user.id, isPublic, tier, JSON.stringify({ created_at: new Date() })]
    );

    const team = result.rows[0];

    // Add creator as OWNER member
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', $3)`,
      [team.id, req.user.id, JSON.stringify(ROLE_PERMISSIONS.OWNER)]
    );

    await logActivity(team.id, req.user.id, "TEAM_CREATED", { teamName: name });

    return res.status(201).json({ team });
  } catch (error) {
    return next(error);
  }
}

export async function getMyTeams(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT t.id, t.name, t.description, t.created_by_id, t.is_public, t.tier, t.created_at,
              u.name AS created_by_name,
              COUNT(DISTINCT tm.id) AS member_count,
              (
                SELECT role
                FROM team_members
                WHERE team_id = t.id AND user_id = $1
              ) AS current_user_role
       FROM teams t
       JOIN users u ON u.id = t.created_by_id
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 OR t.created_by_id = $1
       GROUP BY t.id, u.name
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );

    return res.json({ teams: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function getTeam(req, res, next) {
  try {
    const { id } = req.params;

    const teamResult = await pool.query(
      `SELECT t.id, t.name, t.description, t.created_by_id, t.is_public, t.tier, t.settings, t.created_at,
              u.name AS created_by_name
       FROM teams t
       JOIN users u ON u.id = t.created_by_id
       WHERE t.id = $1`,
      [id]
    );

    if (teamResult.rowCount === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    const team = teamResult.rows[0];

    const membersResult = await pool.query(
      `SELECT tm.id, tm.user_id, tm.role, tm.permissions, tm.joined_at, u.name, u.email, u.reputation
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY CASE WHEN tm.role = 'OWNER' THEN 0 WHEN tm.role = 'ADMIN' THEN 1 WHEN tm.role = 'LEAD' THEN 2 ELSE 3 END, tm.joined_at ASC`,
      [id]
    );

    // Get team analytics
    const analyticsResult = await pool.query(
      `SELECT tasks_created, tasks_completed, members_active, total_earnings, efficiency_score
       FROM team_analytics
       WHERE team_id = $1
       ORDER BY year DESC, week_of_year DESC
       LIMIT 1`,
      [id]
    );

    return res.json({
      team,
      members: membersResult.rows,
      analytics: analyticsResult.rows[0] || {
        tasks_created: 0,
        tasks_completed: 0,
        members_active: 0,
        total_earnings: 0,
        efficiency_score: 0,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function inviteTeamMember(req, res, next) {
  try {
    const { id } = req.params;
    const { email, role = "MEMBER" } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user is ADMIN/OWNER of the team
    const adminCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (
      adminCheck.rowCount === 0 ||
      !["ADMIN", "OWNER"].includes(adminCheck.rows[0].role)
    ) {
      return res
        .status(403)
        .json({ message: "Only team admins can invite members" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await pool.query(
      `INSERT INTO team_invitations (team_id, email, invited_by_id, token, role, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, token, expires_at`,
      [id, email, req.user.id, token, role, expiresAt]
    );

    await logActivity(id, req.user.id, "MEMBER_INVITED", {
      email,
      role,
    });

    return res.status(201).json({
      invitation: result.rows[0],
      inviteLink: `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/team-invite/${token}`,
    });
  } catch (error) {
    return next(error);
  }
}

export async function acceptTeamInvitation(req, res, next) {
  try {
    const { token } = req.params;

    const invitationResult = await pool.query(
      `SELECT * FROM team_invitations WHERE token = $1`,
      [token]
    );

    if (invitationResult.rowCount === 0) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    const invitation = invitationResult.rows[0];

    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({ message: "Invitation expired" });
    }

    // Add user to team
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id, user_id) DO UPDATE
       SET role = EXCLUDED.role`,
      [
        invitation.team_id,
        req.user.id,
        invitation.role,
        JSON.stringify(ROLE_PERMISSIONS[invitation.role]),
      ]
    );

    // Mark invitation as used
    await pool.query(`DELETE FROM team_invitations WHERE id = $1`, [
      invitation.id,
    ]);

    await logActivity(invitation.team_id, req.user.id, "MEMBER_JOINED", {
      invitedBy: invitation.invited_by_id,
    });

    return res.json({ message: "Successfully joined team" });
  } catch (error) {
    return next(error);
  }
}

export async function addTeamMember(req, res, next) {
  try {
    const { id } = req.params;
    const { userId, role = "MEMBER" } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!Object.keys(ROLE_PERMISSIONS).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if user is ADMIN/OWNER of the team
    const adminCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (
      adminCheck.rowCount === 0 ||
      !["ADMIN", "OWNER"].includes(adminCheck.rows[0].role)
    ) {
      return res
        .status(403)
        .json({ message: "Only team admins can add members" });
    }

    // Add member
    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id, user_id) DO UPDATE
       SET role = EXCLUDED.role, permissions = EXCLUDED.permissions
       RETURNING id, team_id, user_id, role, joined_at`,
      [id, userId, role, JSON.stringify(ROLE_PERMISSIONS[role])]
    );

    await logActivity(id, req.user.id, "MEMBER_ADDED", { userId, role });

    return res.status(201).json({ member: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    if (!Object.keys(ROLE_PERMISSIONS).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if user is ADMIN/OWNER of the team
    const adminCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (
      adminCheck.rowCount === 0 ||
      !["ADMIN", "OWNER"].includes(adminCheck.rows[0].role)
    ) {
      return res
        .status(403)
        .json({ message: "Only team admins can change roles" });
    }

    const memberCheck = await pool.query(
      `SELECT user_id FROM team_members WHERE id = $1 AND team_id = $2`,
      [memberId, id]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(404).json({ message: "Team member not found" });
    }

    const result = await pool.query(
      `UPDATE team_members
       SET role = $1, permissions = $2
       WHERE id = $3
       RETURNING id, team_id, user_id, role, joined_at`,
      [role, JSON.stringify(ROLE_PERMISSIONS[role]), memberId]
    );

    await logActivity(id, req.user.id, "ROLE_UPDATED", {
      memberId,
      newRole: role,
    });

    return res.json({ member: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function removeTeamMember(req, res, next) {
  try {
    const { id, memberId } = req.params;

    // Check if user is ADMIN/OWNER of the team
    const adminCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (
      adminCheck.rowCount === 0 ||
      !["ADMIN", "OWNER"].includes(adminCheck.rows[0].role)
    ) {
      return res
        .status(403)
        .json({ message: "Only team admins can remove members" });
    }

    const memberCheck = await pool.query(
      `SELECT role, user_id FROM team_members WHERE id = $1 AND team_id = $2`,
      [memberId, id]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(404).json({ message: "Team member not found" });
    }

    // Prevent removing the last owner
    if (memberCheck.rows[0].role === "OWNER") {
      const ownerCount = await pool.query(
        `SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND role = 'OWNER'`,
        [id]
      );

      if (ownerCount.rows[0].count === 1) {
        return res
          .status(400)
          .json({ message: "Cannot remove the last owner from the team" });
      }
    }

    await pool.query(`DELETE FROM team_members WHERE id = $1`, [memberId]);

    await logActivity(id, req.user.id, "MEMBER_REMOVED", {
      userId: memberCheck.rows[0].user_id,
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function updateTeamSettings(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, isPublic, settings } = req.body;

    // Check if user is ADMIN/OWNER of the team
    const adminCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (
      adminCheck.rowCount === 0 ||
      !["ADMIN", "OWNER"].includes(adminCheck.rows[0].role)
    ) {
      return res
        .status(403)
        .json({ message: "Only team admins can change settings" });
    }

    const result = await pool.query(
      `UPDATE teams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_public = COALESCE($3, is_public),
           settings = COALESCE($4, settings),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, description, is_public, tier, settings`,
      [
        name,
        description,
        isPublic,
        settings ? JSON.stringify(settings) : null,
        id,
      ]
    );

    await logActivity(id, req.user.id, "SETTINGS_UPDATED", {
      updatedFields: { name, description, isPublic },
    });

    return res.json({ team: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function getTeamActivity(req, res, next) {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const result = await pool.query(
      `SELECT tal.id, tal.action, tal.details, tal.created_at, u.name AS user_name
       FROM team_activity_logs tal
       JOIN users u ON u.id = tal.user_id
       WHERE tal.team_id = $1
       ORDER BY tal.created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    return res.json({ activities: result.rows });
  } catch (error) {
    return next(error);
  }
}

export async function getTeamAnalytics(req, res, next) {
  try {
    const { id } = req.params;

    const analyticsResult = await pool.query(
      `SELECT * FROM team_analytics
       WHERE team_id = $1
       ORDER BY year DESC, week_of_year DESC
       LIMIT 52`,
      [id]
    );

    const memberCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM team_members WHERE team_id = $1`,
      [id]
    );

    const tasksResult = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'OPEN') as open_tasks,
              COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tasks,
              SUM(budget) as total_earnings
       FROM tasks WHERE team_id = $1`,
      [id]
    );

    return res.json({
      analytics: analyticsResult.rows,
      teamStats: {
        memberCount: memberCountResult.rows[0].count,
        openTasks: tasksResult.rows[0].open_tasks || 0,
        completedTasks: tasksResult.rows[0].completed_tasks || 0,
        totalEarnings: tasksResult.rows[0].total_earnings || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteTeam(req, res, next) {
  try {
    const { id } = req.params;

    const teamResult = await pool.query(
      `SELECT created_by_id FROM teams WHERE id = $1`,
      [id]
    );

    if (teamResult.rowCount === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Only team owner can delete
    if (teamResult.rows[0].created_by_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Only team owner can delete the team" });
    }

    await logActivity(id, req.user.id, "TEAM_DELETED", {});
    await pool.query(`DELETE FROM teams WHERE id = $1`, [id]);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
