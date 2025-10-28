import { query } from "./db";
import { Call, CallPayload, CallStatusEnums } from "../types/calls.type";

export const callQueries = {
  async create(payload: CallPayload): Promise<Call> {
    const result = await query(
      `INSERT INTO calls (payload, status, attempts)
        VALUES($1, 'PENDING', 0)
        RETURNING *`,
      [JSON.stringify(payload)]
    );
    return this.mapRow(result.rows[0]);
  },

  async getById(id: string): Promise<Call | null> {
    const result = await query(`SELECT * FROM calls where id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  },

  async updateStatus(
    id: string,
    status: string,
    error?: string
  ): Promise<Call> {
    const result = await query(
      `UPDATE calls
        SET status = $1,
            last_error = $2,
            ended_at = CASE WHEN $4 IN ('COMPLETED', 'FAILED') THEN NOW() ELSE ended_at END
        WHERE id = $3
        RETURNING *`,
      [status, error || null, id, status]
    );
    return this.mapRow(result.rows[0]);
  },

  mapRow(row: any): Call {
    return {
      id: row.id,
      payload: row.payload,
      status: row.status,
      attempts: row.attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      externalCallId: row.external_call_id,
    };
  },
  // Fetch and lock a pending call (for worker)
  async fetchAndLock(): Promise<Call | null> {
    const result = await query(
      `UPDATE calls
       SET status = 'IN_PROGRESS', started_at = NOW()
       WHERE id = (
         SELECT id FROM calls
         WHERE status = 'PENDING'
         ORDER BY created_at
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  },

  async listByStatus(
    status: CallStatusEnums,
    limit = 10,
    offset = 0
  ): Promise<Call[]> {
    const result = await query(
      `SELECT * FROM calls 
       WHERE status = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return result.rows.map((row) => this.mapRow(row));
  },

  async getMetrics() {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM calls
       GROUP BY status`
    );

    const metrics: Record<string, number> = {};
    result.rows.forEach((row) => {
      metrics[row.status] = parseInt(row.count);
    });

    return metrics;
  },

  async updateExternalCallId(
    id: string,
    externalCallId: string
  ): Promise<void> {
    await query("UPDATE calls SET external_call_id = $1 WHERE id = $2", [
      externalCallId,
      id,
    ]);
  },

  async getByExternalId(externalCallId: string): Promise<Call | null> {
    const result = await query(
      "SELECT * FROM calls WHERE external_call_id = $1",
      [externalCallId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  },

  async incrementAttempts(id: string): Promise<void> {
    await query("UPDATE calls SET attempts = attempts + 1 WHERE id = $1", [id]);
  },
};
