import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "generating_script",
  "generating_voice",
  "generating_thumbnail",
  "assembling",
  "ready",
  "uploading",
  "uploaded",
  "failed",
]);

export const videoTypeEnum = pgEnum("video_type", ["short", "long"]);

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  script: text("script"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoTags: text("seo_tags"),
  status: videoStatusEnum("status").default("pending").notNull(),
  // short = ≤60 seconds (Shorts/Reels), long = 5+ minutes (full video)
  videoType: videoTypeEnum("video_type").default("short").notNull(),
  pipelineStep: text("pipeline_step"),
  errorMessage: text("error_message"),
  youtubeId: text("youtube_id"),
  youtubeUrl: text("youtube_url"),
  thumbnailPath: text("thumbnail_path"),
  audioPath: text("audio_path"),
  videoPath: text("video_path"),
  durationSeconds: integer("duration_seconds"),
  language: text("language").default("urdu"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
