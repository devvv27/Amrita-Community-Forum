import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || null;

let poolConfig;
if (connectionString) {
  poolConfig = {
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  };
  console.log("Using DATABASE_URL for Postgres connection");
} else {
  // Fallback to individual PG_* env vars for local development
  poolConfig = {
    host: process.env.PGHOST || "localhost",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || "postgres",
    // Only include a password when one is explicitly set. Passing an empty
    // string can cause SCRAM auth code to reject the client password type.
    ...(process.env.PGPASSWORD !== undefined && process.env.PGPASSWORD !== "" ? { password: String(process.env.PGPASSWORD) } : {}),
    database: process.env.PGDATABASE || "postgres",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  };
  console.log("Using individual PG_* env vars for Postgres connection");
}

export const pool = new Pool(poolConfig);

// Simple connectivity check
pool
  .query("SELECT NOW()")
  .then(() => console.log("✅ Database Connected"))
  .catch((err) => console.error("❌ DB Error:", err.message));