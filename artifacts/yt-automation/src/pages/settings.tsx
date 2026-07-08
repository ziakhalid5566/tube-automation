import { useState, useEffect } from "react";
import { 
  useGetSettings, 
  useUpdateSettings,
  useCheckAiStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, Cpu, Volume2, Youtube, Save, Activity, Zap } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { data: aiStatus } = useCheckAiStatus();

  const [formData, setFormData] = useState({
    aiProvider: "ollama",
    ollamaUrl: "",
    ollamaModel: "",
    huggingfaceApiKey: "",
    huggingfaceModel: "",
    ttsEngine: "",
    youtubeApiKey: "",
    youtubeChannelId: "",
    defaultLanguage: "urdu",
    videosOutputDir: "",
    autoUpload: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        aiProvider: settings.aiProvider || "ollama",
        ollamaUrl: settings.ollamaUrl || "",
        ollamaModel: settings.ollamaModel || "",
        huggingfaceApiKey: "",
        huggingfaceModel: settings.huggingfaceModel || "",
        ttsEngine: settings.ttsEngine || "edge-tts",
        youtubeApiKey: "",
        youtubeChannelId: settings.youtubeChannelId || "",
        defaultLanguage: settings.defaultLanguage || "urdu",
        videosOutputDir: settings.videosOutputDir || "/tmp/yt-automation",
        autoUpload: settings.autoUpload ?? false,
      }));
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only send non-empty keys (don't overwrite stored secrets with blank)
    const payload: Record<string, unknown> = { ...formData };
    if (!payload.huggingfaceApiKey) delete payload.huggingfaceApiKey;
    if (!payload.youtubeApiKey) delete payload.youtubeApiKey;
    updateSettings.mutate({ data: payload });
  };

  const set = (key: string, val: unknown) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 w-full max-w-3xl bg-muted rounded-lg border border-border/50" />
          ))}
        </div>
      </div>
    );
  }

  const isOllama = formData.aiProvider === "ollama";
  const isHF = formData.aiProvider === "huggingface";

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            System Configuration
          </h1>
          <p className="text-muted-foreground mt-2">Configure AI providers, TTS engine, and YouTube credentials.</p>
        </div>
        <Button onClick={handleSubmit} disabled={updateSettings.isPending} className="gap-2">
          <Save className="w-4 h-4" />
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="space-y-6">

        {/* ── AI Provider selector ─────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
              <Zap className="w-5 h-5" /> AI Provider
            </CardTitle>
            <CardDescription>Choose which AI model powers script &amp; SEO generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {[
                { id: "ollama", label: "🖥️ Ollama (Local)", desc: "Runs on your machine, free, private" },
                { id: "huggingface", label: "🤗 HuggingFace", desc: "Cloud API — 1000s of open models" },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set("aiProvider", opt.id)}
                  className={`flex-1 rounded-lg border px-4 py-3 text-left transition-all ${
                    formData.aiProvider === opt.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 bg-background text-muted-foreground hover:border-border"
                  }`}
                >
                  <div className="font-display font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Ollama ───────────────────────────────────────────────── */}
        {isOllama && (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
                  <Cpu className="w-5 h-5" /> Local AI (Ollama)
                </CardTitle>
                {aiStatus?.ollamaAvailable ? (
                  <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Connected
                  </span>
                ) : (
                  <span className="text-xs font-mono bg-destructive/20 text-destructive px-2 py-1 rounded border border-destructive/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Offline
                  </span>
                )}
              </div>
              <CardDescription>
                Install Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-primary underline">ollama.com</a>, then run: <code className="font-mono text-xs bg-muted px-1 rounded">ollama pull llama3</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground font-mono">Endpoint URL</label>
                  <Input value={formData.ollamaUrl} onChange={e => set("ollamaUrl", e.target.value)}
                    placeholder="http://localhost:11434" className="font-mono bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground font-mono">Model Name</label>
                  <Input value={formData.ollamaModel} onChange={e => set("ollamaModel", e.target.value)}
                    placeholder="llama3" className="font-mono bg-background" />
                  {aiStatus?.models && aiStatus.models.length > 0 && (
                    <p className="text-xs text-accent mt-1">✓ Available: {aiStatus.models.join(", ")}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── HuggingFace ──────────────────────────────────────────── */}
        {isHF && (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
                  🤗 HuggingFace Inference API
                </CardTitle>
                {aiStatus?.huggingfaceAvailable ? (
                  <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Authenticated
                  </span>
                ) : (
                  <span className="text-xs font-mono bg-destructive/20 text-destructive px-2 py-1 rounded border border-destructive/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> {settings?.huggingfaceApiKeySet ? "Error" : "No Key"}
                  </span>
                )}
              </div>
              <CardDescription>
                Get your free API key from{" "}
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-primary underline">
                  huggingface.co/settings/tokens
                </a>
                . Thousands of open-source models available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground font-mono flex items-center gap-2">
                    API Key
                    {settings?.huggingfaceApiKeyFromEnv && (
                      <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-0.5 rounded border border-accent/30">
                        🔑 loaded from environment
                      </span>
                    )}
                    {settings?.huggingfaceApiKeySet && !settings?.huggingfaceApiKeyFromEnv && (
                      <span className="text-accent text-xs">(saved ✓)</span>
                    )}
                  </label>
                  <Input type="password" value={formData.huggingfaceApiKey}
                    onChange={e => set("huggingfaceApiKey", e.target.value)}
                    placeholder={
                      settings?.huggingfaceApiKeyFromEnv
                        ? "Using HF_ACCESS_KEY_ID env var (override by entering a new key)"
                        : settings?.huggingfaceApiKeySet
                          ? "••••••••••••••••••• (leave blank to keep)"
                          : "hf_xxxxxxxxxxxxxxxxxxxx or HFAKxxxxxxxxx"
                    }
                    className="font-mono bg-background text-xs" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground font-mono">Model ID</label>
                  <Input value={formData.huggingfaceModel} onChange={e => set("huggingfaceModel", e.target.value)}
                    placeholder="mistralai/Mistral-7B-Instruct-v0.3" className="font-mono bg-background text-xs" />
                  <p className="text-xs text-muted-foreground">
                    Popular: <span className="text-primary cursor-pointer" onClick={() => set("huggingfaceModel", "mistralai/Mistral-7B-Instruct-v0.3")}>Mistral-7B</span>
                    {" · "}<span className="text-primary cursor-pointer" onClick={() => set("huggingfaceModel", "meta-llama/Llama-3.1-8B-Instruct")}>Llama-3.1-8B</span>
                    {" · "}<span className="text-primary cursor-pointer" onClick={() => set("huggingfaceModel", "Qwen/Qwen2.5-7B-Instruct")}>Qwen2.5-7B</span>
                    {" · "}<span className="text-primary cursor-pointer" onClick={() => set("huggingfaceModel", "google/gemma-3-9b-it")}>Gemma-3-9B</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── TTS ─────────────────────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
                <Volume2 className="w-5 h-5" /> Text-to-Speech Engine
              </CardTitle>
              {aiStatus?.ttsAvailable ? (
                <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Ready
                </span>
              ) : (
                <span className="text-xs font-mono bg-destructive/20 text-destructive px-2 py-1 rounded border border-destructive/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Unavailable
                </span>
              )}
            </div>
            <CardDescription>
              Recommended: <code className="font-mono text-xs bg-muted px-1 rounded">pip install edge-tts</code> — supports Urdu, Hindi, Arabic, English natively.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {["edge-tts", "pyttsx3", "ffmpeg"].map(eng => (
                <button key={eng} type="button"
                  onClick={() => set("ttsEngine", eng)}
                  className={`rounded-lg border px-4 py-2 text-sm font-mono transition-all ${
                    formData.ttsEngine === eng
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 bg-background text-muted-foreground hover:border-border"
                  }`}>
                  {eng === "edge-tts" && "🎙️ "}{eng === "pyttsx3" && "🐍 "}{eng === "ffmpeg" && "🔕 "}
                  {eng}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── YouTube ─────────────────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
              <Youtube className="w-5 h-5" /> YouTube API
            </CardTitle>
            <CardDescription>
              Needed for automatic video uploads. Must use OAuth2 — see setup instructions below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info box */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
              <p className="font-semibold text-amber-400 mb-2">⚠️ Important — Use the Gmail that owns your channel</p>
              <ol className="text-muted-foreground space-y-1 list-decimal list-inside text-xs">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-primary underline">console.cloud.google.com</a> → Create a new project</li>
                <li>Enable <strong>YouTube Data API v3</strong></li>
                <li>Credentials → Create credentials → <strong>OAuth 2.0 Client ID</strong> (not API Key)</li>
                <li>Add your channel Gmail as a test user</li>
                <li>Download the JSON → paste the API key here</li>
              </ol>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">
                  API Key {settings?.youtubeApiKeySet && <span className="text-accent text-xs">(saved ✓)</span>}
                </label>
                <Input type="password" value={formData.youtubeApiKey}
                  onChange={e => set("youtubeApiKey", e.target.value)}
                  placeholder={settings?.youtubeApiKeySet ? "••••••• (leave blank to keep)" : "AIza..."}
                  className="font-mono bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Channel ID</label>
                <Input value={formData.youtubeChannelId} onChange={e => set("youtubeChannelId", e.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxxxxxx" className="font-mono bg-background" />
                <p className="text-xs text-muted-foreground">Your channel URL: youtube.com/channel/<strong>UCxxx…</strong></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => set("autoUpload", !formData.autoUpload)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.autoUpload ? "bg-primary" : "bg-muted"
                }`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  formData.autoUpload ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
              <label className="text-sm text-muted-foreground">Auto-upload after assembly</label>
            </div>
          </CardContent>
        </Card>

        {/* ── System Paths ────────────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
              <Activity className="w-5 h-5" /> System Paths &amp; Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Output Directory</label>
                <Input value={formData.videosOutputDir} onChange={e => set("videosOutputDir", e.target.value)}
                  placeholder="/tmp/yt-automation" className="font-mono bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Default Language</label>
                <div className="flex gap-2 flex-wrap">
                  {["urdu", "english", "hindi", "arabic"].map(lang => (
                    <button key={lang} type="button"
                      onClick={() => set("defaultLanguage", lang)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-mono capitalize transition-all ${
                        formData.defaultLanguage === lang
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/50 bg-background text-muted-foreground hover:border-border"
                      }`}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
