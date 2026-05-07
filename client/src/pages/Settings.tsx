import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Settings() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [logoText, setLogoText] = useState("");

  useEffect(() => {
    if (current) {
      setName(current.name);
      setIndustry(current.industry || "");
      setColor(current.brandColor || "#0f766e");
      setLogoText(current.logoText || "");
    }
  }, [current]);

  const save = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/workspaces/${current!.id}`, {
        name,
        industry,
        brandColor: color,
        logoText,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      toast({ title: "Saved" });
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInd, setNewInd] = useState("");
  const [newColor, setNewColor] = useState("#0f766e");
  const createWs = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/workspaces", {
        name: newName,
        industry: newInd,
        brandColor: newColor,
        logoText: newName.slice(0, 2).toUpperCase(),
      })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      toast({ title: "Workspace created" });
      setCreateOpen(false);
      setNewName("");
      setNewInd("");
    },
  });

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Settings
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-new-workspace">
              <Plus className="h-4 w-4 mr-1.5" /> New workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-new-ws-name" />
              </div>
              <div>
                <Label>Industry</Label>
                <Input value={newInd} onChange={(e) => setNewInd(e.target.value)} data-testid="input-new-ws-industry" />
              </div>
              <div>
                <Label>Brand color</Label>
                <Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 w-20 p-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createWs.mutate()} disabled={!newName} data-testid="button-create-ws">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <Label>Workspace name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-ws-name" />
        </div>
        <div>
          <Label>Industry / tagline</Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} data-testid="input-ws-industry" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Brand color</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 p-1"
                data-testid="input-ws-color"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <Label>Logo monogram</Label>
            <Input
              value={logoText}
              onChange={(e) => setLogoText(e.target.value.slice(0, 3))}
              maxLength={3}
              data-testid="input-ws-logo"
            />
          </div>
        </div>
        <div className="pt-3 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={!current || save.isPending} data-testid="button-save-ws">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <LlmCard />
    </div>
  );
}

type LlmStatus = {
  provider: string;
  model: string;
  baseUrl: string | null;
  configured: boolean;
  vision?: {
    provider: string;
    model: string;
    baseUrl: string | null;
    distinctFromText: boolean;
    configured: boolean;
  };
};

function LlmCard() {
  const { data } = useQuery<LlmStatus>({
    queryKey: ["/api/llm/status"],
  });
  const status = data;
  return (
    <Card className="p-6 mt-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
        Synthesis engine
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            status?.configured ? "bg-emerald-500" : "bg-zinc-400"
          }`}
        />
        <div className="text-sm font-medium">
          {status?.configured ? `${status.provider} · ${status.model}` : "Extractive (offline)"}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {status?.configured ? (
          <>
            Outputs are generated by the configured LLM. Override with{" "}
            <code>LLM_PROVIDER</code>, <code>LLM_MODEL</code>, <code>LLM_API_KEY</code>,{" "}
            <code>LLM_BASE_URL</code> in <code>.env</code>.
          </>
        ) : (
          <>
            No LLM key set — using the offline extractive synthesizer. Add{" "}
            <code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code>,{" "}
            <code>GEMINI_API_KEY</code>, or generic <code>LLM_*</code> env vars to upgrade.
          </>
        )}
      </p>
      {status?.baseUrl && (
        <p className="text-xs text-muted-foreground mt-1">
          Base URL: <code>{status.baseUrl}</code>
        </p>
      )}
      {status?.vision?.distinctFromText && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Vision (template extraction)
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status.vision.configured ? "bg-emerald-500" : "bg-zinc-400"
              }`}
            />
            <div className="text-sm font-medium">
              {status.vision.provider} · {status.vision.model}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Separate provider for image → schema extraction. Use this when your text
            model can't see (Perplexity Sonar, Groq llama, etc.). Override with{" "}
            <code>VISION_LLM_PROVIDER</code> / <code>VISION_LLM_API_KEY</code> /{" "}
            <code>VISION_LLM_MODEL</code>.
          </p>
        </div>
      )}
      {!status?.vision?.distinctFromText && status?.configured && (
        <p className="text-xs text-muted-foreground mt-2">
          Vision uses the same provider for template extraction. If your text model can't
          see (Perplexity / Groq / DeepSeek), set <code>VISION_LLM_*</code> with a
          vision-capable key (Gemini / OpenAI / Claude).
        </p>
      )}
    </Card>
  );
}
