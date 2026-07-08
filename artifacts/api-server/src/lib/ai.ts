import { db, settingsTable, videosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export async function getSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length === 0) {
    const [created] = await db.insert(settingsTable).values({}).returning();
    return created!;
  }
  return rows[0]!;
}

// ── Ollama ────────────────────────────────────────────────────────────────────

export async function callOllama(prompt: string, model?: string): Promise<string> {
  const settings = await getSettings();
  const ollamaUrl = settings.ollamaUrl || "http://localhost:11434";
  const ollamaModel = model || settings.ollamaModel || "llama3";

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  const data = (await response.json()) as { response: string };
  return data.response?.trim() || "";
}

export async function checkOllama(): Promise<{ available: boolean; models: string[] }> {
  const settings = await getSettings();
  const ollamaUrl = settings.ollamaUrl || "http://localhost:11434";
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { available: false, models: [] };
    const data = (await response.json()) as { models: { name: string }[] };
    return { available: true, models: (data.models || []).map((m) => m.name) };
  } catch {
    return { available: false, models: [] };
  }
}

// ── HuggingFace Inference API ─────────────────────────────────────────────────

/**
 * Resolve HF API key (priority order):
 *   1. DB setting (user explicitly saved a key)
 *   2. HUGGINGFACE_API_KEY env var (hf_xxx inference token)
 *   3. HF_ACCESS_KEY_ID env var (S3 access key — kept as last resort)
 */
function resolveHfApiKey(settingsKey: string | null | undefined): string | null {
  return settingsKey || process.env.HUGGINGFACE_API_KEY || process.env.HF_ACCESS_KEY_ID || null;
}

