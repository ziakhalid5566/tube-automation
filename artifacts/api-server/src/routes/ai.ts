import { Router, type IRouter } from "express";
import { checkOllama, checkHuggingFace, getSettings } from "../lib/ai";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

router.get("/ai/check", async (_req, res): Promise<void> => {
  const settings = await getSettings();

  const [ollamaResult, hfResult] = await Promise.all([
    checkOllama(),
    checkHuggingFace(),
  ]);

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
    huggingfaceAvailable: hfResult.available,
    huggingfaceModel: hfResult.model,
    huggingfaceKeySource: hfResult.keySource,
    ttsAvailable,
    ttsEngine,
  });
});

export default router;
