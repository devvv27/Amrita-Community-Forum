import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import tasksAdvancedRoutes from "./routes/tasks-advanced.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import submissionsRoutes from "./routes/submissions.routes.js";
import ratingsRoutes from "./routes/ratings.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import disputesRoutes from "./routes/disputes.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import commentsRoutes from "./routes/comments.routes.js";
import commentsAdvancedRoutes from "./routes/comments-advanced.routes.js";
import teamsRoutes from "./routes/teams.routes.js";
import searchRoutes from "./routes/search.routes.js";
import knowledgeBaseRoutes from "./routes/knowledgeBase.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin);
}

function isNgrokOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+\.(ngrok-free\.dev|ngrok-free\.app|ngrok\.io)$/i.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin) || isNgrokOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_LIMIT || '10mb' }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/tasks-advanced", tasksAdvancedRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/submissions", submissionsRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/disputes", disputesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/comments-advanced", commentsAdvancedRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/knowledge-base", knowledgeBaseRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
