import app from "./app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { pool } from "./config/db.js";

const port = Number(process.env.PORT || 5000);
const __dirname = dirname(fileURLToPath(import.meta.url));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map(o => o.trim()),
    credentials: true,
  },
});

// Store active connections per task
const taskConnections = {};

async function archiveClosedTasks() {
  try {
    await pool.query(
      `UPDATE tasks
       SET archived_at = NOW(), updated_at = NOW()
       WHERE status = 'COMPLETED'
         AND archived_at IS NULL
         AND updated_at < NOW() - INTERVAL '7 days'`
    );
  } catch (error) {
    console.error("Error archiving closed tasks:", error);
  }
}

async function ensureSchema() {
  const schemaPath = resolve(__dirname, "../db/schema.sql");
  const rawSql = await readFile(schemaPath, "utf8");
  const vectorResult = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available"
  );
  const vectorAvailable = Boolean(vectorResult.rows[0]?.available);
  const schemaSql = vectorAvailable
    ? rawSql
    : rawSql.replace(
        /-- pgvector: embeddings storage for engineering knowledge[\s\S]*?CREATE INDEX IF NOT EXISTS idx_engineering_knowledge_framework ON engineering_knowledge\(framework\);\s*/m,
        ""
      );

  // Run statements one-by-one so we can ignore duplicate enum type creation in existing DBs.
  const statements = schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    if (!vectorAvailable) {
      const isVectorStatement =
        /^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+vector/i.test(statement) ||
        /engineering_knowledge/i.test(statement) ||
        /vector_cosine_ops/i.test(statement) ||
        /\bvector\s*\(/i.test(statement);

      if (isVectorStatement) {
        continue;
      }
    }

    try {
      await pool.query(statement);
    } catch (error) {
      const isCreateType = /^CREATE\s+TYPE\b/i.test(statement);
      const isCreateIndex = /^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(statement);
      const isDuplicateObject = error?.code === "42710" || /already exists/i.test(error?.message || "");
      const isMissingDependency = error?.code === "42P01" || error?.code === "42703";

      if (isCreateType && isDuplicateObject) {
        continue;
      }

      // Legacy DBs can miss some columns/tables referenced by optional indexes.
      if (isCreateIndex && isMissingDependency) {
        continue;
      }

      throw error;
    }
  }

  // Backfill key columns for older task/user schemas used by newer routes.
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_solver_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE");
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)");
  await pool.query("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'PROPOSAL_RECEIVED'");
  await pool.query("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MESSAGE_RECEIVED'");

  console.log("DB migration: schema ensured from schema.sql");
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join task chat room
  socket.on("join-task-chat", (taskId) => {
    const roomName = `task-${taskId}`;
    socket.join(roomName);
    
    if (!taskConnections[taskId]) {
      taskConnections[taskId] = new Set();
    }
    taskConnections[taskId].add(socket.id);

    io.to(roomName).emit("user-joined", {
      message: `User joined the chat`,
      activeUsers: taskConnections[taskId].size,
    });
  });

  // Join private 1:1 chat for a task between two users
  socket.on("join-private-chat", ({ taskId, userId, otherUserId }) => {
    try {
      const a = Number(userId);
      const b = Number(otherUserId);
      const [minId, maxId] = a < b ? [a, b] : [b, a];
      const roomName = `task-${taskId}-private-${minId}-${maxId}`;
      socket.join(roomName);
    } catch (e) {
      console.error('join-private-chat error', e);
    }
  });

  socket.on("identify", (userId) => {
    try {
      const uid = Number(userId);
      if (!Number.isNaN(uid)) {
        socket.join(`user-${uid}`);
      }
    } catch (e) {
      console.error("identify error", e);
    }
  });

  // Send private message in task context (emitted to private room)
  socket.on("send-private-message", (data) => {
    try {
      const { taskId, fromUserId, toUserId, message, fileUrl } = data || {};
      const a = Number(fromUserId);
      const b = Number(toUserId);
      const [minId, maxId] = a < b ? [a, b] : [b, a];
      const roomName = `task-${taskId}-private-${minId}-${maxId}`;
      io.to(roomName).emit("receive-private-message", {
        fromUserId,
        toUserId,
        message,
        fileUrl: fileUrl || null,
        timestamp: new Date(),
      });

      (async () => {
        try {
          const recipientId = Number(toUserId);
          const totalRes = await pool.query(
            `SELECT COUNT(*) AS cnt
             FROM messages m
             WHERE m.recipient_id = $1
               AND NOT EXISTS (
                 SELECT 1 FROM message_reads mr
                 WHERE mr.message_id = m.id
                   AND mr.user_id = $1
               )`,
            [recipientId]
          );
          const taskRes = await pool.query(
            `SELECT COUNT(*) AS cnt
             FROM messages m
             WHERE m.recipient_id = $1
               AND m.task_id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM message_reads mr
                 WHERE mr.message_id = m.id
                   AND mr.user_id = $1
               )`,
            [recipientId, Number(taskId)]
          );

          io.to(`user-${recipientId}`).emit("private-unread-updated", {
            taskId: Number(taskId),
            unreadForTask: Number(taskRes.rows[0]?.cnt || 0),
            totalUnread: Number(totalRes.rows[0]?.cnt || 0),
          });
        } catch (error) {
          console.error("private unread update after send failed", error);
        }
      })();
    } catch (e) {
      console.error('send-private-message error', e);
    }
  });

  // Send message
  socket.on("send-message", (data) => {
    const { taskId, message, userId, userName, fileUrl = null, parentMessageId = null } = data;
    const roomName = `task-${taskId}`;
    
    io.to(roomName).emit("receive-message", {
      userId,
      userName,
      message,
      fileUrl,
      parentMessageId,
      timestamp: new Date(),
    });
  });

  // Typing indicator
  socket.on("typing", (data) => {
    const { taskId, userName } = data;
    const roomName = `task-${taskId}`;
    socket.to(roomName).emit("user-typing", { userName });
  });

  // Stop typing
  socket.on("stop-typing", (data) => {
    const { taskId, userName } = data;
    const roomName = `task-${taskId}`;
    socket.to(roomName).emit("user-stop-typing", { userName });
  });

  // Mark message as read
  socket.on("message-read", (data) => {
    const { taskId, messageId } = data;
    const roomName = `task-${taskId}`;
    socket.to(roomName).emit("read-receipt", { messageId });
  });

  // Private message read receipt
  socket.on("private-message-read", (data) => {
    try {
      const { taskId, messageId, fromUserId, toUserId } = data;
      const a = Number(fromUserId);
      const b = Number(toUserId);
      const [minId, maxId] = a < b ? [a, b] : [b, a];
      const roomName = `task-${taskId}-private-${minId}-${maxId}`;
      socket.to(roomName).emit("private-read-receipt", { messageId, readerId: toUserId });

      (async () => {
        try {
          const readerId = Number(toUserId);
          const otherId = Number(fromUserId);

          const [readerTotal, readerTask, otherTotal, otherTask] = await Promise.all([
            pool.query(
              `SELECT COUNT(*) AS cnt
               FROM messages m
               WHERE m.recipient_id = $1
                 AND NOT EXISTS (
                   SELECT 1 FROM message_reads mr
                   WHERE mr.message_id = m.id
                     AND mr.user_id = $1
                 )`,
              [readerId]
            ),
            pool.query(
              `SELECT COUNT(*) AS cnt
               FROM messages m
               WHERE m.recipient_id = $1
                 AND m.task_id = $2
                 AND NOT EXISTS (
                   SELECT 1 FROM message_reads mr
                   WHERE mr.message_id = m.id
                     AND mr.user_id = $1
                 )`,
              [readerId, Number(taskId)]
            ),
            pool.query(
              `SELECT COUNT(*) AS cnt
               FROM messages m
               WHERE m.recipient_id = $1
                 AND NOT EXISTS (
                   SELECT 1 FROM message_reads mr
                   WHERE mr.message_id = m.id
                     AND mr.user_id = $1
                 )`,
              [otherId]
            ),
            pool.query(
              `SELECT COUNT(*) AS cnt
               FROM messages m
               WHERE m.recipient_id = $1
                 AND m.task_id = $2
                 AND NOT EXISTS (
                   SELECT 1 FROM message_reads mr
                   WHERE mr.message_id = m.id
                     AND mr.user_id = $1
                 )`,
              [otherId, Number(taskId)]
            ),
          ]);

          io.to(`user-${readerId}`).emit("private-unread-updated", {
            taskId: Number(taskId),
            unreadForTask: Number(readerTask.rows[0]?.cnt || 0),
            totalUnread: Number(readerTotal.rows[0]?.cnt || 0),
          });
          io.to(`user-${otherId}`).emit("private-unread-updated", {
            taskId: Number(taskId),
            unreadForTask: Number(otherTask.rows[0]?.cnt || 0),
            totalUnread: Number(otherTotal.rows[0]?.cnt || 0),
          });
        } catch (error) {
          console.error("private unread update after read failed", error);
        }
      })();
    } catch (e) {
      console.error('private-message-read error', e);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    Object.keys(taskConnections).forEach((taskId) => {
      taskConnections[taskId].delete(socket.id);
      if (taskConnections[taskId].size === 0) {
        delete taskConnections[taskId];
      }
    });
  });
});

ensureSchema().then(() => {
  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    // archiveClosedTasks(); // Disabled pending DB migration
    // setInterval(archiveClosedTasks, 24 * 60 * 60 * 1000); // Disabled pending DB migration
  });
}).catch((err) => {
  console.error('Failed to ensure DB schema on startup:', err);
  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
