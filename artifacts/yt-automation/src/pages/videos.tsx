import { useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Film, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Videos() {
  const { data: videos, isLoading } = useListVideos({}, {
    query: { queryKey: getListVideosQueryKey() }
  });
  
  const [search, setSearch] = useState("");

  const filteredVideos = videos?.filter(v => 
    v.topic.toLowerCase().includes(search.toLowerCase()) || 
    v.status.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 bg-muted rounded"></div>
      <div className="h-96 w-full bg-muted rounded-lg"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-3">
            <Film className="w-8 h-8 text-primary" />
            Global Video Pipeline
          </h1>
          <p className="text-muted-foreground mt-2">All automation jobs across all projects.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search by topic or status..." 
          className="pl-9 bg-card/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden bg-card/50 backdrop-blur">
        {(!filteredVideos || filteredVideos.length === 0) ? (
          <div className="text-center py-20 text-muted-foreground">
            No videos found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>ID</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVideos.map((video) => (
                <TableRow key={video.id} className="group">
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    #{video.id.toString().padStart(4, '0')}
                  </TableCell>
                  <TableCell className="font-medium max-w-md">
                    <div className="truncate" title={video.topic}>{video.topic}</div>
                    {video.errorMessage && (
                      <div className="text-xs text-destructive mt-1 truncate max-w-[300px] font-mono">
                        Error: {video.errorMessage}
                      </div>
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
                        View Pipeline
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
