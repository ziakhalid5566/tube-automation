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
    signal: AbortSignal.timeout(120000),
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

export async function callHuggingFace(prompt: string, model?: string): Promise<string> {
  const settings = await getSettings();
  const apiKey = settings.huggingfaceApiKey;
  if (!apiKey) throw new Error("HuggingFace API key not set in Settings");

  const hfModel = model || settings.huggingfaceModel || "mistralai/Mistral-7B-Instruct-v0.3";

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${hfModel}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hfModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
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

export async function checkHuggingFace(): Promise<{ available: boolean; model: string }> {
  const settings = await getSettings();
  if (!settings.huggingfaceApiKey) return { available: false, model: "" };
  try {
    // Quick auth check
    const r = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${settings.huggingfaceApiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { available: r.ok, model: settings.huggingfaceModel || "" };
  } catch {
    return { available: false, model: settings.huggingfaceModel || "" };
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

export async function generateScriptWithAI(topic: string, language: string): Promise<string> {
  const lang = language || "urdu";
  const prompt = `Write a YouTube video script about: "${topic}"
Language: ${lang}
Requirements:
- Engaging introduction (hook the viewer in first 10 seconds)
- 3-5 main points with detailed explanations
- Real examples or statistics where relevant
- Call to action at the end (like and subscribe)
- Natural, conversational tone
- 300-500 words
Return ONLY the script text, no extra formatting or labels.`;
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

// ── FFmpeg assembly ───────────────────────────────────────────────────────────

export async function assembleFinalVideo(
  audioPath: string,
  outputPath: string,
  topic: string
): Promise<number> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await execFileAsync("ffmpeg", [
    "-f", "lavfi",
    "-i", `color=c=0x1a1a2e:size=1280x720:rate=30`,
    "-i", audioPath,
    "-filter_complex",
    `[0:v]drawtext=text='${topic.replace(/'/g, "\\'")}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2[vout]`,
    "-map", "[vout]",
    "-map", "1:a",
    "-shortest",
    "-c:v", "libx264",
    "-c:a", "aac",
    "-y",
    outputPath,
  ], { timeout: 120000 });

  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    outputPath,
  ]);
  return Math.round(parseFloat(stdout.trim()) || 0);
}
