import { 
  useGetVideo, 
  useGenerateScript, 
  useGenerateVoice, 
  useGenerateThumbnail, 
  useGenerateSeo, 
  useAssembleVideo, 
  useUploadToYoutube, 
  useRunFullPipeline,
  useGetProject,
  getGetVideoQueryKey,
  getGetProjectQueryKey
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, CheckCircle2, Circle, Loader2, AlertCircle, FileText, Image as ImageIcon, Volume2, Film, Youtube, ExternalLink, RefreshCw } from "lucide-react";
import { formatDuration, statusConfig, cn } from "@/lib/utils";

export default function VideoDetail() {
  const { id } = useParams();
  const videoId = Number(id);
  const queryClient = useQueryClient();

  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId), refetchInterval: 5000 }
  });

  const { data: project } = useGetProject(video?.projectId || 0, {
    query: { enabled: !!video?.projectId, queryKey: getGetProjectQueryKey(video?.projectId || 0) }
  });

  // Mutations
  const generateScript = useGenerateScript();
  const generateVoice = useGenerateVoice();
  const generateThumbnail = useGenerateThumbnail();
  const generateSeo = useGenerateSeo();
  const assembleVideo = useAssembleVideo();
  const uploadToYoutube = useUploadToYoutube();
  const runFullPipeline = useRunFullPipeline();

  const handleAction = (mutationFn: any) => {
    mutationFn.mutate({ id: videoId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) });
      }
    });
  };

  if (isLoading || !video) {
    return <div className="animate-pulse space-y-8 p-8">
      <div className="h-8 w-64 bg-muted rounded"></div>
      <div className="h-32 w-full bg-muted rounded-lg"></div>
    </div>;
  }

  const pipelineStages = [
    { 
      id: "script", 
      title: "Script & SEO", 
      icon: FileText, 
      status: video.script ? "done" : (video.status === "generating_script" ? "running" : "pending"),
      action: generateScript,
      label: "Generate Script"
    },
    { 
      id: "voice", 
      title: "Voice Generation", 
      icon: Volume2, 
      status: video.audioPath ? "done" : (video.status === "generating_voice" ? "running" : (video.script ? "pending" : "locked")),
      action: generateVoice,
      label: "Generate Audio"
    },
    { 
      id: "thumbnail", 
      title: "Thumbnail", 
      icon: ImageIcon, 
      status: video.thumbnailPath ? "done" : (video.status === "generating_thumbnail" ? "running" : "pending"),
      action: generateThumbnail,
      label: "Generate Image"
    },
    { 
      id: "assemble", 
      title: "Assemble Video", 
      icon: Film, 
      status: video.videoPath ? "done" : (video.status === "assembling" ? "running" : (video.audioPath && video.thumbnailPath ? "pending" : "locked")),
      action: assembleVideo,
      label: "Render Video"
    },
    { 
      id: "upload", 
      title: "YouTube Upload", 
      icon: Youtube, 
      status: video.youtubeId ? "done" : (video.status === "uploading" ? "running" : (video.videoPath ? "pending" : "locked")),
      action: uploadToYoutube,
      label: "Upload"
    }
  ];

  const isPipelineRunning = pipelineStages.some(s => s.status === "running") || runFullPipeline.isPending;
  const isFailed = video.status === "failed";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 border-b border-border/50 pb-6">
        <Link href={project ? `/projects/${project.id}` : "/videos"}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold tracking-tight">{video.topic}</h1>
            <Badge status={video.status} />
          </div>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground font-mono">
            {project && <span>Project: {project.name}</span>}
            <span>ID: #{video.id.toString().padStart(4, '0')}</span>
            {video.durationSeconds && <span>Duration: {formatDuration(video.durationSeconds)}</span>}
          </div>
        </div>
        <Button 
          onClick={() => handleAction(runFullPipeline)} 
          disabled={isPipelineRunning || video.status === "uploaded"}
          className={cn(
            "gap-2 font-display", 
            isPipelineRunning ? "animate-pulse border border-primary/50" : ""
          )}
          variant={video.status === "ready" ? "default" : "outline"}
        >
          {isPipelineRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isPipelineRunning ? "Pipeline Active..." : "Run Full Pipeline"}
        </Button>
      </div>

      {isFailed && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">Pipeline Failed</h3>
            <p className="text-sm text-destructive/80 font-mono mt-1">{video.errorMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {pipelineStages.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = stage.status === "running";
          const isDone = stage.status === "done";
          const isLocked = stage.status === "locked";
          
          return (
            <Card key={stage.id} className={cn(
              "relative overflow-hidden transition-all duration-300",
              isActive ? "border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "border-border/50 bg-card/30",
              isDone ? "border-accent/30" : "",
              isLocked ? "opacity-50 grayscale" : ""
            )}>
              {isActive && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-pulse" />
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("p-2 rounded-md", isActive ? "bg-primary/20 text-primary" : isDone ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground")}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/30" />
                  )}
                </div>
                <CardTitle className="text-base">{stage.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant={isActive ? "outline" : (isDone ? "ghost" : "secondary")}
                  size="sm" 
                  className="w-full text-xs font-mono"
                  disabled={isLocked || isActive || stage.action.isPending}
                  onClick={() => handleAction(stage.action)}
                >
                  {isActive ? "Processing..." : (isDone ? "Regenerate" : stage.label)}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/30 border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Generated Script
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {video.script ? (
              <div className="bg-background rounded-md p-4 h-full border border-border/50 max-h-96 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {video.script}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed border-border/50 p-8 min-h-[200px]">
                Script not generated yet
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 flex flex-col">
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Youtube className="w-5 h-5 text-primary" /> SEO & Meta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Title</label>
                <div className="font-medium mt-1">{video.seoTitle || "—"}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Description</label>
                <div className="text-sm mt-1 line-clamp-3 text-muted-foreground">{video.seoDescription || "—"}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Tags</label>
                <div className="text-sm mt-1 font-mono text-primary/80 break-words">{video.seoTags || "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border/50 flex-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" /> Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border/50">
                <span className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-4 h-4" /> Thumbnail
                </span>
                {video.thumbnailPath ? <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">Ready</Badge> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border/50">
                <span className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                  <Volume2 className="w-4 h-4" /> Audio Track
                </span>
                {video.audioPath ? <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">Ready</Badge> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-background border border-border/50">
                <span className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                  <Film className="w-4 h-4" /> Final Video
                </span>
                {video.videoPath ? <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">Ready</Badge> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              
              {video.youtubeUrl && (
                <div className="pt-4 border-t border-border/50">
                  <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full p-3 rounded-md bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors font-medium">
                    <Youtube className="w-5 h-5" /> View on YouTube <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
