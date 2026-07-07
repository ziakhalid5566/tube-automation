import { useState, useEffect } from "react";
import { 
  useGetSettings, 
  useUpdateSettings,
  useCheckAiStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, Cpu, Volume2, Youtube, Save, Activity } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { data: aiStatus } = useCheckAiStatus();

  const [formData, setFormData] = useState({
    ollamaUrl: "",
    ollamaModel: "",
    ttsEngine: "",
    youtubeApiKey: "",
    youtubeChannelId: "",
    defaultLanguage: "en",
    videosOutputDir: ""
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ollamaUrl: settings.ollamaUrl || "",
        ollamaModel: settings.ollamaModel || "",
        ttsEngine: settings.ttsEngine || "gtts",
        youtubeApiKey: "",
        youtubeChannelId: settings.youtubeChannelId || "",
        defaultLanguage: settings.defaultLanguage || "en",
        videosOutputDir: settings.videosOutputDir || "./output"
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({ data: formData });
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 bg-muted rounded"></div>
      <div className="space-y-6">
        {[1,2].map(i => <div key={i} className="h-64 w-full max-w-3xl bg-muted rounded-lg border border-border/50"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            System Configuration
          </h1>
          <p className="text-muted-foreground mt-2">Configure local AI endpoints and external APIs.</p>
        </div>
        <Button onClick={handleSubmit} disabled={updateSettings.isPending} className="gap-2">
          <Save className="w-4 h-4" /> {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
                <Cpu className="w-5 h-5" /> Local AI (Ollama)
              </CardTitle>
              {aiStatus?.ollamaAvailable ? (
                <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Connected
                </span>
              ) : (
                <span className="text-xs font-mono bg-destructive/20 text-destructive px-2 py-1 rounded border border-destructive/30 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Disconnected
                </span>
              )}
            </div>
            <CardDescription>Configure your local LLM endpoint for script generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Endpoint URL</label>
                <Input 
                  value={formData.ollamaUrl} 
                  onChange={e => setFormData({ ...formData, ollamaUrl: e.target.value })} 
                  placeholder="http://localhost:11434" 
                  className="font-mono bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Model Name</label>
                <Input 
                  value={formData.ollamaModel} 
                  onChange={e => setFormData({ ...formData, ollamaModel: e.target.value })} 
                  placeholder="llama3" 
                  className="font-mono bg-background"
                />
                {aiStatus?.models && aiStatus.models.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Available: {aiStatus.models.join(", ")}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
                <Volume2 className="w-5 h-5" /> Text-to-Speech Engine
              </CardTitle>
              {aiStatus?.ttsAvailable ? (
                <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Ready
                </span>
              ) : (
                <span className="text-xs font-mono bg-destructive/20 text-destructive px-2 py-1 rounded border border-destructive/30 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Unavailable
                </span>
              )}
            </div>
            <CardDescription>Configure audio generation for videos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <label className="text-sm font-medium text-muted-foreground font-mono">Engine Type</label>
              <Input 
                value={formData.ttsEngine} 
                onChange={e => setFormData({ ...formData, ttsEngine: e.target.value })} 
                placeholder="gtts" 
                className="font-mono bg-background"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
              <Youtube className="w-5 h-5" /> YouTube API
            </CardTitle>
            <CardDescription>Authentication for automatic uploads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">API Key</label>
                <Input 
                  type="password"
                  value={formData.youtubeApiKey} 
                  onChange={e => setFormData({ ...formData, youtubeApiKey: e.target.value })} 
                  placeholder="••••••••••••••••••••••••••••" 
                  className="font-mono bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Channel ID</label>
                <Input 
                  value={formData.youtubeChannelId} 
                  onChange={e => setFormData({ ...formData, youtubeChannelId: e.target.value })} 
                  placeholder="UCxxxxxxxxxxxx" 
                  className="font-mono bg-background"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-primary font-display">
              <Activity className="w-5 h-5" /> System Paths
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Output Directory</label>
                <Input 
                  value={formData.videosOutputDir} 
                  onChange={e => setFormData({ ...formData, videosOutputDir: e.target.value })} 
                  placeholder="./output" 
                  className="font-mono bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground font-mono">Default Language</label>
                <Input 
                  value={formData.defaultLanguage} 
                  onChange={e => setFormData({ ...formData, defaultLanguage: e.target.value })} 
                  placeholder="en" 
                  className="font-mono bg-background uppercase"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
