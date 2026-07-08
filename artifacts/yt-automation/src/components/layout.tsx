import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, Film, Settings, Activity, Cpu } from "lucide-react";
import { useCheckAiStatus, useHealthCheck } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: aiStatus } = useCheckAiStatus();
  const { data: health } = useHealthCheck();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/videos", label: "Videos", icon: Film },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans selection:bg-primary/30">
      <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur flex flex-col z-10 sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Activity className="w-5 h-5 text-primary mr-3" />
          <span className="font-display font-bold tracking-widest text-sm text-primary uppercase">YT-AUTO COCKPIT</span>
        </div>
        
        <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            
            return (
              <Link key={link.href} href={link.href}>
                <div className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer group font-display font-medium",
                  active 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                  <Icon className={cn("w-4 h-4 mr-3", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {link.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border/50 bg-card/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Ollama</span>
              {aiStatus?.ollamaAvailable ? (
                <span className="text-accent flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Online</span>
              ) : (
                <span className="text-destructive flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Offline</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> API API</span>
              {health?.status === "ok" ? (
                <span className="text-primary flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Online</span>
              ) : (
                <span className="text-destructive flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Offline</span>
              )}
            </div>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
      
      {/* Background noise texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.015] mix-blend-overlay z-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
    </div>
  );
}