export async function callHuggingFace(prompt: string, model?: string): Promise<string> {
  const settings = await getSettings();
  const apiKey = resolveHfApiKey(settings.huggingfaceApiKey);
  if (!apiKey) throw new Error("HuggingFace API key not set — add it in Settings or set HF_ACCESS_KEY_ID env var");

  const hfModel = model || settings.huggingfaceModel || "meta-llama/Llama-3.1-8B-Instruct";

  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hfModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(180000),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HuggingFace error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function checkHuggingFace(): Promise<{ available: boolean; model: string; keySource: "db" | "env" | "none" }> {
  const settings = await getSettings();
  const dbKey = settings.huggingfaceApiKey;
  const apiKey = resolveHfApiKey(dbKey);
  const keySource = dbKey ? "db" : apiKey ? "env" : "none";
  if (!apiKey) return { available: false, model: "", keySource: "none" };
  try {
    const r = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { available: r.ok, model: settings.huggingfaceModel || "", keySource };
  } catch {
    return { available: false, model: settings.huggingfaceModel || "", keySource };
  }
}

// ── Unified AI caller — uses whichever provider is configured ─────────────────

export async function callAI(prompt: string): Promise<string> {
  const settings = await getSettings();
  if (settings.aiProvider === "huggingface") {
    return callHuggingFace(prompt);
  }
  return callOllama(prompt);
}

// ── Script / SEO generators ───────────────────────────────────────────────────

/**
 * Generate a video script from a user's short topic/prompt.
 * - short: ~150 words → ~60 seconds of speech (YouTube Shorts / Reels)
 * - long:  ~1000-1200 words → ~5-8 minutes of speech (full YouTube video)
 */
export async function generateScriptWithAI(
  topic: string,
  language: string,
  videoType: "short" | "long" = "short"
): Promise<string> {
  const lang = language || "urdu";

  if (videoType === "short") {
    const prompt = `You are a YouTube Shorts / Reels script writer.
Topic/Prompt: "${topic}"
Language: ${lang}

Write a SHORT video script (exactly 60 seconds when read aloud, approximately 130-160 words).
Rules:
- Start with a powerful 1-sentence hook that grabs attention immediately
- Cover the core idea in 3-4 punchy sentences
- End with a strong call-to-action (like, follow, share)
- Conversational tone, no filler words
- Return ONLY the script text, no labels, no formatting marks`;
    return callAI(prompt);
  }

  // Long video: 5+ minutes
  const prompt = `You are a professional YouTube video script writer.
Topic/Prompt: "${topic}"
Language: ${lang}

Write a DETAILED YouTube video script (5-8 minutes when read aloud, approximately 1000-1200 words).
Structure:
1. Hook (first 15 seconds — make viewers unable to leave)
2. Introduction — briefly introduce yourself and what the video covers
3. Main Section 1 — first key point with examples/details
4. Main Section 2 — second key point with examples/details
5. Main Section 3 — third key point with examples/details
6. Main Section 4 — fourth key point with examples/details (if needed)
7. Summary — recap the key takeaways
8. Call to Action — ask viewers to like, comment, subscribe, and share

Rules:
- Natural, conversational tone throughout
- Use real examples, statistics, or stories where relevant
- Engaging transitions between sections
- Return ONLY the script text, no labels, no section headers, no formatting marks`;
  return callAI(prompt);
}

export async function generateSEOWithAI(
  topic: string,
  script: string,
  language: string
): Promise<{ title: string; description: string; tags: string }> {
  const lang = language || "urdu";

  const [title, description, tags] = await Promise.all([
    callAI(
      `Generate a catchy YouTube video title for topic: "${topic}" in ${lang}.\nReturn ONLY the title, nothing else. Max 70 characters.`
    ),
    callAI(
      `Generate a YouTube video description for topic: "${topic}" in ${lang}.\nScript summary: ${script.substring(0, 300)}...\nReturn ONLY the description (150-300 words). Include relevant keywords naturally.`
    ),
    callAI(
      `Generate 10-15 YouTube tags for topic: "${topic}" in ${lang}.\nReturn ONLY comma-separated tags, nothing else.`
    ),
  ]);

  return { title, description, tags };
}

// ── TTS ───────────────────────────────────────────────────────────────────────

export async function generateTTS(text: string, outputPath: string, language: string): Promise<void> {
  const settings = await getSettings();
  const ttsEngine = settings.ttsEngine || "edge-tts";
  const lang = language || "urdu";

  const voiceMap: Record<string, string> = {
    urdu: "ur-PK-AsadNeural",
    english: "en-US-AriaNeural",
    hindi: "hi-IN-SwaraNeural",
    arabic: "ar-SA-ZariyahNeural",
  };
  const voice = voiceMap[lang.toLowerCase()] || "ur-PK-AsadNeural";

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (ttsEngine === "edge-tts") {
    await execFileAsync("edge-tts", ["--voice", voice, "--text", text, "--write-media", outputPath]);
  } else if (ttsEngine === "pyttsx3") {
    const py = `
import pyttsx3
engine = pyttsx3.init()
engine.save_to_file("""${text.replace(/"/g, '\\"')}""", "${outputPath}")
engine.runAndWait()
`;
    await execFileAsync("python3", ["-c", py]);
  } else {
    // Fallback silent audio so pipeline doesn't hard-fail
    await execFileAsync("ffmpeg", [
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-y", outputPath,
    ]);
  }
}

// ── FFmpeg video assembly ─────────────────────────────────────────────────────

/**
 * Assemble final video with animated visuals.
 *
 * Short video (≤60s):  vertical 1080×1920 for YouTube Shorts / Reels
 * Long video (5+ min): horizontal 1920×1080 for standard YouTube
 *
 * Visual design:
 *  - Deep gradient background (dark navy → deep purple)
 *  - Title text centered with fade-in + drop shadow
 *  - Subtle "typing" progress bar at bottom (short) or section counter (long)
 *  - Smooth fade-in / fade-out transitions
 */
export async function assembleFinalVideo(
  audioPath: string,
  outputPath: string,
  topic: string,
  videoType: "short" | "long" = "short"
): Promise<number> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // Sanitize topic for FFmpeg drawtext (escape special chars)
  const safeTitle = topic
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .substring(0, 55);

  if (videoType === "short") {
    // ── Short: 1080×1920 vertical (Shorts/Reels format) ──────────────────────
    await execFileAsync("ffmpeg", [
      // Background: dark gradient via color + overlay
      "-f", "lavfi",
      "-i", "color=c=0x0f0c29:size=1080x1920:rate=30",
      // Audio input
      "-i", audioPath,
      "-filter_complex",
      [
        // Gradient overlay: bottom purple glow
        "[0:v]drawbox=x=0:y=1400:w=1080:h=520:color=0x6b2fa0@0.6:t=fill[bg]",
        // Accent line
        "[bg]drawbox=x=80:y=1380:w=920:h=4:color=0xa855f7@0.9:t=fill[accented]",
        // Main title — large, centered, white with shadow
        `[accented]drawtext=text='${safeTitle}':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=800:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='if(lt(t,0.8),t/0.8,1)'[titled]`,
        // Subtitle: "AI Generated"
        "[titled]drawtext=text='AI Generated':fontcolor=0xa855f7:fontsize=38:x=(w-text_w)/2:y=920:alpha='if(lt(t,1.2),max(0,(t-0.4)/0.8),1)'[subtitled]",
        // Bottom call-to-action bar
        "[subtitled]drawbox=x=0:y=1780:w=1080:h=140:color=0x1a0533@0.85:t=fill[cta_bg]",
        "[cta_bg]drawtext=text='Like & Follow':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=1822:alpha='if(lt(t,1.5),max(0,(t-0.8)/0.7),1)'[vout]",
      ].join(";"),
      "-map", "[vout]",
      "-map", "1:a",
      "-shortest",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ], { timeout: 300000 });
  } else {
    // ── Long: 1920×1080 horizontal (standard YouTube) ─────────────────────────
    await execFileAsync("ffmpeg", [
      "-f", "lavfi",
      "-i", "color=c=0x0d1117:size=1920x1080:rate=30",
      "-i", audioPath,
      "-filter_complex",
      [
        // Top header band
        "[0:v]drawbox=x=0:y=0:w=1920:h=120:color=0x161b22@0.95:t=fill[header]",
        // Bottom footer band
        "[header]drawbox=x=0:y=960:w=1920:h=120:color=0x161b22@0.95:t=fill[footer]",
        // Accent line top
        "[footer]drawbox=x=0:y=118:w=1920:h=3:color=0x58a6ff@0.9:t=fill[topline]",
        // Accent line bottom
        "[topline]drawbox=x=0:y=960:w=1920:h=3:color=0x58a6ff@0.9:t=fill[bottomline]",
        // Channel/brand watermark top-left
        "[bottomline]drawtext=text='AI Video':fontcolor=0x58a6ff:fontsize=44:x=40:y=38:alpha=0.9[watermark]",
        // Main title — large, centered
        `[watermark]drawtext=text='${safeTitle}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2-60:shadowx=5:shadowy=5:shadowcolor=0x00000099:alpha='if(lt(t,1.0),t/1.0,1)'[titled]`,
        // Subtitle line
        "[titled]drawtext=text='AI Generated Video':fontcolor=0x8b949e:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2+50:alpha='if(lt(t,1.5),max(0,(t-0.5)/1.0),1)'[subtitled]",
        // Progress bar background
        "[subtitled]drawbox=x=200:y=1010:w=1520:h=20:color=0x21262d@1:t=fill[progbg]",
        // Progress bar fill (animates with time)
        "[progbg]drawbox=x=200:y=1010:w='min(1520,1520*t/max(1,60))':h=20:color=0x58a6ff@0.85:t=fill[vout]",
      ].join(";"),
      "-map", "[vout]",
      "-map", "1:a",
      "-shortest",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ], { timeout: 600000 });
  }

  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    outputPath,
  ]);
  return Math.round(parseFloat(stdout.trim()) || 0);
}
