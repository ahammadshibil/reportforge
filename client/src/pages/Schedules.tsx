import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { CalendarClock, Plus, Trash2, Play, Pencil } from "lucide-react";
import type { Schedule } from "@shared/schema";
import {
  DeliveryTargetEditor,
  type DeliveryTarget,
} from "@/components/DeliveryTargetEditor";

export default function Schedules() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"newsletter" | "report" | "deck">("newsletter");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [prompt, setPrompt] = useState("");
  const [recipients, setRecipients] = useState("");
  const [targets, setTargets] = useState<DeliveryTarget[]>([]);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/workspaces", current?.id, "schedules"],
    queryFn: async () => {
      if (!current) return [];
      const r = await apiRequest("GET", `/api/workspaces/${current.id}/schedules`);
      return r.json();
    },
    enabled: !!current,
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/schedules", {
        workspaceId: current!.id,
        name,
        kind,
        cadence,
        prompt,
        recipients,
        deliveryTargets: targets.length ? JSON.stringify(targets) : null,
        enabled: 1,
        lastRunAt: null,
        nextRunAt: Date.now() + (cadence === "daily" ? 86400000 : cadence === "weekly" ? 604800000 : 2592000000),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "schedules"] });
      toast({ title: "Schedule created" });
      setOpen(false);
      setName("");
      setPrompt("");
      setRecipients("");
      setTargets([]);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      await apiRequest("PATCH", `/api/schedules/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "schedules"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/schedules/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "schedules"] });
      toast({ title: "Removed" });
    },
  });

  const runNow = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/schedules/${id}/run`);
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "schedules"] });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${current?.id}/assets`] });
      toast({
        title: r?.delivered ? `Delivered via ${r.deliveryProvider}` : "Generated",
        description: r?.deliveryError ? `Note: ${r.deliveryError}` : undefined,
      });
    },
    onError: (e: any) => {
      toast({ title: "Run failed", description: e?.message ?? "" });
    },
  });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Schedules
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Recurring jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daily, weekly, and monthly auto-generation rules.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-schedule">
              <Plus className="h-4 w-4 mr-1.5" /> New schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Create schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-sched-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kind</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="deck">Deck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cadence</Label>
                  <Select value={cadence} onValueChange={(v) => setCadence(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Brief / prompt</Label>
                <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} data-testid="input-sched-prompt" />
              </div>
              <div>
                <Label>Delivery targets</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Where the generated asset goes. Add multiple targets to fan out (e.g. vault + Substack + email).
                </p>
                <DeliveryTargetEditor
                  workspaceId={current?.id}
                  value={targets}
                  onChange={setTargets}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!name || !prompt} data-testid="button-save-schedule">
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <Card className="py-16 text-center">
          <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm text-muted-foreground">No schedules yet.</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <Card key={s.id} className="p-4 flex items-center gap-4" data-testid={`card-sched-${s.id}`}>
              <div className="h-10 w-10 rounded-md bg-muted grid place-items-center">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{s.name}</div>
                  <Badge variant="outline" className="text-[10px] capitalize">{s.cadence}</Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">{s.kind}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {s.prompt}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>
                    next run {s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : "—"}
                  </span>
                  <span className="opacity-50">·</span>
                  <span>{targetSummary(s)}</span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(s)}
                data-testid={`button-edit-sched-${s.id}`}
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => runNow.mutate(s.id)}
                disabled={runNow.isPending}
                data-testid={`button-run-${s.id}`}
              >
                <Play className="h-4 w-4 mr-1.5" />
                Run now
              </Button>
              <Switch
                checked={!!s.enabled}
                onCheckedChange={(c) => update.mutate({ id: s.id, body: { enabled: c ? 1 : 0 } })}
                data-testid={`switch-sched-${s.id}`}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => del.mutate(s.id)}
                data-testid={`button-del-sched-${s.id}`}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <EditScheduleDialog
        schedule={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function targetSummary(s: Schedule): string {
  if (s.deliveryTargets) {
    try {
      const arr = JSON.parse(s.deliveryTargets);
      if (Array.isArray(arr) && arr.length) {
        const types = arr.map((t: any) => t.type);
        return `→ ${types.join(" + ")}`;
      }
    } catch {}
  }
  if (s.recipients?.trim()) return `→ email`;
  return "no delivery";
}

function EditScheduleDialog({
  schedule,
  onClose,
}: {
  schedule: Schedule | null;
  onClose: () => void;
}) {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [recipients, setRecipients] = useState("");
  const [targets, setTargets] = useState<DeliveryTarget[]>([]);

  // Reset form whenever a different schedule opens
  useEffect(() => {
    if (schedule) {
      setPrompt(schedule.prompt ?? "");
      setRecipients(schedule.recipients ?? "");
      try {
        const parsed = schedule.deliveryTargets ? JSON.parse(schedule.deliveryTargets) : [];
        setTargets(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTargets([]);
      }
    }
  }, [schedule]);

  const save = useMutation({
    mutationFn: async () => {
      if (!schedule) return;
      await apiRequest("PATCH", `/api/schedules/${schedule.id}`, {
        prompt,
        recipients,
        deliveryTargets: targets.length ? JSON.stringify(targets) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", current?.id, "schedules"] });
      toast({ title: "Saved" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message ?? "" }),
  });

  return (
    <Dialog open={!!schedule} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit schedule — {schedule?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Brief / prompt</Label>
            <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>
          <div>
            <Label>Delivery targets</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add vault, Substack, email, or webhook targets. Multiple = fan-out delivery.
            </p>
            <DeliveryTargetEditor
              workspaceId={current?.id}
              value={targets}
              onChange={setTargets}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
