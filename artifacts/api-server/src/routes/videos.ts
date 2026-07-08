import { Router, type IRouter } from "express";
import { eq, SQL } from "drizzle-orm";
import { db, videosTable, projectsTable, settingsTable } from "@workspace/db";
import {
  CreateVideoBody,
  GetVideoParams,
  DeleteVideoParams,
  GenerateScriptParams,
  GenerateVoiceParams,
  GenerateThumbnailParams,
  GenerateSeoParams,
  AssembleVideoParams,
  UploadToYoutubeParams,
  RunFullPipelineParams,
  ListVideosQueryParams,
} from "@workspace/api-zod";
import {
  generateScriptWithAI,
  generateSEOWithAI,
  generateTTS,
  assembleFinalVideo,
  getSettings,
} from "../lib/ai";
import fs from "fs/promises";
import path from "path";

const router: IRouter = Router();

async function refreshProjectCounts(projectId: number) {
  const rows = await db.select().from(videosTable).where(eq(videosTable.projectId, projectId));
  const total = rows.length;
  const uploaded = rows.filter((v) => v.status === "uploaded").length;
  await db
    .update(projectsTable)
    .set({ videoCount: total, uploadedCount: uploaded })
    .where(eq(projectsTable.id, projectId));
}

router.get("/videos", async (req, res): Promise<void> => {
  if (Object.keys(req.query).length > 0) {
    const params = ListVideosQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const conditions: SQL[] = [];
    if (params.data.projectId) {
      conditions.push(eq(videosTable.projectId, params.data.projectId) as unknown as SQL);
    }
    if (params.data.status) {
      conditions.push(eq(videosTable.status, params.data.status as "pending") as unknown as SQL);
    }

    let videos;
    if (conditions.length === 0) {
      videos = await db.select().from(videosTable);
    } else if (conditions.length === 1) {
      videos = await db.select().from(videosTable).where(conditions[0]);
    } else {
      const { and } = await import("drizzle-orm");
      videos = await db.select().from(videosTable).where(and(...(conditions as [SQL, ...SQL[]])));
    }
    res.json(videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    return;
  }

  const videos = await db.select().from(videosTable);
  res.json(videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

router.post("/videos", async (req, res): Promise<void> => {
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [video] = await db.insert(videosTable).values(parsed.data).returning();
  await refreshProjectCounts(parsed.data.projectId);
  res.status(201).json(video);
});

router.get("/videos/:id", async (req, res): Promise<void> => {
  const params = GetVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(video);
});

router.delete("/videos/:id", async (req, res): Promise<void> => {
  const params = DeleteVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [video] = await db.delete(videosTable).where(eq(videosTable.id, params.data.id)).returning();
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  await refreshProjectCounts(video.projectId);
  res.sendStatus(204);
});

router.post("/videos/:id/generate-script", async (req, res): Promise<void> => {
  const params = GenerateScriptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }

  await db.update(videosTable).set({ status: "generating_script", pipelineStep: "script", updatedAt: new Date() }).where(eq(videosTable.id, video.id));

  try {
    const videoType = (video.videoType ?? "short") as "short" | "long";
    const script = await generateScriptWithAI(video.topic, video.language || "urdu", videoType);
    const [updated] = await db
      .update(videosTable)
      .set({ script, status: "pending", pipelineStep: null, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: `Script failed: ${msg}`, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.status(500).json(updated);
  }
});

router.post("/videos/:id/generate-seo", async (req, res): Promise<void> => {
  const params = GenerateSeoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }

  try {
    const seo = await generateSEOWithAI(video.topic, video.script || video.topic, video.language || "urdu");
    const [updated] = await db
      .update(videosTable)
      .set({ seoTitle: seo.title, seoDescription: seo.description, seoTags: seo.tags, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: `SEO failed: ${msg}`, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.status(500).json(updated);
  }
});

router.post("/videos/:id/generate-voice", async (req, res): Promise<void> => {
  const params = GenerateVoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }
  if (!video.script) { res.status(400).json({ error: "Script must be generated first" }); return; }

  const settings = await getSettings();
  const outputDir = settings.videosOutputDir || "/tmp/yt-automation";
  const audioPath = path.join(outputDir, `audio_${video.id}.mp3`);

  await db.update(videosTable).set({ status: "generating_voice", pipelineStep: "voice", updatedAt: new Date() }).where(eq(videosTable.id, video.id));

  try {
    await generateTTS(video.script, audioPath, video.language || "urdu");
    const [updated] = await db
      .update(videosTable)
      .set({ audioPath, status: "pending", pipelineStep: null, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: `Voice failed: ${msg}`, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.status(500).json(updated);
  }
});

router.post("/videos/:id/generate-thumbnail", async (req, res): Promise<void> => {
  const params = GenerateThumbnailParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }

  const settings = await getSettings();
  const outputDir = settings.videosOutputDir || "/tmp/yt-automation";
  const thumbnailPath = path.join(outputDir, `thumb_${video.id}.jpg`);

  await db.update(videosTable).set({ status: "generating_thumbnail", pipelineStep: "thumbnail", updatedAt: new Date() }).where(eq(videosTable.id, video.id));

  try {
    await fs.mkdir(outputDir, { recursive: true });
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    const safeTitle = (video.seoTitle || video.topic)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\u2019")
      .replace(/:/g, "\\:")
      .substring(0, 55);

    await execFileAsync("ffmpeg", [
      "-f", "lavfi",
      "-i", "color=c=0x0d1117:size=1280x720:rate=1",
      "-vframes", "1",
      "-filter_complex",
      [
        "[0:v]drawbox=x=0:y=0:w=1280:h=720:color=0x0d1117@1:t=fill[base]",
        "[base]drawbox=x=0:y=580:w=1280:h=140:color=0x161b22@0.95:t=fill[footer]",
        "[footer]drawbox=x=0:y=578:w=1280:h=3:color=0x58a6ff@0.9:t=fill[line]",
        `[line]drawtext=text='${safeTitle}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-40:shadowx=4:shadowy=4:shadowcolor=0x00000099[titled]`,
        "[titled]drawtext=text='AI Generated':fontcolor=0x58a6ff:fontsize=38:x=(w-text_w)/2:y=(h+text_h)/2+20[vout]",
      ].join(";"),
      "-y", thumbnailPath,
    ]);
    const [updated] = await db
      .update(videosTable)
      .set({ thumbnailPath, status: "pending", pipelineStep: null, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: `Thumbnail failed: ${msg}`, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.status(500).json(updated);
  }
});

router.post("/videos/:id/assemble", async (req, res): Promise<void> => {
  const params = AssembleVideoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }
  if (!video.audioPath) { res.status(400).json({ error: "Voice audio must be generated first" }); return; }

  const settings = await getSettings();
  const outputDir = settings.videosOutputDir || "/tmp/yt-automation";
  const videoPath = path.join(outputDir, `video_${video.id}.mp4`);

  await db.update(videosTable).set({ status: "assembling", pipelineStep: "assemble", updatedAt: new Date() }).where(eq(videosTable.id, video.id));

  try {
    const videoType = (video.videoType ?? "short") as "short" | "long";
    const duration = await assembleFinalVideo(video.audioPath, videoPath, video.topic, videoType);
    const [updated] = await db
      .update(videosTable)
      .set({ videoPath, durationSeconds: duration, status: "ready", pipelineStep: null, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: `Assembly failed: ${msg}`, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.status(500).json(updated);
  }
});

router.post("/videos/:id/upload", async (req, res): Promise<void> => {
  const params = UploadToYoutubeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }
  if (!video.videoPath) { res.status(400).json({ error: "Video must be assembled first" }); return; }

  const settings = await getSettings();
  if (!settings.youtubeApiKey) {
    res.status(400).json({ error: "YouTube API key not configured in Settings" });
    return;
  }

  await db.update(videosTable).set({ status: "uploading", pipelineStep: "upload", updatedAt: new Date() }).where(eq(videosTable.id, video.id));

  try {
    const FormData = (await import("form-data")).default;
    const fsSync = await import("fs");

    const metadata = {
      snippet: {
        title: video.seoTitle || video.topic,
        description: video.seoDescription || video.topic,
        tags: video.seoTags ? video.seoTags.split(",").map((t) => t.trim()) : [],
        categoryId: "22",
      },
      status: { privacyStatus: "public" },
    };

    const form = new FormData();
    form.append("metadata", JSON.stringify(metadata), { contentType: "application/json" });
    form.append("video", fsSync.createReadStream(video.videoPath), {
      filename: `video_${video.id}.mp4`,
      contentType: "video/mp4",
    });

    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status&key=${settings.youtubeApiKey}`,
      {
        method: "POST",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headers: form.getHeaders() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: form as any,
        signal: AbortSignal.timeout(300000),
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`YouTube API error: ${errText}`);
    }

    const ytData = (await uploadRes.json()) as { id: string };
    const youtubeId = ytData.id;
    const youtubeUrl = `https://youtube.com/watch?v=${youtubeId}`;

    const [updated] = await db
      .update(videosTable)
      .set({ youtubeId, youtubeUrl, status: "uploaded", pipelineStep: null, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();

    await refreshProjectCounts(video.projectId);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(videosTable)
      .set({ status: "failed", errorMessage: `Upload failed: ${msg}`, updatedAt: new Date() })
      .where(eq(videosTable.id, video.id))
      .returning();
    res.status(500).json(updated);
  }
});

router.post("/videos/:id/run-full-pipeline", async (req, res): Promise<void> => {
  const params = RunFullPipelineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id));
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }

  const [started] = await db
    .update(videosTable)
    .set({ status: "generating_script", pipelineStep: "script", errorMessage: null, updatedAt: new Date() })
    .where(eq(videosTable.id, video.id))
    .returning();

  const videoType = (video.videoType ?? "short") as "short" | "long";
  runPipeline(video.id, video.topic, video.language || "urdu", videoType).catch(() => {});
  res.json(started);
});

async function runPipeline(videoId: number, topic: string, language: string, videoType: "short" | "long") {
  const settings = await getSettings();
  const outputDir = settings.videosOutputDir || "/tmp/yt-automation";
  const audioPath = path.join(outputDir, `audio_${videoId}.mp3`);
  const videoPath = path.join(outputDir, `video_${videoId}.mp4`);
  const thumbnailPath = path.join(outputDir, `thumb_${videoId}.jpg`);

  const fail = async (msg: string) => {
    await db.update(videosTable).set({ status: "failed", errorMessage: msg, updatedAt: new Date() }).where(eq(videosTable.id, videoId));
  };

  try {
    // 1. Generate script (length depends on videoType)
    await db.update(videosTable).set({ status: "generating_script", pipelineStep: "script", updatedAt: new Date() }).where(eq(videosTable.id, videoId));
    const script = await generateScriptWithAI(topic, language, videoType);
    await db.update(videosTable).set({ script, updatedAt: new Date() }).where(eq(videosTable.id, videoId));

    // 2. Generate SEO metadata
    const seo = await generateSEOWithAI(topic, script, language);
    await db.update(videosTable).set({ seoTitle: seo.title, seoDescription: seo.description, seoTags: seo.tags, updatedAt: new Date() }).where(eq(videosTable.id, videoId));

    // 3. Generate voice over
    await db.update(videosTable).set({ status: "generating_voice", pipelineStep: "voice", updatedAt: new Date() }).where(eq(videosTable.id, videoId));
    await generateTTS(script, audioPath, language);
    await db.update(videosTable).set({ audioPath, updatedAt: new Date() }).where(eq(videosTable.id, videoId));

    // 4. Generate thumbnail
    await db.update(videosTable).set({ status: "generating_thumbnail", pipelineStep: "thumbnail", updatedAt: new Date() }).where(eq(videosTable.id, videoId));
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);
    await fs.mkdir(outputDir, { recursive: true });
    try {
      const safeTitle = (seo.title || topic)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\u2019")
        .replace(/:/g, "\\:")
        .substring(0, 55);
      await execFileAsync("ffmpeg", [
        "-f", "lavfi",
        "-i", "color=c=0x0d1117:size=1280x720:rate=1",
        "-vframes", "1",
        "-filter_complex",
        [
          "[0:v]drawbox=x=0:y=0:w=1280:h=720:color=0x0d1117@1:t=fill[base]",
          "[base]drawbox=x=0:y=580:w=1280:h=140:color=0x161b22@0.95:t=fill[footer]",
          "[footer]drawbox=x=0:y=578:w=1280:h=3:color=0x58a6ff@0.9:t=fill[line]",
          `[line]drawtext=text='${safeTitle}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-40:shadowx=4:shadowy=4:shadowcolor=0x00000099[titled]`,
          "[titled]drawtext=text='AI Generated':fontcolor=0x58a6ff:fontsize=38:x=(w-text_w)/2:y=(h+text_h)/2+20[vout]",
        ].join(";"),
        "-y", thumbnailPath,
      ]);
    } catch { /* thumbnail is optional — pipeline continues */ }
    await db.update(videosTable).set({ thumbnailPath, updatedAt: new Date() }).where(eq(videosTable.id, videoId));

    // 5. Assemble final video with animated visuals
    await db.update(videosTable).set({ status: "assembling", pipelineStep: "assemble", updatedAt: new Date() }).where(eq(videosTable.id, videoId));
    const duration = await assembleFinalVideo(audioPath, videoPath, topic, videoType);
    await db.update(videosTable).set({ videoPath, durationSeconds: duration, status: "ready", pipelineStep: null, updatedAt: new Date() }).where(eq(videosTable.id, videoId));

    // 6. Auto-upload if configured
    if (settings.autoUpload && settings.youtubeApiKey) {
      // auto-upload handled via upload endpoint
    }

    const [vid] = await db.select().from(videosTable).where(eq(videosTable.id, videoId));
    if (vid) await refreshProjectCounts(vid.projectId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await fail(msg);
  }
}

export default router;
