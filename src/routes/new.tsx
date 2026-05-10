import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, uid } from "@/lib/store";
import {
  INSTRUMENTS,
  EXIT_REASONS,
  type Instrument,
  type ExitReason,
  type OptionLeg,
  type Strategy,
  legPnL,
  nextTradingDay,
  nearestWeeklyThursday,
  formatLocalYYYYMMDD,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  Copy,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  FileText,
  Settings2,
  Activity,
} from "lucide-react";
import { fmtINR, pnlClass } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  validateStrategy,
  toNonNegative,
  toNonPositive,
  sanitizeText,
  sanitizeName,
} from "@/lib/validation";

export const Route = createFileRoute("/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New / Edit Strategy — OptionDesk" },
      {
        name: "description",
        content: "Record a new options trading strategy simulation with multi-leg detail.",
      },
    ],
  }),
  component: NewEntry,
});

const MEM_KEY = "optiondesk:lastUsed:v2";
type Memory = {
  instrument?: Instrument;
  template?: string;
  expiry?: string;
  highestProfit?: number;
  highestProfitTime?: string;
  highestLoss?: number;
  highestLossTime?: string;
  leg?: Partial<OptionLeg>;
};
function loadMem(): Memory {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(MEM_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveMem(m: Memory) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEM_KEY, JSON.stringify(m));
}

const DEFAULT_QTY = 150;
const DEFAULT_ENTRY_TIME = "09:15";
const DEFAULT_EXIT_TIME = "15:15";

function todayISO() {
  return formatLocalYYYYMMDD(new Date());
}

function makeLegFromTemplate(
  tpl: Partial<OptionLeg> & { optionType: "CE" | "PE"; action: "BUY" | "SELL" },
  underlying: string,
  expiry: string,
  memLeg: Memory["leg"],
): OptionLeg {
  return {
    id: uid(),
    underlying,
    strike: tpl.strike ?? memLeg?.strike ?? 0,
    optionType: tpl.optionType,
    action: tpl.action,
    entryPremium: tpl.entryPremium ?? 0,
    exitPremium: tpl.exitPremium ?? 0,
    quantity: tpl.quantity ?? memLeg?.quantity ?? DEFAULT_QTY,
    expiry: tpl.expiry ?? expiry,
    entryTime: tpl.entryTime ?? memLeg?.entryTime ?? "09:20",
    exitTime: tpl.exitTime ?? memLeg?.exitTime ?? DEFAULT_EXIT_TIME,
    exitReason: tpl.exitReason ?? memLeg?.exitReason ?? "Time-based Exit",
  };
}

function emptyLeg(underlying: string, expiry: string, memLeg: Memory["leg"]): OptionLeg {
  return makeLegFromTemplate(
    {
      optionType: (memLeg?.optionType as "CE" | "PE") ?? "CE",
      action: (memLeg?.action as "BUY" | "SELL") ?? "SELL",
    },
    underlying,
    expiry,
    memLeg,
  );
}

const CUSTOM = "Custom";

type DraftLeg = Omit<OptionLeg, "strike" | "quantity" | "entryPremium" | "exitPremium"> & {
  strike: string | number;
  quantity: string | number;
  entryPremium: string | number;
  exitPremium: string | number;
};

const blockInvalidNumberChars =
  (allowDecimal: boolean) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const invalid = ["e", "E", "+", "-"];
    if (!allowDecimal) invalid.push(".");
    if (invalid.includes(e.key)) {
      e.preventDefault();
    }
  };

