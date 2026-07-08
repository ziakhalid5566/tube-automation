import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const VIDEO_TYPES = ["short", "long"] as const;

const settingsUpdateSchema = z.object({
  huggingfaceModel: z.string().min(1).optional(),
  defaultVideoType: z.enum(VIDEO_TYPES).optional(),
  voiceId: z.string().min(1).optional(),
});

async function getOrCreateSettings() {
  // Upsert singleton row (id = 1)
  await db
    .insert(settingsTable)
    .values({ id: 1 })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 1));

  return row!;
}

// GET /settings
router.get("/settings", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Failed to retrieve settings" });
  }
});

// PUT /settings
router.put("/settings", async (req, res) => {
  try {
    const parsed = settingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      const settings = await getOrCreateSettings();
      res.json(settings);
      return;
    }

    // Ensure singleton exists first
    await getOrCreateSettings();

    const [updated] = await db
      .update(settingsTable)
      .set(updates)
      .where(eq(settingsTable.id, 1))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export { getOrCreateSettings };
export default router;
