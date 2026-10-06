const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function runMigrations() {
  const isLocalhost =
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("localhost") ||
    process.env.DATABASE_URL.includes("127.0.0.1");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    const appliedResult = await client.query(
      "SELECT filename FROM schema_migrations"
    );
    const appliedFiles = new Set(appliedResult.rows.map((row) => row.filename));

    const migrationsDir = path.resolve(process.cwd(), "db/migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`Skipped: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, now())",
          [file]
        );
        await client.query("COMMIT");
        console.log(`Applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`Error applying ${file}:`, err);
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
