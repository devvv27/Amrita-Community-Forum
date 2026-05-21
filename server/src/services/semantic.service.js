import { pool } from "../config/db.js";
import { embedText } from "../lib/embeddings.service.js";

function isVectorSchemaUnavailable(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "42704" ||
    /engineering_knowledge/i.test(error?.message || "") ||
    /vector/i.test(error?.message || "")
  );
}

export async function indexKnowledgeItem({ source_type, source_id = null, title = null, content, tags = [], deployment_platform = null, framework = null, metadata = {} }) {
  if (!content) throw new Error("content is required");

  const embedding = process.env.OPENAI_API_KEY ? await embedText(content) : null;

  try {
    const result = await pool.query(
      `INSERT INTO engineering_knowledge (source_type, source_id, title, content, embedding, tags, deployment_platform, framework, metadata)
       VALUES ($1, $2, $3, $4, ${embedding ? `($5::real[])` : "NULL"}, $6, $7, $8, $9)
       RETURNING *`,
      embedding ? [source_type, source_id, title, content, embedding, tags, deployment_platform, framework, JSON.stringify(metadata)] : [source_type, source_id, title, content, tags, deployment_platform, framework, JSON.stringify(metadata)]
    );

    return result.rows[0];
  } catch (error) {
    if (isVectorSchemaUnavailable(error)) {
      return null;
    }

    throw error;
  }
}

export async function vectorSearch({ queryText, limit = 6, platform = null, framework = null }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set for vector search");
  }

  const qEmbedding = await embedText(queryText);
  if (!qEmbedding) return [];

  const filters = [];
  const params = [qEmbedding, limit];

  let whereClause = "";
  if (platform) {
    params.push(platform);
    filters.push(`deployment_platform = $${params.length}`);
  }
  if (framework) {
    params.push(framework);
    filters.push(`framework = $${params.length}`);
  }

  if (filters.length) {
    whereClause = `WHERE ${filters.join(" AND ")}`;
  }

  const sql = `SELECT id, source_type, source_id, title, content, tags, deployment_platform, framework, metadata, created_at,
    1 - (embedding <#> $1::real[]) AS similarity
    FROM engineering_knowledge
    ${whereClause}
    ORDER BY embedding <#> $1::real[] ASC
    LIMIT $2`;

  try {
    const result = await pool.query(sql, params);
    return result.rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
  } catch (error) {
    if (isVectorSchemaUnavailable(error)) {
      return [];
    }

    throw error;
  }
}

export default { indexKnowledgeItem, vectorSearch };
