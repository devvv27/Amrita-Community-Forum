import { pool } from "../config/db.js";
import { updateUserAnalytics } from "./analytics.controller.js";

async function loadProfileSnapshot(userId) {
  const userResult = await pool.query(
    `SELECT u.id, u.name, u.email, u.skills, u.reputation, u.created_at,
            COALESCE(ua.tasks_created, 0) AS tasks_created,
            COALESCE(ua.tasks_completed, 0) AS tasks_completed,
            COALESCE(ua.tasks_disputed, 0) AS tasks_disputed,
            COALESCE(ua.proposals_submitted, 0) AS proposals_submitted,
            COALESCE(ua.proposals_accepted, 0) AS proposals_accepted,
            COALESCE(ua.average_rating, 0) AS average_rating,
            COALESCE(ua.completion_rate, 0) AS completion_rate,
            COALESCE(ua.dispute_rate, 0) AS dispute_rate,
            COALESCE(ua.posts_created, 0) AS posts_created,
            COALESCE(ua.comments_contributed, 0) AS comments_contributed,
            COALESCE(ua.upvotes_received, 0) AS upvotes_received,
            COALESCE(ua.total_earnings, 0) AS total_earnings
     FROM users u
     LEFT JOIN user_analytics ua ON ua.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  const skillsResult = await pool.query(
    `SELECT skill, tasks_completed, average_rating, total_earnings
     FROM skill_performance
     WHERE user_id = $1
     ORDER BY average_rating DESC, tasks_completed DESC`,
    [userId]
  );

  const communityResult = await pool.query(
    `SELECT
       COALESCE((SELECT COUNT(*) FROM posts WHERE author_id = $1), 0) AS posts_created,
       COALESCE((SELECT COUNT(*) FROM comments WHERE author_id = $1), 0) AS comments_contributed,
       COALESCE((SELECT COUNT(*) FROM post_votes pv JOIN posts p ON p.id = pv.post_id WHERE p.author_id = $1 AND pv.vote_type = 'UP'), 0)
       + COALESCE((SELECT COUNT(*) FROM comment_votes cv JOIN comments c ON c.id = cv.comment_id WHERE c.author_id = $1 AND cv.vote_type = 'UP'), 0) AS upvotes_received`,
    [userId]
  );

  return {
    user: userResult.rows[0],
    skills: skillsResult.rows,
    community: communityResult.rows[0],
  };
}

export async function getMyProfile(req, res, next) {
  try {
    let snapshot = await loadProfileSnapshot(req.user.id);

    if (!snapshot.user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (
      snapshot.user.tasks_created === 0 &&
      snapshot.user.tasks_completed === 0 &&
      snapshot.user.posts_created === 0 &&
      snapshot.user.comments_contributed === 0
    ) {
      await updateUserAnalytics(req.user.id);
      snapshot = await loadProfileSnapshot(req.user.id);
    }

    return res.json({
      user: snapshot.user,
      analytics: {
        tasks_created: Number(snapshot.user.tasks_created || 0),
        tasks_completed: Number(snapshot.user.tasks_completed || 0),
        tasks_disputed: Number(snapshot.user.tasks_disputed || 0),
        proposals_submitted: Number(snapshot.user.proposals_submitted || 0),
        proposals_accepted: Number(snapshot.user.proposals_accepted || 0),
        average_rating: Number(snapshot.user.average_rating || 0),
        completion_rate: Number(snapshot.user.completion_rate || 0),
        dispute_rate: Number(snapshot.user.dispute_rate || 0),
        posts_created: Number(snapshot.community.posts_created || 0),
        comments_contributed: Number(snapshot.community.comments_contributed || 0),
        upvotes_received: Number(snapshot.community.upvotes_received || 0),
        total_earnings: Number(snapshot.user.total_earnings || 0),
      },
      skills: snapshot.skills,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMySkills(req, res, next) {
  try {
    const rawSkills = Array.isArray(req.body.skills) ? req.body.skills : [];
    const skills = rawSkills.map((skill) => String(skill).trim()).filter(Boolean);

    const result = await pool.query(
      `UPDATE users
       SET skills = $1
       WHERE id = $2
       RETURNING id, name, email, skills, reputation, created_at`,
      [skills, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await updateUserAnalytics(req.user.id);

    return res.json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function searchPeople(req, res, next) {
  try {
    const { q = "", skill = "", minReputation = "", limit = "10" } = req.query;
    const params = [];
    const conditions = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    if (skill) {
      params.push(skill);
      conditions.push(`$${params.length} = ANY(u.skills)`);
    }

    if (minReputation) {
      params.push(Number(minReputation));
      conditions.push(`u.reputation >= $${params.length}`);
    }

    params.push(Number(limit) || 10);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.skills, u.reputation, u.created_at,
              COALESCE(ua.tasks_completed, 0) AS tasks_completed,
              COALESCE(ua.posts_created, 0) AS posts_created,
              COALESCE(ua.comments_contributed, 0) AS comments_contributed
       FROM users u
       LEFT JOIN user_analytics ua ON ua.user_id = u.id
       ${whereClause}
       ORDER BY u.reputation DESC, u.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return res.json({ people: result.rows });
  } catch (error) {
    return next(error);
  }
}
