import { pool } from '../src/config/db.js';

async function run() {
  console.log('Searching for proposals where solver_id = task.creator_id...');
  const res = await pool.query(
    `SELECT p.id AS proposal_id, p.task_id, p.solver_id
     FROM proposals p
     JOIN tasks t ON t.id = p.task_id
     WHERE p.solver_id = t.creator_id`
  );

  if (res.rowCount === 0) {
    console.log('No self-submitted proposals found.');
    process.exit(0);
  }

  for (const row of res.rows) {
    const { proposal_id, task_id, solver_id } = row;
    console.log(`Cleaning proposal ${proposal_id} on task ${task_id} by user ${solver_id}`);

    try {
      await pool.query('BEGIN');

      // delete message_reads for messages we'll remove
      await pool.query(
        `DELETE FROM message_reads mr USING messages m WHERE mr.message_id = m.id AND m.task_id = $1 AND m.sender_id = $2`,
        [task_id, solver_id]
      );

      // delete messages sent by that user on that task
      const delMsg = await pool.query(`DELETE FROM messages WHERE task_id = $1 AND sender_id = $2 RETURNING id`, [task_id, solver_id]);
      console.log(`Deleted ${delMsg.rowCount} messages`);

      // delete the proposal
      await pool.query(`DELETE FROM proposals WHERE id = $1`, [proposal_id]);
      console.log(`Deleted proposal ${proposal_id}`);

      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error('Failed to clean proposal', e.message);
    }
  }

  console.log('Cleanup complete.');
  process.exit(0);
}

run().catch((e) => {
  console.error('Cleanup script error:', e);
  process.exit(1);
});
