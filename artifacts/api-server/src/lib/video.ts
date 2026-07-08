import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

export type VideoType = "short" | "long";

const OUTPUT_DIR = path.join(process.cwd(), "output");

export function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

export function getOutputDir(): string {
  ensureOutputDir();
  return OUTPUT_DIR;
}

/**
 * Get audio duration in seconds using ffprobe
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseFloat(stdout.trim()) || 30;
}

/**
 * Assemble final video from audio + generated visuals
 */
export async function assembleVideo(
  audioPath: string,
  scriptContent: string,
  videoType: VideoType,
  outputPath: string,
): Promise<void> {
  const duration = await getAudioDuration(audioPath);

  if (videoType === "short") {
    await assembleShortVideo(audioPath, scriptContent, duration, outputPath);
  } else {
    await assembleLongVideo(audioPath, scriptContent, duration, outputPath);
  }
}

/**
 * Short video: 1080x1920 vertical (YouTube Shorts / Reels)
 * Purple gradient background with animated text
 */
async function assembleShortVideo(
  audioPath: string,
  scriptContent: string,
  duration: number,
  outputPath: string,
): Promise<void> {
  // Split script into chunks for display
  const words = scriptContent.split(" ");
  const chunkSize = 8;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  const safeText = (chunks[0] ?? scriptContent)
    .substring(0, 60)
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");

  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x1a0533:size=1080x1920:duration=${duration}`,
    "-i", audioPath,
    "-filter_complex",
    [
      // Gradient overlay
      "[0:v]",
      `drawbox=x=0:y=0:w=1080:h=1920:color=0x6c2bd9@0.3:t=fill,`,
      // Top accent line
      `drawbox=x=80:y=200:w=920:h=8:color=0xffffff@0.9:t=fill,`,
      // Main text
      `drawtext=text='${safeText}':`,
      `fontsize=52:fontcolor=white:`,
      `x=(w-text_w)/2:y=(h-text_h)/2:`,
      `shadowcolor=black@0.6:shadowx=3:shadowy=3:`,
      `enable='between(t,0.5,${duration})',`,
      // Bottom accent line
      `drawbox=x=80:y=1710:w=920:h=8:color=0xffffff@0.9:t=fill,`,
      // Branding
      `drawtext=text='AI Generated':`,
      `fontsize=32:fontcolor=white@0.7:`,
      `x=(w-text_w)/2:y=1740`,
    ].join(""),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-movflags", "+faststart",
    outputPath,
  ]);
}

/**
 * Long video: 1920x1080 horizontal (standard YouTube)
 * Dark theme with progress bar
 */
async function assembleLongVideo(
  audioPath: string,
  scriptContent: string,
  duration: number,
  outputPath: string,
): Promise<void> {
  const safeText = scriptContent
    .substring(0, 80)
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");

  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x0d1117:size=1920x1080:duration=${duration}`,
    "-i", audioPath,
    "-filter_complex",
    [
      "[0:v]",
      // Top header bar
      `drawbox=x=0:y=0:w=1920:h=90:color=0x161b22:t=fill,`,
      // Left accent
      `drawbox=x=0:y=0:w=6:h=1080:color=0x58a6ff:t=fill,`,
      // Main text
      `drawtext=text='${safeText}':`,
      `fontsize=42:fontcolor=0xe6edf3:`,
      `x=80:y=(h-text_h)/2:`,
      `shadowcolor=black@0.5:shadowx=2:shadowy=2,`,
      // Progress bar background
      `drawbox=x=80:y=980:w=1760:h=12:color=0x21262d:t=fill,`,
      // Animated progress bar
      `drawbox=x=80:y=980:w='1760*t/${duration}':h=12:color=0x58a6ff:t=fill,`,
      // Branding
      `drawtext=text='AI Video Generator':`,
      `fontsize=28:fontcolor=0x58a6ff:`,
      `x=80:y=30`,
    ].join(""),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-movflags", "+faststart",
    outputPath,
  ]);
}

/**
 * Generate thumbnail image
 */
export async function generateThumbnail(
  videoPath: string,
  thumbnailPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-ss", "00:00:01",
    "-vframes", "1",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    thumbnailPath,
  ]);
}
