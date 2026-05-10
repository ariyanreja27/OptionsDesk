import { confirmIfEnabled } from "@/lib/confirm";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  INSTRUMENTS,
  EXIT_REASONS,
  type Instrument,
  type StrategyTemplate,
  type OptionType,
  type Action,
  type ExitReason,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Star, BookTemplate, Layers } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — OptionStats" },
      {
        name: "description",
        content: "Save and manage reusable strategy templates.",
      },
    ],
  }),
  component: TemplatesPage,
});

type Leg = {
  optionType: OptionType;
  action: Action;
  quantity: number;
  entryTime?: string;
  exitTime?: string;
  exitReason?: ExitReason;
};

const newLeg = (): Leg => ({
  optionType: "CE",
  action: "SELL",
  quantity: 150,
  entryTime: "09:20",
  exitTime: "15:15",
  exitReason: "Time-based Exit",
});

function TemplatesPage() {
  const templates = useStore((s) => s.templates);
  const defaultTemplate = useStore((s) => s.defaultTemplate);
  const setDefaultTemplate = useStore((s) => s.setDefaultTemplate);
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const removeTemplate = useStore((s) => s.removeTemplate);

  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instrument, setInstrument] = useState<Instrument | "">("");
  const [legs, setLegs] = useState<Leg[]>([newLeg()]);

  const openNew = () => {
    setEditingName(null);
    setName("");
    setInstrument("");
    setLegs([newLeg()]);
    setOpen(true);
  };

  const openEdit = (t: StrategyTemplate) => {
    setEditingName(t.name);
    setName(t.name);
    setInstrument(t.instrument ?? "");
    setLegs(
      t.legs.map((l) => ({
        optionType: l.optionType,
        action: l.action,
        quantity: l.quantity ?? 150,
        entryTime: l.entryTime ?? "09:20",
        exitTime: l.exitTime ?? "15:15",
        exitReason: l.exitReason ?? "Time-based Exit",
      })),
    );
    setOpen(true);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Template name is required");
    if (legs.length === 0) return toast.error("Add at least one leg");
    if (templates.some((t) => t.name === trimmed && t.name !== editingName))
      return toast.error("A template with this name already exists");

    const tpl: StrategyTemplate = {
      name: trimmed,
      instrument: instrument || undefined,
      legs: legs.map((l) => ({
        optionType: l.optionType,
        action: l.action,
        quantity: l.quantity,
        entryTime: l.entryTime,
        exitTime: l.exitTime,
        exitReason: l.exitReason ?? "Time-based Exit",
      })),
    };

    if (editingName) {
      updateTemplate(editingName, tpl);
      toast.success("Template updated");
    } else {
      addTemplate(tpl);
      toast.success("Template saved");
    }
    setOpen(false);
  };

  const handleDelete = (n: string) => {
    if (!confirmIfEnabled(`Delete template "${n}"?`)) return;
    removeTemplate(n);
    toast.success("Template deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BookTemplate className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight leading-none">
                Strategy Templates
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Save reusable templates to speed up new entries.
              </p>
            </div>
          </div>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </header>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Default template
              </div>
              <div className="text-sm font-medium mt-1">Used when starting a new entry</div>
            </div>
            <Select value={defaultTemplate} onValueChange={setDefaultTemplate}>
              <SelectTrigger className="h-10 w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((t) => {
            const isDefault = t.name === defaultTemplate;
            return (
              <div
                key={t.name}
                className={cn(
                  "rounded-2xl border bg-card p-4 transition-colors",
                  isDefault ? "border-primary/60" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold tracking-tight truncate">{t.name}</h3>
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                          <Star className="h-3 w-3" /> Default
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {t.legs.length} leg{t.legs.length === 1 ? "" : "s"}
                      </span>
                      {t.instrument && <span>· {t.instrument}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setDefaultTemplate(t.name);
                          toast.success(`"${t.name}" set as default`);
                        }}
                      >
                        Make default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(t.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.legs.map((l, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border",
                        l.action === "SELL"
                          ? "bg-loss/10 text-loss border-loss/20"
                          : "bg-profit/10 text-profit border-profit/20",
                      )}
                    >
                      {l.action} {l.optionType} × {l.quantity ?? 150}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingName ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <Input
                  className="h-10 mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 1.5% SL BNF Strangle"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Instrument (optional)
                </label>
                <Select
                  value={instrument || "none"}
                  onValueChange={(v) => setInstrument(v === "none" ? "" : (v as Instrument))}
                >
                  <SelectTrigger className="h-10 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Any —</SelectItem>
                    {INSTRUMENTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Legs
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setLegs((ls) => [...ls, newLeg()])}
                >
                  <Plus className="h-3 w-3" /> Add Leg
                </Button>
              </div>
              <div className="space-y-2">
                {legs.map((leg, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-muted/20 p-2 space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Action
                        </div>
                        <Select
                          value={leg.action}
                          onValueChange={(v) =>
                            setLegs((ls) =>
                              ls.map((l, j) => (j === i ? { ...l, action: v as Action } : l)),
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SELL">SELL</SelectItem>
                            <SelectItem value="BUY">BUY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Type
                        </div>
                        <Select
                          value={leg.optionType}
                          onValueChange={(v) =>
                            setLegs((ls) =>
                              ls.map((l, j) =>
                                j === i ? { ...l, optionType: v as OptionType } : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CE">CE</SelectItem>
                            <SelectItem value="PE">PE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Default Qty
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          className="h-9"
                          value={leg.quantity}
                          onChange={(e) =>
                            setLegs((ls) =>
                              ls.map((l, j) =>
                                j === i
                                  ? { ...l, quantity: Math.max(0, Number(e.target.value) || 0) }
                                  : l,
                              ),
                            )
                          }
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Entry Time
                        </div>
                        <Input
                          type="time"
                          className="h-9"
                          value={leg.entryTime ?? ""}
                          onChange={(e) =>
                            setLegs((ls) =>
                              ls.map((l, j) => (j === i ? { ...l, entryTime: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Exit Time
                        </div>
                        <Input
                          type="time"
                          className="h-9"
                          value={leg.exitTime ?? ""}
                          onChange={(e) =>
                            setLegs((ls) =>
                              ls.map((l, j) => (j === i ? { ...l, exitTime: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-6">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Exit Reason
                        </div>
                        <Select
                          value={leg.exitReason ?? "Time-based Exit"}
                          onValueChange={(v) =>
                            setLegs((ls) =>
                              ls.map((l, j) =>
                                j === i ? { ...l, exitReason: v as ExitReason } : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXIT_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editingName ? "Update" : "Save Template"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
