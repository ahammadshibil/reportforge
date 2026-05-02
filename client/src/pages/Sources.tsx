import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Trash2, Plus, FileText, Link as LinkIcon, NotebookPen, Table2 } from "lucide-react";
import type { Source } from "@shared/schema";

const TYPE_META: Record<string, { label: string; icon: any }> = {
  pdf: { label: "PDF", icon: FileText },
  csv: { label: "CSV", icon: Table2 },
  url: { label: "URL", icon: LinkIcon },
  note: { label: "Note", icon: NotebookPen },
};

export default function Sources() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"pdf" | "csv" | "url" | "note">("note");
  const [content, setContent] = useState("");

  const { data: sources = [], isLoading } = useQuery<Source[]>({
    queryKey: ["/api/workspaces", current?.id, "sources"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/sources`);
      return r.json();
    },
    enabled: !!current,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("no workspace");
      const r = await apiRequest("POST", "/api/sources", {
        workspaceId: current.id,
        title,
        type,
        status: "ready",
        content,
        meta: null,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "sources"] });
      toast({ title: "Source added" });
      setOpen(false);
      setTitle("");
      setContent("");
      setType("note");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sources/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "sources"] });
      toast({ title: "Source removed" });
    },
  });

  const onFile = async (file: File) => {
    const text = await file.text().catch(() => "");
    setTitle(file.name);
    setContent(text || "[binary file — paste extracted text here]");
    if (file.name.endsWith(".csv")) setType("csv");
    else if (file.name.endsWith(".pdf")) setType("pdf");
    else setType("note");
  };

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Sources
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Knowledge base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Material the synthesizer pulls from when generating outputs.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-source">
              <Plus className="h-4 w-4 mr-1.5" /> Add source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add source</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  data-testid="input-source-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Q1 board memo"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger data-testid="select-source-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note / pasted text</SelectItem>
                      <SelectItem value="pdf">PDF (paste extracted text)</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Or upload a file</Label>
                  <Input
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    data-testid="input-source-file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f);
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  rows={10}
                  data-testid="input-source-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste raw text, transcript, CSV, or URL here…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!title || !content || createMutation.isPending}
                data-testid="button-save-source"
              >
                {createMutation.isPending ? "Adding…" : "Add source"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Added</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-sm text-muted-foreground">No sources yet.</div>
          </div>
        ) : (
          sources.map((s) => {
            const meta = TYPE_META[s.type] ?? TYPE_META.note;
            const Icon = meta.icon;
            return (
              <div
                key={s.id}
                className="grid grid-cols-12 px-5 py-3 items-center text-sm border-b border-border last:border-0 hover-elevate"
                data-testid={`row-source-${s.id}`}
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="h-7 w-7 rounded-md bg-muted grid place-items-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.content.slice(0, 90)}…
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {meta.label}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {s.status}
                  </Badge>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground num">
                  {new Date(s.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-1 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(s.id)}
                    data-testid={`button-delete-source-${s.id}`}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