function NewEntry() {
  const navigate = useNavigate();
  const add = useStore((s) => s.add);
  const updateStrategy = useStore((s) => s.update);
  const templates = useStore((s) => s.templates);
  const defaultTemplate = useStore((s) => s.defaultTemplate);
  const settings = useStore((s) => s.settings);
  const lastNewEntryTradeDate = useStore((s) => s.lastNewEntryTradeDate);
  const setLastNewEntryTradeDate = useStore((s) => s.setLastNewEntryTradeDate);
  const templateNames = useMemo(() => [...templates.map((t) => t.name), CUSTOM], [templates]);
  const { id: editId } = Route.useSearch();
  const editing = useStore((s) => (editId ? s.strategies.find((x) => x.id === editId) : undefined));
  const isEdit = Boolean(editing);
  const mem = useMemo(loadMem, []);

  // Auto-pick the next trading day based on the LAST CREATED new entry's trade date.
  // Edits intentionally do NOT influence this — they don't update lastNewEntryTradeDate.
  const initialDate =
    editing?.tradeDate ??
    (settings.autoNextTradingDay && lastNewEntryTradeDate
      ? nextTradingDay(lastNewEntryTradeDate)
      : todayISO());
  const initialInstrument: Instrument = editing?.instrument ?? mem.instrument ?? "BANKNIFTY";
  const initialExpiry = mem.expiry ?? nearestWeeklyThursday(initialDate);

  // For editing: figure out if the saved template name matches a known template; otherwise it's Custom.
  const editingTplName = editing?.template;
  const editingIsKnownTpl = editingTplName
    ? templates.some((t) => t.name === editingTplName)
    : false;
  const initialTemplate = editing
    ? editingIsKnownTpl
      ? (editingTplName as string)
      : CUSTOM
    : mem.template && (templates.some((t) => t.name === mem.template) || mem.template === CUSTOM)
      ? mem.template
      : defaultTemplate || CUSTOM;
  const initialTpl = templates.find((t) => t.name === initialTemplate);
  const initialInstrumentResolved: Instrument =
    editing?.instrument ?? initialTpl?.instrument ?? initialInstrument;

  const [tradeDate, setTradeDate] = useState(initialDate);
  const [instrument, setInstrument] = useState<Instrument>(initialInstrumentResolved);
  const [template, setTemplate] = useState<string>(initialTemplate);
  const [name, setName] = useState(
    editing?.name ?? (initialTemplate !== CUSTOM ? initialTemplate : ""),
  );

  // Per-strategy defaults come from the active template's first leg; fall back to
  // last-used memory and finally to plain hardcoded defaults for Custom.
  const tplFirstLeg = initialTpl?.legs[0];
  const memLegWithDefaults: Memory["leg"] = {
    quantity: tplFirstLeg?.quantity ?? DEFAULT_QTY,
    entryTime: tplFirstLeg?.entryTime ?? "09:20",
    exitTime: tplFirstLeg?.exitTime ?? DEFAULT_EXIT_TIME,
    exitReason: tplFirstLeg?.exitReason ?? "Time-based Exit",
    ...(mem.leg ?? {}),
  };

  const [legs, setLegs] = useState<DraftLeg[]>(() => {
    if (editing) return editing.legs.map((l) => ({ ...l }));
    if (initialTpl) {
      return initialTpl.legs.map((l) =>
        makeLegFromTemplate(l, initialInstrumentResolved, initialExpiry, memLegWithDefaults),
      );
    }
    return [emptyLeg(initialInstrumentResolved, initialExpiry, memLegWithDefaults)];
  });

  const [highestProfit, setHighestProfit] = useState<number>(editing?.highestProfit ?? 0);
  const [highestProfitTime, setHighestProfitTime] = useState(editing?.highestProfitTime ?? "");
  const [highestLoss, setHighestLoss] = useState<number>(editing?.highestLoss ?? 0);
  const [highestLossTime, setHighestLossTime] = useState(editing?.highestLossTime ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  useEffect(() => {
    setLegs((ls) => ls.map((l) => ({ ...l, underlying: instrument })));
  }, [instrument]);

  // Zustand persist hydrates from localStorage before the first render on the client,
  // but under SSR/TanStack Start the server render uses undefined. The effect reads
  // the store directly via getState() — guaranteed to have the persisted value by
  // the time useEffect fires (after mount / after client hydration).
  useEffect(() => {
    if (isEdit) return; // edits always use editing.tradeDate — never touch it
    const { lastNewEntryTradeDate: last, settings: s } = useStore.getState();
    if (s.autoNextTradingDay && last) {
      setTradeDate(nextTradingDay(last));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLeg = (id: string, patch: Partial<DraftLeg>) =>
    setLegs((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const onLeg1FieldChange = <K extends keyof DraftLeg>(key: K, newValue: DraftLeg[K]) => {
    setLegs((ls) => {
      if (ls.length === 0) return ls;
      const oldValue = ls[0][key];
      return ls.map((l, i) => (i === 0 || l[key] === oldValue ? { ...l, [key]: newValue } : l));
    });
  };

  const applyTemplate = (tplName: string) => {
    setTemplate(tplName);
    if (tplName === CUSTOM) {
      // Custom: blank-named entry with one default leg, ready for the user to fill in.
      setName("");
      const expiry = legs[0]?.expiry || nearestWeeklyThursday(tradeDate);
      setLegs([emptyLeg(instrument, expiry, memLegWithDefaults)]);
      return;
    }
    const tpl = templates.find((t) => t.name === tplName);
    if (!tpl) return;
    if (tpl.instrument) setInstrument(tpl.instrument);
    // Auto-name only if name is empty or was a previous template name (not user-entered).
    if (!name.trim() || templates.some((t) => t.name === name.trim())) setName(tpl.name);
    const expiry = legs[0]?.expiry || nearestWeeklyThursday(tradeDate);
    const u = tpl.instrument ?? instrument;
    setLegs(tpl.legs.map((l) => makeLegFromTemplate(l, u, expiry, memLegWithDefaults)));
  };

  const duplicateLeg = (id: string) => {
    setLegs((ls) => {
      const idx = ls.findIndex((l) => l.id === id);
      if (idx < 0) return ls;
      const copy = { ...ls[idx], id: uid() };
      const next = [...ls];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const parsedLegs = useMemo(() => {
    return legs.map(
      (l) =>
        ({
          ...l,
          strike: Number(l.strike) || 0,
          quantity: Number(l.quantity) || 0,
          entryPremium: Number(l.entryPremium) || 0,
          exitPremium: l.exitPremium === "" ? 0 : Number(l.exitPremium),
        }) as OptionLeg,
    );
  }, [legs]);

  const totalPnL = parsedLegs.reduce((a, l) => a + legPnL(l), 0);
  const winningLegs = parsedLegs.filter((l) => legPnL(l) > 0).length;
  const losingLegs = parsedLegs.filter((l) => legPnL(l) < 0).length;
  const totalQty = parsedLegs.reduce((a, l) => a + l.quantity, 0);

  const save = () => {
    const isCustom = template === CUSTOM;
    const cleanName = sanitizeName(name);
    if (!cleanName || cleanName.length < 3) {
      toast.error("Strategy name must be at least 3 characters");
      return;
    }
    const finalName = cleanName;
    if (legs.length === 0) {
      toast.error("Add at least one leg");
      return;
    }
    const templateLabel = isCustom ? finalName : template;

    const baseStrategy: Strategy =
      isEdit && editing
        ? {
            ...editing,
            name: finalName,
            tradeDate,
            instrument,
            template: templateLabel,
            legs: parsedLegs,
            highestProfit: toNonNegative(highestProfit),
            highestProfitTime,
            highestLoss: toNonPositive(highestLoss),
            highestLossTime,
            notes: sanitizeText(notes),
          }
        : {
            id: uid(),
            name: finalName,
            tradeDate,
            instrument,
            template: templateLabel,
            legs: parsedLegs,
            highestProfit: toNonNegative(highestProfit),
            highestProfitTime,
            highestLoss: toNonPositive(highestLoss),
            highestLossTime,
            notes: sanitizeText(notes),
            createdAt: new Date().toISOString(),
          };

    const result = validateStrategy(baseStrategy);
    if (!result.ok) {
      // Show the first 3 errors so the toast stays readable
      const msg = result.errors.slice(0, 3).join(" • ");
      const more = result.errors.length > 3 ? ` (+${result.errors.length - 3} more)` : "";
      toast.error(`Please fix: ${msg}${more}`);
      return;
    }
    const validated = result.value;

    if (isEdit && editing) {
      updateStrategy(validated);
      toast.success("Strategy updated");
      navigate({ to: "/history" });
      return;
    }
    add(validated);
    const lastLeg = validated.legs[validated.legs.length - 1];
    const expiriesSorted = [...new Set(validated.legs.map((l) => l.expiry).filter(Boolean))].sort();
    const rememberedExpiry = expiriesSorted[0];
    saveMem({
      instrument,
      template,
      expiry: rememberedExpiry,
      highestProfit: validated.highestProfit,
      highestProfitTime: validated.highestProfitTime,
      highestLoss: validated.highestLoss,
      highestLossTime: validated.highestLossTime,
      leg: { ...lastLeg },
    });
    setLastNewEntryTradeDate(tradeDate);
    toast.success("Strategy saved");
    navigate({ to: "/history" });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 -ml-2"
            onClick={() => navigate({ to: "/" })}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight leading-none">
              {isEdit ? "Edit Entry" : "New Entry"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isEdit ? "Update an existing options strategy" : "Record a new options strategy"}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Net P&L
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", pnlClass(totalPnL))}>
              {fmtINR(totalPnL)}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Setup */}
        <Section
          icon={<Settings2 className="h-4 w-4" />}
          title="Setup"
          subtitle="Choose a template and basic details"
        >
          <div className="space-y-5">
            <div>
              <Label>Template</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {templateNames.map((t) => {
                  const active = template === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className={cn(
                        "h-9 px-4 text-xs font-medium rounded-lg border transition-all",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-foreground/80 hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <Field className="sm:col-span-6" label="Strategy Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto from template"
                  className="h-10"
                />
              </Field>
              <Field className="sm:col-span-3" label="Trade Date">
                <Input
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="h-10"
                />
              </Field>
              <Field className="sm:col-span-3" label="Instrument">
                <Select value={instrument} onValueChange={(v) => setInstrument(v as Instrument)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTRUMENTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </Section>

        {/* Legs */}
        <Section
          icon={<Activity className="h-4 w-4" />}
          title="Option Legs"
          subtitle={`${legs.length} leg${legs.length === 1 ? "" : "s"} configured`}
          action={
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-9"
              onClick={() =>
                setLegs((ls) => [
                  ...ls,
                  emptyLeg(
                    instrument,
                    ls[0]?.expiry ?? nearestWeeklyThursday(tradeDate),
                    memLegWithDefaults,
                  ),
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add Leg
            </Button>
          }
        >
          {legs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
              <Activity className="h-7 w-7 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm text-muted-foreground">
                No legs yet. Pick a template above or click{" "}
                <span className="text-foreground font-medium">Add Leg</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {legs.map((leg, idx) => (
                <LegRow
                  key={leg.id}
                  idx={idx}
                  leg={leg}
                  onChange={(p) => updateLeg(leg.id, p)}
                  onLeg1Sync={(key, value) =>
                    idx === 0
                      ? onLeg1FieldChange(key, value)
                      : updateLeg(leg.id, { [key]: value } as Partial<DraftLeg>)
                  }
                  onDuplicate={() => duplicateLeg(leg.id)}
                  onDelete={() => setLegs((ls) => ls.filter((l) => l.id !== leg.id))}
                />
              ))}
            </div>
          )}

          {/* Live summary inside legs section */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Net P&L"
              value={<span className={pnlClass(totalPnL)}>{fmtINR(totalPnL)}</span>}
            />
            <Stat label="Legs" value={legs.length} />
            <Stat label="Total Qty" value={totalQty} />
            <Stat label="Win / Loss" value={`${winningLegs} / ${losingLegs}`} />
          </div>
        </Section>

        {/* Tracking */}
        <Section
          icon={<TrendingUp className="h-4 w-4" />}
          title="Trade Tracking"
          subtitle="Highest extremes during the day"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExtremeCard
              tone="profit"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Highest Profit Reached"
              amount={highestProfit}
              onAmount={setHighestProfit}
              time={highestProfitTime}
              onTime={setHighestProfitTime}
            />
            <ExtremeCard
              tone="loss"
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              label="Highest Loss Reached"
              amount={highestLoss}
              onAmount={setHighestLoss}
              time={highestLossTime}
              onTime={setHighestLossTime}
            />
          </div>
        </Section>

        {/* Notes */}
        <Section
          icon={<FileText className="h-4 w-4" />}
          title="Notes"
          subtitle="Optional context, learnings or mistakes"
        >
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Market context, learnings, mistakes..."
            rows={4}
            className="resize-none"
          />
        </Section>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-5 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Net P&L
              </div>
              <div className={cn("font-semibold tabular-nums", pnlClass(totalPnL))}>
                {fmtINR(totalPnL)}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Legs · Qty
              </div>
              <div className="font-medium tabular-nums">
                {legs.length} · {totalQty}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={save}>
              <Save className="h-4 w-4" /> {isEdit ? "Update Strategy" : "Save Strategy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Leg row ---------- */

function LegRow({
  idx,
  leg,
  onChange,
  onLeg1Sync,
  onDuplicate,
  onDelete,
}: {
  idx: number;
  leg: DraftLeg;
  onChange: (p: Partial<DraftLeg>) => void;
  onLeg1Sync: <K extends keyof DraftLeg>(key: K, value: DraftLeg[K]) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const parsedLeg: OptionLeg = {
    ...leg,
    strike: Number(leg.strike) || 0,
    quantity: Number(leg.quantity) || 0,
    entryPremium: Number(leg.entryPremium) || 0,
    exitPremium: leg.exitPremium === "" ? 0 : Number(leg.exitPremium),
  } as OptionLeg;
  const pnl = legPnL(parsedLeg);
  const isSell = leg.action === "SELL";
  const isCE = leg.optionType === "CE";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/40">
      {/* Header strip */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <div className="h-6 w-6 rounded-md bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center">
          {idx + 1}
        </div>
        <button
          type="button"
          onClick={() => onChange({ action: isSell ? "BUY" : "SELL" })}
          className={cn(
            "px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide transition-colors",
            isSell
              ? "bg-loss/10 text-loss hover:bg-loss/20"
              : "bg-profit/10 text-profit hover:bg-profit/20",
          )}
        >
          {leg.action}
        </button>
        <button
          type="button"
          onClick={() => onChange({ optionType: isCE ? "PE" : "CE" })}
          className={cn(
            "px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide transition-colors",
            isCE
              ? "bg-chart-1/10 text-chart-1 hover:bg-chart-1/20"
              : "bg-chart-5/10 text-chart-5 hover:bg-chart-5/20",
          )}
        >
          {leg.optionType}
        </button>
        <span className="text-xs text-muted-foreground hidden md:inline">{leg.underlying}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={cn("text-xs font-semibold tabular-nums mr-1", pnlClass(pnl))}>
            {fmtINR(pnl)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onDuplicate}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:text-loss"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4">
        <Field label="Strike">
          <Input
            type="number"
            min={0}
            step="1"
            value={leg.strike === 0 ? "" : leg.strike}
            onChange={(e) => onChange({ strike: e.target.value })}
            onKeyDown={blockInvalidNumberChars(false)}
            className="h-9"
          />
        </Field>
        <Field label="Qty">
          <Input
            type="number"
            min={0}
            step="1"
            value={leg.quantity === 0 ? "" : leg.quantity}
            onChange={(e) => onLeg1Sync("quantity", e.target.value)}
            onKeyDown={blockInvalidNumberChars(false)}
            className="h-9"
          />
        </Field>
        <Field label="Entry ₹">
          <Input
            type="number"
            min={0}
            step="any"
            value={leg.entryPremium === 0 ? "" : leg.entryPremium}
            onChange={(e) => onChange({ entryPremium: e.target.value })}
            onKeyDown={blockInvalidNumberChars(true)}
            className="h-9"
          />
        </Field>
        <Field label="Exit ₹">
          <Input
            type="number"
            min={0}
            step="any"
            value={leg.exitPremium === 0 ? "" : leg.exitPremium}
            onChange={(e) => onChange({ exitPremium: e.target.value })}
            onKeyDown={blockInvalidNumberChars(true)}
            className="h-9"
          />
        </Field>
        <Field label="Expiry">
          <Input
            type="date"
            value={leg.expiry}
            onChange={(e) => onLeg1Sync("expiry", e.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Entry Time">
          <Input
            type="time"
            value={leg.entryTime ?? DEFAULT_ENTRY_TIME}
            onChange={(e) => onLeg1Sync("entryTime", e.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Exit Time">
          <Input
            type="time"
            value={leg.exitTime ?? DEFAULT_EXIT_TIME}
            onChange={(e) => onLeg1Sync("exitTime", e.target.value)}
            className="h-9"
          />
        </Field>
        <Field label="Exit Reason">
          <Select
            value={leg.exitReason ?? "Time-based Exit"}
            onValueChange={(v) => onLeg1Sync("exitReason", v as ExitReason)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXIT_REASONS.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function Section({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-foreground/80">{children}</div>;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function ExtremeCard({
  tone,
  icon,
  label,
  amount,
  onAmount,
  time,
  onTime,
}: {
  tone: "profit" | "loss";
  icon: React.ReactNode;
  label: string;
  amount: number;
  onAmount: (v: number) => void;
  time: string;
  onTime: (v: string) => void;
}) {
  const isP = tone === "profit";
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isP ? "border-profit/25 bg-profit/5" : "border-loss/25 bg-loss/5",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold mb-3",
          isP ? "text-profit" : "text-loss",
        )}
      >
        {icon} {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ₹">
          <Input
            type="number"
            step="any"
            min={isP ? 0 : undefined}
            max={isP ? undefined : 0}
            value={amount || ""}
            onChange={(e) =>
              onAmount(isP ? toNonNegative(e.target.value) : toNonPositive(e.target.value))
            }
            className="h-9"
          />
        </Field>
        <Field label="At Time">
          <Input
            type="time"
            value={time}
            onChange={(e) => onTime(e.target.value)}
            className="h-9"
          />
        </Field>
      </div>
    </div>
  );
}
