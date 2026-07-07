import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FolderKanban, Film, UploadCloud, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 bg-muted rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-lg border border-border/50"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Mission Control</h1>
        <p className="text-muted-foreground mt-2">System overview and active pipeline status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats?.totalProjects || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Total Videos</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats?.totalVideos || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Uploaded</CardTitle>
            <UploadCloud className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-accent">{stats?.uploadedVideos || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Pending/Processing</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-amber-500">{stats?.pendingVideos || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-destructive">{stats?.failedVideos || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Link href="/projects">
          <Button variant="default" className="gap-2">
            <FolderKanban className="w-4 h-4" /> New Project
          </Button>
        </Link>
        <Link href="/videos">
          <Button variant="outline" className="gap-2">
            View All Videos <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest videos in the automation pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          {(!stats?.recentVideos || stats.recentVideos.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent activity. Start by creating a project.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentVideos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={video.topic}>{video.topic}</TableCell>
                    <TableCell>
                      <Badge status={video.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(video.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/videos/${video.id}`}>
                        <Button variant="ghost" size="sm" className="h-8">Details</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
