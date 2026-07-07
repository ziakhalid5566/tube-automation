import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(dateString: string) {
  const d = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", { 
    month: "short", 
    day: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  }).format(d);
}

export const statusConfig: Record<string, { label: string, color: string, pulse?: boolean }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground border-border" },
  generating_script: { label: "Generating Script", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", pulse: true },
  generating_voice: { label: "Generating Voice", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", pulse: true },
  generating_thumbnail: { label: "Generating Thumbnail", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", pulse: true },
  assembling: { label: "Assembling", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", pulse: true },
  ready: { label: "Ready", color: "bg-accent/20 text-accent border-accent/30" },
  uploading: { label: "Uploading", color: "bg-primary/20 text-primary border-primary/30", pulse: true },
  uploaded: { label: "Uploaded", color: "bg-primary/20 text-primary border-primary/30" },
  failed: { label: "Failed", color: "bg-destructive/20 text-destructive border-destructive/30" }
};
