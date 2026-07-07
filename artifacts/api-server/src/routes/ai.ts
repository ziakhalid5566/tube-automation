import { Router, type IRouter } from "express";
import { checkOllama, getSettings } from "../lib/ai";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const router: IRouter = Router();

router.get("/ai/check", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  const ollamaResult = await checkOllama();

  // Check TTS availability
  let ttsAvailable = false;
  const ttsEngine = settings.ttsEngine || "edge-tts";
  try {
    if (ttsEngine === "edge-tts") {
      await execFileAsync("edge-tts", ["--list-voices"], { timeout: 5000 });
      ttsAvailable = true;
    } else if (ttsEngine === "pyttsx3") {
      await execFileAsync("python3", ["-c", "import pyttsx3"], { timeout: 5000 });
      ttsAvailable = true;
    } else {
      // ffmpeg always available as fallback
      await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
      ttsAvailable = true;
    }
  } catch {
    ttsAvailable = false;
  }

  res.json({
    ollamaAvailable: ollamaResult.available,
    ollamaUrl: settings.ollamaUrl,
    models: ollamaResult.models,
    ttsAvailable,
    ttsEngine,
  });
});

export default router;
