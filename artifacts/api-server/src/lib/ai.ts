import { InferenceClient } from "@huggingface/inference";

const HF_API_KEY = process.env["HUGGINGFACE_API_KEY"];

function getClient(): InferenceClient {
  if (!HF_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
  }
  return new InferenceClient(HF_API_KEY);
}

export type VideoType = "short" | "long";

export async function generateScript(
  prompt: string,
  videoType: VideoType,
  model: string = "meta-llama/Llama-3.1-8B-Instruct",
): Promise<string> {
  const client = getClient();

  const wordTarget =
    videoType === "short"
      ? "100-150 words (about 45-60 seconds when spoken)"
      : "1000-1200 words (about 5-7 minutes when spoken)";

  const structureGuide =
    videoType === "short"
      ? `Structure:
- Hook (first 10 words must grab attention)
- 3-4 key points
- Strong call-to-action at the end`
      : `Structure:
- Hook: attention-grabbing opening
- Introduction: what this video covers
- Section 1: first main point with details
- Section 2: second main point with details
- Section 3: third main point with details
- Section 4: fourth main point with details
- Conclusion & Call-to-Action`;

  const systemPrompt = `You are a professional YouTube script writer. Write engaging, conversational scripts that sound natural when spoken aloud. Do not include stage directions, sound effects, or visual cues — only the spoken words.`;

  const userPrompt = `Write a YouTube ${videoType === "short" ? "Shorts" : "video"} script about: ${prompt}

Target length: ${wordTarget}
${structureGuide}

Write only the script text that will be spoken. No headers, no stage directions, no [brackets].`;

  let fullText = "";

  const stream = client.chatCompletionStream({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: videoType === "short" ? 300 : 2000,
    temperature: 0.7,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
    }
  }

  const script = fullText.trim();
  if (!script) {
    throw new Error("AI returned an empty script");
  }

  return script;
}
