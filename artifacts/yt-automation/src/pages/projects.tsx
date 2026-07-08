import { useState } from "react";
import { useListProjects, useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { FolderKanban, Plus, ArrowRight, Video } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", niche: "", language: "en" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate({ data: formData }, {
      onSuccess: () => {
        setIsCreating(false);
        setFormData({ name: "", description: "", niche: "", language: "en" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      }
    });
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-muted rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="h-48 bg-muted rounded-lg border border-border/50"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-primary" />
            Projects
          </h1>
          <p className="text-muted-foreground mt-2">Manage your automation channels and niches.</p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        )}
      </div>

      {isCreating && (
        <Card className="border-primary/50 bg-card/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Initialize New Project</CardTitle>
            <CardDescription>Define a new automation channel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Project Name</label>
                <Input 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="e.g. Daily Tech News" 
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <Textarea 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  placeholder="Short description of the channel focus..."
                  className="font-mono resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Niche</label>
                  <Input 
                    value={formData.niche} 
                    onChange={e => setFormData({ ...formData, niche: e.target.value })} 
                    placeholder="e.g. Technology" 
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Language</label>
                  <Input 
                    value={formData.language} 
                    onChange={e => setFormData({ ...formData, language: e.target.value })} 
                    placeholder="en" 
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {projects?.length === 0 && !isCreating ? (
        <div className="text-center py-20 border border-dashed border-border/50 rounded-lg">
          <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-muted-foreground">No projects found</h3>
          <p className="text-sm text-muted-foreground/70 mb-4">Create your first project to start automating.</p>
          <Button onClick={() => setIsCreating(true)} variant="outline">Create Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map(project => (
            <Card key={project.id} className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors group flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-muted/50 border-border/50 text-xs text-muted-foreground uppercase tracking-wider font-mono">
                    {project.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{formatDate(project.createdAt).split(',')[0]}</span>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{project.name}</CardTitle>
                <CardDescription className="line-clamp-2 h-10">{project.description || "No description provided."}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded border border-border/50">
                    <Video className="w-3.5 h-3.5" />
                    <span className="font-mono">{project.videoCount || 0} Videos</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded border border-border/50">
                    <span className="font-mono text-accent">{project.uploadedCount || 0} Uploaded</span>
                  </div>
                </div>
              </CardContent>
              <div className="p-4 border-t border-border/50 mt-auto bg-muted/10 group-hover:bg-primary/5 transition-colors">
                <Link href={`/projects/${project.id}`} className="flex items-center justify-between w-full text-sm font-medium text-foreground group-hover:text-primary">
                  Enter Workspace <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
