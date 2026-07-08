import {
  pgTable,
  serial,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videoTypeEnum = pgEnum("video_type", ["short", "long"]);

export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "generating_script",
  "generating_voice",
  "assembling_video",
  "completed",
  "failed",
]);

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  videoType: videoTypeEnum("video_type").notNull().default("short"),
  status: videoStatusEnum("status").notNull().default("pending"),
  scriptContent: text("script_content"),
  audioPath: text("audio_path"),
  videoPath: text("video_path"),
  thumbnailPath: text("thumbnail_path"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({
  id: true,
  status: true,
  scriptContent: true,
  audioPath: true,
  videoPath: true,
  thumbnailPath: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
