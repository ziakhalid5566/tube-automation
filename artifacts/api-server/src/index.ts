import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Ensure required DB enums and tables exist.
 * Idempotent — safe to run on every startup.
 * Runs after the server starts listening so health checks pass immediately.
 */
async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE video_type AS ENUM ('short', 'long');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE video_status AS ENUM (
          'pending', 'generating_script', 'generating_voice',
          'assembling_video', 'completed', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS videos (
        id            SERIAL PRIMARY KEY,
        title         TEXT NOT NULL,
        prompt        TEXT NOT NULL,
        video_type    video_type NOT NULL DEFAULT 'short',
        status        video_status NOT NULL DEFAULT 'pending',
        script_content TEXT,
        audio_path    TEXT,
        video_path    TEXT,
        thumbnail_path TEXT,
        error_message TEXT,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        id                  INTEGER PRIMARY KEY DEFAULT 1,
        huggingface_model   TEXT NOT NULL DEFAULT 'meta-llama/Llama-3.1-8B-Instruct',
        default_video_type  TEXT NOT NULL DEFAULT 'short',
        voice_id            TEXT NOT NULL DEFAULT 'en-US-AriaNeural'
      );
    `);
    logger.info("DB migrations applied successfully");
  } finally {
    client.release();
  }
}

// Start listening first so health checks pass, then run migrations
app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run migrations after server is up — errors are logged but don't crash the process
  runMigrations().catch((migErr) => {
    logger.error({ err: migErr }, "DB migration failed — endpoints may return errors until resolved");
  });
});
