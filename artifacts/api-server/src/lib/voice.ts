import { execFile } from "child_process";
import { promisify } from "util";
import { InferenceClient } from "@huggingface/inference";
import fs from "fs";

const execFileAsync = promisify(execFile);

const HF_API_KEY = process.env["HUGGINGFACE_API_KEY"];

/**
 * Generate voice audio from text.
 * Tries HuggingFace TTS first, then falls back to espeak.
 */
export async function generateVoice(
  text: string,
  _voiceId: string,
  outputPath: string,
): Promise<void> {
  try {
    await generateVoiceHuggingFace(text, outputPath);
  } catch (err) {
    console.warn("HuggingFace TTS failed, trying espeak fallback:", err);
    await generateVoiceEspeak(text, outputPath);
  }
}

async function generateVoiceHuggingFace(
  text: string,
  outputPath: string,
): Promise<void> {
  if (!HF_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY not set");
  }

  const client = new InferenceClient(HF_API_KEY);

  // SpeechT5 has a ~600-char input limit
  const audioBlob = await client.textToSpeech({
    model: "microsoft/speecht5_tts",
    inputs: text.substring(0, 600),
  });

  const arrayBuffer = await audioBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const flacPath = outputPath.replace(/\.[^.]+$/, ".flac");
  fs.writeFileSync(flacPath, buffer);

  // Convert FLAC → MP3
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", flacPath,
    "-codec:a", "libmp3lame",
    "-qscale:a", "2",
    outputPath,
  ]);

  try { fs.unlinkSync(flacPath); } catch {}
}

async function generateVoiceEspeak(
  text: string,
  outputPath: string,
): Promise<void> {
  const espeakBin = await findBinary("espeak-ng") ?? await findBinary("espeak");

  if (!espeakBin) {
    throw new Error("No TTS engine available — espeak/espeak-ng not found and HuggingFace TTS failed");
  }

  const wavPath = outputPath.replace(/\.[^.]+$/, ".wav");

  await execFileAsync(espeakBin, [
    "-w", wavPath,
    "-s", "150",
    "-p", "50",
    text.substring(0, 2000),
  ]);

  await execFileAsync("ffmpeg", [
    "-y",
    "-i", wavPath,
    "-codec:a", "libmp3lame",
    "-qscale:a", "2",
    outputPath,
  ]);

  try { fs.unlinkSync(wavPath); } catch {}
}

async function findBinary(name: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("which", [name]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * For long videos: split text into chunks, generate each separately, then concatenate.
 */
export async function generateVoiceLong(
  text: string,
  voiceId: string,
  outputPath: string,
): Promise<void> {
  const CHUNK_SIZE = 550;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_SIZE) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length <= 1) {
    return generateVoice(text, voiceId, outputPath);
  }

  const chunkPaths: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = outputPath.replace(/\.[^.]+$/, `_chunk${i}.mp3`);
    await generateVoice(chunks[i]!, voiceId, chunkPath);
    chunkPaths.push(chunkPath);
  }

  const listPath = outputPath.replace(/\.[^.]+$/, "_list.txt");
  fs.writeFileSync(
    listPath,
    chunkPaths.map((p) => `file '${p}'`).join("\n"),
  );

  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c", "copy",
    outputPath,
  ]);

  for (const p of [...chunkPaths, listPath]) {
    try { fs.unlinkSync(p); } catch {}
  }
}
