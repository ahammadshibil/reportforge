import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LayoutTemplate, Plus, Trash2, Sparkles } from "lucide-react";

type Template = {
  id: number;
  workspaceId: number;
  name: string;
  kind: string;
  previewImage: string | null;
  brandColor: string | null;
  createdAt: number;
};

export default function Templates() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: [`/api/workspaces/${current?.id}/templates`],
    enabled: !!current,
  });

  const extractMut = useMutation({
    mutationFn: async () => {
      if (!current || files.length === 0) throw new Error("pick a file");
      const images = await Promise.all(
        files.map(async (f) => {
          const buf = await f.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), "")
          );
          return { contentBase64: base64, mimeType: f.type || "image/png" };
        })
      );
      const r = await apiRequest("POST", "/api/templates/extract", {
        workspaceId: current.id,
        name: name || files[0]?.name?.replace(/\.[^.]+$/, ""),
        images,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${current?.id}/templates`] });
      toast({ title: "Template extracted" });
      setOpen(false);
      setFiles([]);
      setName("");
    },
    onError: (e: any) => {
      toast({ title: "Extraction failed", description: e?.message ?? "" });
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${current?.id}/templates`] });
      toast({ title: "Removed" });
    },
  });

  if (!current) {
    return <div className="p-8 text-sm text-muted-foreground">Pick a workspace.</div>;
  }

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
            <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Upload an image of any branded document — invoice, report cover, newsletter masthead, certificate. Vision-LLM extracts the structure into a fillable form you can reuse.
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-template">
              <Plus className="h-4 w-4 mr-1.5" /> New template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Extract a template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="t-name">Name (optional)</Label>
                <Input
                  id="t-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme invoice v2"
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-file">Sample image(s)</Label>
                <Input
                  id="t-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  data-testid="input-template-files"
                />
                <p className="text-xs text-muted-foreground">
                  PNG / JPG / WebP. Multi-page docs: upload each page; fields are merged.
                </p>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Uses your configured vision LLM (Anthropic / OpenAI / Gemini).
                  Make sure the active model supports vision.
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => extractMut.mutate()}
                disabled={files.length === 0 || extractMut.isPending}
                data-testid="button-extract"
              >
                {extractMut.isPending ? "Extracting…" : "Extract"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card className="py-16 text-center">
          <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm text-muted-foreground">No templates yet.</div>
          <div className="text-xs text-muted-foreground mt-1">
            Upload a sample image to get started.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="overflow-hidden hover-elevate"
              data-testid={`card-template-${t.id}`}
            >
              {t.previewImage ? (
                <Link href={`/templates/${t.id}`}>
                  <img
                    src={t.previewImage}
                    alt={t.name}
                    className="w-full h-44 object-cover bg-muted block cursor-pointer"
                  />
                </Link>
              ) : (
                <div className="w-full h-44 bg-muted grid place-items-center">
                  <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/templates/${t.id}`}
                    className="font-medium truncate hover:underline"
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.kind} · {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => delMut.mutate(t.id)}
                  data-testid={`del-template-${t.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
