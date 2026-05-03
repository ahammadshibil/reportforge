import { useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiUrl } from "@/lib/queryClient";
import { useWorkspace } from "@/lib/workspaceContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Plus, Trash2, FileDown, Sparkles, Wand2 } from "lucide-react";
import type { Source } from "@shared/schema";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "currency" | "email" | "textarea";
  required?: boolean;
  group?: string;
  placeholder?: string;
};
type LineItemColumn = { key: string; label: string; type: Field["type"] };
type Schema = {
  name: string;
  kind: string;
  brand: { primaryColor?: string };
  fields: Field[];
  lineItemColumns?: LineItemColumn[];
};
type Template = {
  id: number;
  name: string;
  schema: string;
  previewImage: string | null;
};

export default function TemplateBuild() {
  const [, params] = useRoute("/templates/:id");
  const id = params?.id ? Number(params.id) : NaN;
  const { toast } = useToast();
  const { current } = useWorkspace();
  const [fillOpen, setFillOpen] = useState(false);
  const [pickedSources, setPickedSources] = useState<Set<number>>(new Set());
  const [brief, setBrief] = useState("");

  const { data: template } = useQuery<Template>({
    queryKey: [`/api/templates/${id}`],
    enabled: !!id,
  });

  const schema: Schema | null = useMemo(() => {
    if (!template?.schema) return null;
    try {
      return JSON.parse(template.schema);
    } catch {
      return null;
    }
  }, [template?.schema]);

  const [values, setValues] = useState<Record<string, any>>({});
  const [items, setItems] = useState<Array<Record<string, any>>>([]);

  // Seed line items with one empty row when schema arrives.
  useEffect(() => {
    if (schema?.lineItemColumns && items.length === 0) {
      const empty: Record<string, any> = {};
      for (const c of schema.lineItemColumns) empty[c.key] = "";
      setItems([empty]);
    }
  }, [schema, items.length]);

  const groups = useMemo(() => {
    const out: Record<string, Field[]> = {};
    if (!schema) return out;
    for (const f of schema.fields) {
      const g = f.group || "Details";
      (out[g] ||= []).push(f);
    }
    return out;
  }, [schema]);

  const renderMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/templates/${id}/render`, {
        values,
        lineItems: items,
      });
      return r.json();
    },
    onSuccess: (r: any) => {
      toast({ title: "Generated" });
      const url = apiUrl(`/api/assets/${r.assetId}/file?inline=1`);
      window.open(url, "_blank");
    },
    onError: (e: any) => toast({ title: "Render failed", description: e?.message }),
  });

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: [`/api/workspaces/${current?.id}/sources`],
    enabled: !!current && fillOpen,
  });

  const fillMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/templates/${id}/fill`, {
        sourceIds: Array.from(pickedSources),
        brief: brief.trim() || undefined,
      });
      return r.json();
    },
    onSuccess: (r: any) => {
      const newValues: Record<string, any> = { ...values };
      if (r?.values && typeof r.values === "object") {
        for (const [k, v] of Object.entries(r.values)) newValues[k] = v;
      }
      setValues(newValues);
      if (Array.isArray(r?.lineItems) && r.lineItems.length > 0) {
        setItems(r.lineItems);
      }
      const filled = Object.keys(r?.values ?? {}).length;
      toast({
        title: "Fields populated",
        description: `${filled} field${filled === 1 ? "" : "s"} filled${
          r?.lineItems?.length ? ` · ${r.lineItems.length} line item${r.lineItems.length === 1 ? "" : "s"}` : ""
        }. Tweak then Generate.`,
      });
      setFillOpen(false);
    },
    onError: (e: any) => toast({ title: "Fill failed", description: e?.message }),
  });

  if (!template || !schema) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const cols = schema.lineItemColumns || [];

  function setItem(idx: number, key: string, v: any) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: v };
      return next;
    });
  }
  function addRow() {
    const empty: Record<string, any> = {};
    for (const c of cols) empty[c.key] = "";
    setItems((prev) => [...prev, empty]);
  }
  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const inputType = (t: Field["type"]) =>
    t === "number" || t === "currency" ? "number" : t === "date" ? "date" : t === "email" ? "email" : "text";

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/templates" className="flex items-center hover:text-foreground">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Templates
          </Link>
          <span className="opacity-50">/</span>
          <span>{template.name}</span>
        </div>
        <Dialog open={fillOpen} onOpenChange={setFillOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-fill">
              <Wand2 className="h-4 w-4 mr-1.5" />
              Fill from sources
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Auto-fill from sources</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Pick sources — the LLM reads them and fills the form fields it can confidently match. You can tweak everything before generating.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fill-brief">Optional brief</Label>
                <Textarea
                  id="fill-brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. focus on Q1 numbers; bill to Acme Corp"
                  rows={2}
                  data-testid="input-fill-brief"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sources ({pickedSources.size} selected)</Label>
                <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {sources.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">
                      No sources in this workspace yet.
                    </div>
                  )}
                  {sources.map((s) => {
                    const checked = pickedSources.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 p-2.5 hover-elevate cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = new Set(pickedSources);
                            if (v) next.add(s.id);
                            else next.delete(s.id);
                            setPickedSources(next);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.type} · {(s.content || "").length.toLocaleString()} chars
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {sources.length > 0 && pickedSources.size === 0 && (
                  <p className="text-xs text-muted-foreground">
                    None selected → all sources will be used.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFillOpen(false)}>Cancel</Button>
              <Button
                onClick={() => fillMut.mutate()}
                disabled={fillMut.isPending}
                data-testid="button-fill-go"
              >
                {fillMut.isPending ? "Filling…" : "Fill"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          {Object.entries(groups).map(([group, fields]) => (
            <Card key={group} className="p-5 space-y-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {group}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map((f) => (
                  <div
                    key={f.key}
                    className={`space-y-1.5 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
                  >
                    <Label htmlFor={f.key}>
                      {f.label}
                      {f.required ? <span className="text-destructive ml-0.5">*</span> : null}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        id={f.key}
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        rows={4}
                        data-testid={`field-${f.key}`}
                      />
                    ) : (
                      <Input
                        id={f.key}
                        type={inputType(f.type)}
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        data-testid={`field-${f.key}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {cols.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Line items
                </div>
                <Button size="sm" variant="outline" onClick={addRow} data-testid="add-row">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Row
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      {cols.map((c) => (
                        <th key={c.key} className="py-1.5 pr-3 font-medium">
                          {c.label}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, i) => (
                      <tr key={i} className="align-top">
                        {cols.map((c) => (
                          <td key={c.key} className="py-1 pr-2">
                            <Input
                              type={inputType(c.type)}
                              value={row[c.key] ?? ""}
                              onChange={(e) => setItem(i, c.key, e.target.value)}
                              data-testid={`row-${i}-${c.key}`}
                            />
                          </td>
                        ))}
                        <td>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeRow(i)}
                            data-testid={`remove-row-${i}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() => renderMut.mutate()}
              disabled={renderMut.isPending}
              data-testid="button-generate"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {renderMut.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 pt-3">
              Source
            </div>
            {template.previewImage ? (
              <img
                src={template.previewImage}
                alt={template.name}
                className="w-full block"
              />
            ) : (
              <div className="h-40 grid place-items-center text-xs text-muted-foreground">
                No preview
              </div>
            )}
          </Card>
          <Card className="p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Schema
            </div>
            <div>{schema.fields.length} fields · {cols.length} line-item columns</div>
            <div>Brand: <span style={{ color: schema.brand?.primaryColor || undefined }}>{schema.brand?.primaryColor ?? "—"}</span></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
