import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function ensureSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length === 0) {
    const [created] = await db.insert(settingsTable).values({}).returning();
    return created!;
  }
  return rows[0]!;
}

function maskSettings(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    ollamaUrl: s.ollamaUrl,
    ollamaModel: s.ollamaModel,
    ttsEngine: s.ttsEngine,
    youtubeApiKeySet: !!s.youtubeApiKey,
    youtubeChannelId: s.youtubeChannelId,
    defaultLanguage: s.defaultLanguage,
    autoUpload: s.autoUpload,
    videosOutputDir: s.videosOutputDir,
  };
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await ensureSettings();
  res.json(maskSettings(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await ensureSettings();
  const [updated] = await db
    .update(settingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(settingsTable.id, settings.id))
    .returning();
  res.json(maskSettings(updated ?? settings));
});

export default router;
