import { useState } from "react";
import { 
  useGetProject, 
  useListVideos, 
  useCreateVideo, 
  getGetProjectQueryKey, 
  getListVideosQueryKey 
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Film, Plus, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  
  const { data: project, isLoading: projectLoading } = useGetProject(projectId, { 
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } 
  });
  
  const { data: videos, isLoading: videosLoading } = useListVideos({ projectId }, {
    query: { enabled: !!projectId, queryKey: getListVideosQueryKey({ projectId }) }
  });

  const createVideo = useCreateVideo();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [topic, setTopic] = useState("");

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    createVideo.mutate({ data: { projectId, topic, language: project?.language || "en" } }, {
      onSuccess: () => {
        setIsCreating(false);
        setTopic("");
        queryClient.invalidateQueries({ queryKey: getListVideosQueryKey({ projectId }) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  if (projectLoading || videosLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-10 w-64 bg-muted rounded"></div>
      <div className="h-40 w-full bg-muted rounded-lg"></div>
    </div>;
  }

  if (!project) return <div>Project not found</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="font-mono text-xs">{project.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">{project.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" /> Video Pipeline
        </h2>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Video Topic
          </Button>
        )}
      </div>

      {isCreating && (
        <Card className="border-primary/50 bg-card/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardContent className="pt-6">
            <form onSubmit={handleCreateVideo} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Video Topic / Idea</label>
                <Input 
                  required 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)} 
                  placeholder="e.g. History of Quantum Computing" 
                  className="font-mono bg-background"
                  autoFocus
                />
              </div>
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={createVideo.isPending} className="gap-2">
                <Zap className="w-4 h-4" /> {createVideo.isPending ? "Initializing..." : "Initialize Job"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(!videos || videos.length === 0) && !isCreating ? (
        <div className="text-center py-20 border border-dashed border-border/50 rounded-lg bg-card/30">
          <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-muted-foreground">No videos in pipeline</h3>
          <p className="text-sm text-muted-foreground/70 mb-4">Start by adding a topic to generate content for.</p>
          <Button onClick={() => setIsCreating(true)} variant="outline">Add Video Topic</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden bg-card/50 backdrop-blur">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos?.map((video) => (
                <TableRow key={video.id} className="group">
                  <TableCell className="font-medium">
                    {video.topic}
                    {video.errorMessage && (
                      <p className="text-xs text-destructive mt-1 max-w-md truncate font-mono">
                        Error: {video.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge status={video.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {formatDate(video.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/videos/${video.id}`}>
                      <Button variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Open Pipeline
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
