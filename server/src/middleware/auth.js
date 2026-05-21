import jwt from "jsonwebtoken";
import { pool as db } from "../config/db.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    db.query("SELECT is_admin FROM users WHERE id = $1", [payload.id])
      .then((result) => {
        req.user.isAdmin = result.rows.length > 0 ? result.rows[0].is_admin : false;
        return next();
      })
      .catch(() => {
        req.user.isAdmin = false;
        return next();
      });
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}
