import { pool } from "../config/db.js";
import { createNotification } from "./notifications.controller.js";

async function getTaskChatContext(taskId, userId) {
  const taskResult = await pool.query(
    `SELECT t.id, t.creator_id, t.assigned_solver_id, t.title, t.status,
            EXISTS (SELECT 1 FROM proposals p WHERE p.task_id = t.id AND p.solver_id = $2) AS has_proposal
     FROM tasks t
     WHERE t.id = $1
       AND (
         t.creator_id = $2
         OR t.assigned_solver_id = $2
         OR EXISTS (SELECT 1 FROM proposals p WHERE p.task_id = t.id AND p.solver_id = $2)
       )`,
    [taskId, userId]
  );

  return taskResult.rows[0] || null;
}

export async function sendMessage(req, res, next) {
  try {
    const { taskId } = req.params;
    const { content, fileUrl, parentMessageId = null } = req.body;

    if (!content && !fileUrl) {
      return res.status(400).json({ message: "Message content or file is required" });
    }

    const task = await getTaskChatContext(taskId, req.user.id);

    if (!task) {
      return res.status(403).json({ message: "Not authorized to message this task" });
    }

    // Prevent sending messages to closed tasks
    // Treat COMPLETED and DISPUTED as closed
    if (["COMPLETED", "DISPUTED"].includes(task.status)) {
      return res.status(403).json({ message: "Task is closed — chat is read-only" });
    }

    if (parentMessageId) {
      const parentResult = await pool.query(
        `SELECT id FROM messages WHERE id = $1 AND task_id = $2`,
        [parentMessageId, taskId]
      );

      if (parentResult.rowCount === 0) {
        return res.status(404).json({ message: "Parent message not found" });
      }
    }

    const result = await pool.query(
      `INSERT INTO messages (task_id, sender_id, parent_message_id, content, file_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, task_id, sender_id, content, file_url, created_at`,
      [taskId, req.user.id, parentMessageId, content || null, fileUrl || null]
    );

    const participantResult = await pool.query(
      `SELECT DISTINCT participant_id
       FROM (
         SELECT creator_id AS participant_id FROM tasks WHERE id = $1
         UNION ALL
         SELECT assigned_solver_id AS participant_id FROM tasks WHERE id = $1 AND assigned_solver_id IS NOT NULL
         UNION ALL
         SELECT solver_id AS participant_id FROM proposals WHERE task_id = $1
       ) participants
       WHERE participant_id IS NOT NULL AND participant_id <> $2`,
      [taskId, req.user.id]
    );

    await Promise.all(
      participantResult.rows.map((row) =>
        createNotification(
          row.participant_id,
          taskId,
          "MESSAGE_RECEIVED",
          `New message on task: ${task.title}`
        )
      )
    );

    return res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const { taskId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const task = await getTaskChatContext(taskId, req.user.id);

    if (!task) {
      return res.status(403).json({ message: "Not authorized to view this task chat" });
    }

    const result = await pool.query(
      `SELECT m.*, u.name AS sender_name,
              COALESCE((SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id), 0) AS read_count,
              CASE WHEN EXISTS (
                SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = $4
              ) THEN true ELSE false END AS is_read_by_me
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.task_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [taskId, Number(limit), Number(offset), req.user.id]
    );

    const byId = new Map();
    const roots = [];

    for (const row of result.rows) {
      byId.set(row.id, { ...row, replies: [] });
    }

    for (const row of result.rows) {
      const current = byId.get(row.id);
      if (row.parent_message_id && byId.has(row.parent_message_id)) {
        byId.get(row.parent_message_id).replies.push(current);
      } else {
        roots.push(current);
      }
    }

    const messages = roots;

    return res.json({ messages });
  } catch (error) {
    return next(error);
  }
}

export async function markMessageRead(req, res, next) {
  try {
    const { messageId } = req.params;

    const messageResult = await pool.query(
      `SELECT m.id, m.task_id, t.creator_id, t.assigned_solver_id
       FROM messages m
       JOIN tasks t ON t.id = m.task_id
       WHERE m.id = $1`,
      [messageId]
    );

    if (messageResult.rowCount === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    const message = messageResult.rows[0];
    const task = await getTaskChatContext(message.task_id, req.user.id);
    if (!task) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await pool.query(
      `INSERT INTO message_reads (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, req.user.id]
    );

    return res.json({ message: "Marked as read" });
  } catch (error) {
    return next(error);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { messageId } = req.params;

    const messageResult = await pool.query(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rowCount === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    const message = messageResult.rows[0];
    if (message.sender_id !== req.user.id) {
      return res.status(403).json({ message: "Only sender can delete message" });
    }

    await pool.query(`DELETE FROM messages WHERE id = $1`, [messageId]);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function sendPrivateMessage(req, res, next) {
  try {
    const { taskId } = req.params;
    const { content, fileUrl = null, recipientId, parentMessageId = null } = req.body;

    if (!content && !fileUrl) {
      return res.status(400).json({ message: "Message content or file is required" });
    }

    // Verify both sender and recipient are participants of the task
    const taskContext = await getTaskChatContext(taskId, req.user.id);
    if (!taskContext) return res.status(403).json({ message: "Not authorized to message this task" });

    // Prevent sending private messages on closed tasks
    if (["COMPLETED", "DISPUTED"].includes(taskContext.status)) {
      return res.status(403).json({ message: "Task is closed — chat is read-only" });
    }

    // Check recipient is part of task participants
    const participantCheck = await pool.query(
      `SELECT 1 FROM (
         SELECT creator_id AS participant_id FROM tasks WHERE id = $1
         UNION ALL
         SELECT assigned_solver_id AS participant_id FROM tasks WHERE id = $1 AND assigned_solver_id IS NOT NULL
         UNION ALL
         SELECT solver_id AS participant_id FROM proposals WHERE task_id = $1
       ) participants WHERE participant_id = $2`,
      [taskId, recipientId]
    );

    if (participantCheck.rowCount === 0) {
      return res.status(403).json({ message: "Recipient not part of this task" });
    }

    const result = await pool.query(
      `INSERT INTO messages (task_id, sender_id, recipient_id, parent_message_id, content, file_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, task_id, sender_id, recipient_id, parent_message_id, content, file_url, created_at`,
      [taskId, req.user.id, recipientId, parentMessageId || null, content || null, fileUrl || null]
    );

    // Create notification for recipient
    await createNotification(recipientId, taskId, "MESSAGE_RECEIVED", `Private message on task: ${taskContext.title}`);

    return res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function getPrivateMessages(req, res, next) {
  try {
    const { taskId, recipientId } = req.params;
    // recipientId in URL is the other party's id; we should return messages between req.user.id and recipientId

    const otherId = Number(recipientId);
    const myId = req.user.id;

    const task = await getTaskChatContext(taskId, req.user.id);
    if (!task) return res.status(403).json({ message: "Not authorized to view this task chat" });

    const result = await pool.query(
      `SELECT m.*, u.name AS sender_name,
              COALESCE((SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id), 0) AS read_count,
              CASE WHEN EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = $4) THEN true ELSE false END AS is_read_by_me
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.task_id = $1
         AND (
           (m.recipient_id IS NOT NULL AND ((m.sender_id = $2 AND m.recipient_id = $3) OR (m.sender_id = $3 AND m.recipient_id = $2)))
         )
       ORDER BY m.created_at ASC`,
      [taskId, myId, otherId, myId]
    );

    // Build threaded structure by parent_message_id
    const byId = new Map();
    const roots = [];
    for (const row of result.rows) {
      byId.set(row.id, { ...row, replies: [] });
    }
    for (const row of result.rows) {
      const current = byId.get(row.id);
      if (row.parent_message_id && byId.has(row.parent_message_id)) {
        byId.get(row.parent_message_id).replies.push(current);
      } else {
        roots.push(current);
      }
    }

    return res.json({ messages: roots });
  } catch (error) {
    return next(error);
  }
}

export async function getPrivateUnreadCounts(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT task_id, COUNT(*) AS unread_count
       FROM messages m
       WHERE m.recipient_id = $1
         AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = $1)
       GROUP BY task_id`,
      [userId]
    );

    // return as map task_id => count
    const map = {};
    for (const row of result.rows) {
      map[row.task_id] = Number(row.unread_count);
    }
    return res.json({ counts: map });
  } catch (error) {
    return next(error);
  }
}

export async function getChatSummaries(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT t.id AS task_id, t.title, t.status,
              (SELECT m.content FROM messages m WHERE m.task_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM messages m WHERE m.task_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
              COALESCE((SELECT COUNT(*) FROM messages m2 WHERE m2.task_id = t.id AND m2.sender_id <> $1 AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m2.id AND mr.user_id = $1)), 0) AS unread_count
       FROM tasks t
       WHERE t.creator_id = $1
          OR t.assigned_solver_id = $1
          OR EXISTS (SELECT 1 FROM proposals p WHERE p.task_id = t.id AND p.solver_id = $1)
       ORDER BY last_message_at DESC`,
      [userId]
    );

    return res.json({ chats: result.rows });
  } catch (error) {
    return next(error);
  }
}
