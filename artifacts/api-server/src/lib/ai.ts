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

export async function callOllama(prompt: string, model?: string): Promise<string> {
  const settings = await getSettings();
  const ollamaUrl = settings.ollamaUrl || "http://localhost:11434";
  const ollamaModel = model || settings.ollamaModel || "llama3";

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { response: string };
  return data.response?.trim() || "";
}

export async function checkOllama(): Promise<{ available: boolean; models: string[] }> {
  const settings = await getSettings();
  const ollamaUrl = settings.ollamaUrl || "http://localhost:11434";
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { available: false, models: [] };
    const data = (await response.json()) as { models: { name: string }[] };
    const models = (data.models || []).map((m) => m.name);
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

export async function generateScriptWithAI(topic: string, language: string): Promise<string> {
  const lang = language || "urdu";
  const prompt = `Write a YouTube video script about: "${topic}"
Language: ${lang}
Requirements:
- Engaging introduction (hook the viewer)
- 3-5 main points with detailed explanations
- Call to action at the end (like and subscribe)
- Natural, conversational tone
- 300-500 words
Return ONLY the script text, no extra formatting.`;

  return callOllama(prompt);
}

export async function generateSEOWithAI(
  topic: string,
  script: string,
  language: string
): Promise<{ title: string; description: string; tags: string }> {
  const lang = language || "urdu";

  const titlePrompt = `Generate a catchy YouTube video title for topic: "${topic}" in ${lang}. 
Return ONLY the title, nothing else. Max 70 characters.`;

  const descPrompt = `Generate a YouTube video description for topic: "${topic}" in ${lang}.
Script summary: ${script.substring(0, 300)}...
Return ONLY the description (150-300 words). Include relevant keywords naturally.`;

  const tagsPrompt = `Generate 10-15 YouTube tags for topic: "${topic}" in ${lang}.
Return ONLY comma-separated tags, nothing else.`;

  const [title, description, tags] = await Promise.all([
    callOllama(titlePrompt),
    callOllama(descPrompt),
    callOllama(tagsPrompt),
  ]);

  return { title, description, tags };
}

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
    const pythonScript = `
import pyttsx3
engine = pyttsx3.init()
engine.save_to_file("""${text.replace(/"/g, '\\"')}""", "${outputPath}")
engine.runAndWait()
`;
    await execFileAsync("python3", ["-c", pythonScript]);
  } else {
    await execFileAsync("ffmpeg", [
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=3",
      "-y", outputPath,
    ]);
  }
}

export async function assembleFinalVideo(
  audioPath: string,
  outputPath: string,
  topic: string
): Promise<number> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const ffmpegArgs = [
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
  ];

  await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 120000 });

  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    outputPath,
  ]);
  return Math.round(parseFloat(stdout.trim()) || 0);
}
