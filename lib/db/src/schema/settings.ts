import { pgTable, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  // Fixed id = 1 enforces singleton row
  id: integer("id").primaryKey().default(1),
  huggingfaceModel: text("huggingface_model")
    .notNull()
    .default("meta-llama/Llama-3.1-8B-Instruct"),
  defaultVideoType: text("default_video_type").notNull().default("short"),
  voiceId: text("voice_id").notNull().default("en-US-AriaNeural"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
