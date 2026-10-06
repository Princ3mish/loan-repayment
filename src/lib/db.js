import { Pool, types } from "pg";

types.setTypeParser(20, (val) => parseInt(val, 10));
types.setTypeParser(1082, (val) => val);

const isLocalhost =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("localhost") ||
  process.env.DATABASE_URL.includes("127.0.0.1");

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: false } }),
};

const pool = globalThis.pgPool || new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalThis.pgPool = pool;
}

export { pool };

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
