import { Router } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { generateScript, type VideoType } from "../lib/ai.js";
import { generateVoice, generateVoiceLong } from "../lib/voice.js";
import {
  assembleVideo,
  generateThumbnail,
  getOutputDir,
} from "../lib/video.js";
import { getOrCreateSettings } from "./settings.js";

const router = Router();

const VIDEO_TYPES = ["short", "long"] as const;

const createVideoSchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(10).max(2000),
  videoType: z.enum(VIDEO_TYPES).optional(),
});

// Active pipelines set — prevents double-run and informs delete
const activePipelines = new Set<number>();

async function runPipeline(videoId: number): Promise<void> {
  if (activePipelines.has(videoId)) return;
  activePipelines.add(videoId);
  const outputDir = getOutputDir();

  try {
    const [videoRow] = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.id, videoId));
    if (!videoRow) throw new Error("Video not found");

    const settings = await getOrCreateSettings();
    const videoType = (videoRow.videoType ?? "short") as VideoType;

    // ── Step 1: Generate script ──────────────────────────────────────────
    await db
      .update(videosTable)
      .set({ status: "generating_script", updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));

    const script = await generateScript(
      videoRow.prompt,
      videoType,
      settings.huggingfaceModel,
    );

    await db
      .update(videosTable)
      .set({ scriptContent: script, updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));

    // ── Step 2: Generate voice ───────────────────────────────────────────
    await db
      .update(videosTable)
      .set({ status: "generating_voice", updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));

    const audioPath = path.join(outputDir, `video_${videoId}_audio.mp3`);

    if (videoType === "long") {
      await generateVoiceLong(script, settings.voiceId, audioPath);
    } else {
      await generateVoice(script, settings.voiceId, audioPath);
    }

    await db
      .update(videosTable)
      .set({ audioPath, updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));

    // ── Step 3: Assemble video ───────────────────────────────────────────
    await db
      .update(videosTable)
      .set({ status: "assembling_video", updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));

    const videoPath = path.join(outputDir, `video_${videoId}.mp4`);
    await assembleVideo(audioPath, script, videoType, videoPath);

    await db
      .update(videosTable)
      .set({ videoPath, updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));

    // ── Step 4: Thumbnail (non-fatal) ────────────────────────────────────
    const thumbnailPath = path.join(outputDir, `video_${videoId}_thumb.jpg`);
    try {
      await generateThumbnail(videoPath, thumbnailPath);
      await db
        .update(videosTable)
        .set({ thumbnailPath, updatedAt: new Date() })
        .where(eq(videosTable.id, videoId));
    } catch (thumbErr) {
      console.warn("Thumbnail generation failed (non-fatal):", thumbErr);
    }

    // ── Done ─────────────────────────────────────────────────────────────
    await db
      .update(videosTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(videosTable.id, videoId));
    console.error(`Pipeline failed for video ${videoId}:`, err);
  } finally {
    activePipelines.delete(videoId);
  }
}

// GET /videos
router.get("/videos", async (_req, res) => {
  try {
    const videos = await db
      .select()
      .from(videosTable)
      .orderBy(desc(videosTable.createdAt));
    res.json(videos);
  } catch (err) {
    console.error("Failed to list videos:", err);
    res.status(500).json({ error: "Failed to list videos" });
  }
});

// POST /videos
router.post("/videos", async (req, res) => {
  try {
    const parsed = createVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { title, prompt, videoType } = parsed.data;
    const settings = await getOrCreateSettings();
    const resolvedType = (videoType ?? settings.defaultVideoType ?? "short") as VideoType;

    const [video] = await db
      .insert(videosTable)
      .values({ title, prompt, videoType: resolvedType })
      .returning();

    res.status(201).json(video);

    // Run pipeline in background (non-blocking)
    setImmediate(() => {
      runPipeline(video!.id).catch((err) =>
        console.error("Unhandled pipeline error:", err),
      );
    });
  } catch (err) {
    console.error("Failed to create video:", err);
    res.status(500).json({ error: "Failed to create video" });
  }
});

// GET /videos/:id
router.get("/videos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "", 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [video] = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.id, id));

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    res.json(video);
  } catch (err) {
    console.error("Failed to get video:", err);
    res.status(500).json({ error: "Failed to get video" });
  }
});

// DELETE /videos/:id
router.delete("/videos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "", 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    if (activePipelines.has(id)) {
      res.status(409).json({
        error: "Video is currently being generated. Please wait until it completes or fails.",
      });
      return;
    }

    const [video] = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.id, id));

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    // Delete associated files
    for (const filePath of [video.audioPath, video.videoPath, video.thumbnailPath]) {
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    await db.delete(videosTable).where(eq(videosTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete video:", err);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

export default router;
