import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  // Ollama (local)
  ollamaUrl: text("ollama_url").default("http://localhost:11434").notNull(),
  ollamaModel: text("ollama_model").default("llama3").notNull(),
  // AI provider: "ollama" | "huggingface"
  aiProvider: text("ai_provider").default("ollama").notNull(),
  // HuggingFace
  huggingfaceApiKey: text("huggingface_api_key"),
  huggingfaceModel: text("huggingface_model").default("mistralai/Mistral-7B-Instruct-v0.3").notNull(),
  // TTS
  ttsEngine: text("tts_engine").default("edge-tts").notNull(),
  // YouTube
  youtubeApiKey: text("youtube_api_key"),
  youtubeChannelId: text("youtube_channel_id"),
  // General
  defaultLanguage: text("default_language").default("urdu").notNull(),
  autoUpload: boolean("auto_upload").default(false).notNull(),
  videosOutputDir: text("videos_output_dir").default("/tmp/yt-automation").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
