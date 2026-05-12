import { confirmIfEnabled } from "@/lib/confirm";
import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { strategyPnL, strategyTemplateLabel, INSTRUMENTS, EXIT_REASONS } from "@/lib/types";
import { fmtDate, fmtINR, pnlClass } from "@/lib/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  Search,
  History as HistoryIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowUpRight,
  Layers,
  Wallet,
  Target,
  Sigma,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  X,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Trade History — OptionStats" },
      { name: "description", content: "Browse and search your saved strategy backtests." },
    ],
  }),
  component: History,
});

type SortKey = "date" | "name" | "instrument" | "pnl";

function History() {
  const strategies = useStore((s) => s.strategies);
  const templates = useStore((s) => s.templates);
  const removeStrategy = useStore((s) => s.remove);

  const strategyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) if (t.name !== "Custom") set.add(t.name);
    for (const s of strategies) {
      const label = strategyTemplateLabel(s);
      if (label && label !== "Custom") set.add(label);
    }
    return Array.from(set).sort();
  }, [templates, strategies]);
  const [q, setQ] = useState("");
  const [inst, setInst] = useState("all");
  const [stype, setStype] = useState("all");
  const [outcome, setOutcome] = useState<"all" | "win" | "loss" | "be">("all");
  const [exitReason, setExitReason] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pnlMin, setPnlMin] = useState("");
  const [pnlMax, setPnlMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE = 10;

  const resetAll = () => {
    setQ("");
    setInst("all");
    setStype("all");
    setOutcome("all");
    setExitReason("all");
    setFrom("");
    setTo("");
    setPnlMin("");
    setPnlMax("");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const min = pnlMin === "" ? null : Number(pnlMin);
    const max = pnlMax === "" ? null : Number(pnlMax);
    let list = strategies.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (inst !== "all" && s.instrument !== inst) return false;
      if (stype !== "all" && strategyTemplateLabel(s) !== stype) return false;
      if (from && s.tradeDate < from) return false;
      if (to && s.tradeDate > to) return false;
      const pnl = strategyPnL(s);
      if (outcome === "win" && pnl <= 0) return false;
      if (outcome === "loss" && pnl >= 0) return false;
      if (outcome === "be" && pnl !== 0) return false;
      if (min !== null && !Number.isNaN(min) && pnl < min) return false;
      if (max !== null && !Number.isNaN(max) && pnl > max) return false;
      if (exitReason !== "all" && !s.legs.some((l) => l.exitReason === exitReason)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let av: string | number = 0,
        bv: string | number = 0;
      if (sortKey === "date") {
        av = a.tradeDate;
        bv = b.tradeDate;
      } else if (sortKey === "name") {
        av = a.name;
        bv = b.name;
      } else if (sortKey === "instrument") {
        av = a.instrument;
        bv = b.instrument;
      } else {
        av = strategyPnL(a);
        bv = strategyPnL(b);
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return asc ? cmp : -cmp;
    });
    return list;
  }, [strategies, q, inst, stype, outcome, exitReason, from, to, pnlMin, pnlMax, sortKey, asc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageItems = filtered.slice((page - 1) * PAGE, page * PAGE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(false);
    }
    setPage(1);
  };

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (q) activeFilters.push({ key: "q", label: `"${q}"`, clear: () => setQ("") });
  if (inst !== "all") activeFilters.push({ key: "inst", label: inst, clear: () => setInst("all") });
  if (stype !== "all")
    activeFilters.push({ key: "stype", label: stype, clear: () => setStype("all") });
  if (outcome !== "all")
    activeFilters.push({
      key: "out",
      label: outcome === "win" ? "Wins" : outcome === "loss" ? "Losses" : "Breakeven",
      clear: () => setOutcome("all"),
    });
  if (exitReason !== "all")
    activeFilters.push({ key: "exit", label: exitReason, clear: () => setExitReason("all") });
  if (from) activeFilters.push({ key: "from", label: `From ${from}`, clear: () => setFrom("") });
  if (to) activeFilters.push({ key: "to", label: `To ${to}`, clear: () => setTo("") });
  if (pnlMin)
    activeFilters.push({ key: "pmin", label: `P&L ≥ ${pnlMin}`, clear: () => setPnlMin("") });
  if (pnlMax)
    activeFilters.push({ key: "pmax", label: `P&L ≤ ${pnlMax}`, clear: () => setPnlMax("") });

  // Aggregate stats
  const totalPnl = filtered.reduce((a, s) => a + strategyPnL(s), 0);
  const wins = filtered.filter((s) => strategyPnL(s) > 0).length;
  const losses = filtered.filter((s) => strategyPnL(s) < 0).length;
  const winRate = filtered.length ? Math.round((wins / filtered.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <HistoryIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight leading-none">Trade History</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {filtered.length} of {strategies.length} strategies
              </p>
            </div>
          </div>
          <Link to="/new" search={{ id: undefined }}>
            <Button className="gap-1.5">
              New Entry <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </header>

        {/* Stat strip */}
        {(() => {
          const avg = filtered.length ? Math.round(totalPnl / filtered.length) : 0;
          const items = [
            {
              label: "Strategies",
              value: filtered.length.toString(),
              hint: `${strategies.length} total`,
              icon: <Layers className="h-3.5 w-3.5" />,
              tone: "neutral" as const,
            },
            {
              label: "Net P&L",
              value: fmtINR(totalPnl),
              hint: totalPnl >= 0 ? "In profit" : "In drawdown",
              icon:
                totalPnl >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                ),
              tone: (totalPnl >= 0 ? "profit" : "loss") as "profit" | "loss",
            },
            {
              label: "Win Rate",
              value: `${winRate}%`,
              hint: `${wins}W · ${losses}L`,
              icon: <Target className="h-3.5 w-3.5" />,
              tone: "neutral" as const,
              progress: winRate,
            },
            {
              label: "Avg P&L",
              value: filtered.length ? fmtINR(avg) : "—",
              hint: "per strategy",
              icon: <Sigma className="h-3.5 w-3.5" />,
              tone: (avg >= 0 ? "profit" : "loss") as "profit" | "loss",
            },
          ];
          return (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className={cn(
                      "relative p-5",
                      i % 2 === 1 && "border-l border-border/60 lg:border-l-0",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {it.label}
                      </span>
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md",
                          it.tone === "profit" && "bg-profit/10 text-profit",
                          it.tone === "loss" && "bg-loss/10 text-loss",
                          it.tone === "neutral" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {it.icon}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-3 text-2xl font-semibold tabular-nums tracking-tight",
                        it.tone === "profit" && "text-profit",
                        it.tone === "loss" && "text-loss",
                      )}
                    >
                      {it.value}
                    </div>
                    {it.progress !== undefined ? (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-profit transition-all"
                            style={{ width: `${it.progress}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-muted-foreground">{it.hint}</div>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[11px] text-muted-foreground">{it.hint}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Filter bar */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          {/* Primary row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-10"
                placeholder="Search strategy name..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Select
                value={inst}
                onValueChange={(v: string) => {
                  setInst(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Instrument" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Instruments</SelectItem>
                  {INSTRUMENTS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select
                value={stype}
                onValueChange={(v: string) => {
                  setStype(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  {strategyOptions.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select
                value={outcome}
                onValueChange={(v: string) => {
                  setOutcome(v as typeof outcome);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="win">Wins</SelectItem>
                  <SelectItem value="loss">Losses</SelectItem>
                  <SelectItem value="be">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Button
                variant={showAdvanced ? "secondary" : "outline"}
                className="h-10 w-full px-2"
                onClick={() => setShowAdvanced((v) => !v)}
                title="More filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Advanced row */}
          {showAdvanced && (
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3 pt-1 border-t border-border/60">
              <div className="md:col-span-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  From date
                </label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 mt-1"
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  To date
                </label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  P&L min
                </label>
                <Input
                  type="number"
                  placeholder="-10000"
                  value={pnlMin}
                  onChange={(e) => {
                    setPnlMin(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  P&L max
                </label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={pnlMax}
                  onChange={(e) => {
                    setPnlMax(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Exit reason
                </label>
                <Select
                  value={exitReason}
                  onValueChange={(v: string) => {
                    setExitReason(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    {EXIT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Active filter chips + sort + reset */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeFilters.length === 0 ? (
                <span className="text-xs text-muted-foreground">No filters applied</span>
              ) : (
                activeFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      f.clear();
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 hover:bg-muted px-2.5 py-1 text-xs transition-colors"
                  >
                    {f.label}
                    <X className="h-3 w-3" />
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={sortKey}
                onValueChange={(v) => {
                  setSortKey(v as SortKey);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Sort: Date</SelectItem>
                  <SelectItem value="pnl">Sort: P&L</SelectItem>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="instrument">Sort: Instrument</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5"
                onClick={() => setAsc((v) => !v)}
                title={asc ? "Ascending" : "Descending"}
              >
                {asc ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              </Button>
              {activeFilters.length > 0 && (
                <Button variant="ghost" size="sm" className="h-9" onClick={resetAll}>
                  Reset all
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/60">
                  <Th onClick={() => toggleSort("date")} active={sortKey === "date"} asc={asc}>
                    Date
                  </Th>
                  <Th
                    onClick={() => toggleSort("instrument")}
                    active={sortKey === "instrument"}
                    asc={asc}
                  >
                    Instrument
                  </Th>
                  <Th onClick={() => toggleSort("pnl")} active={sortKey === "pnl"} asc={asc} right>
                    P&L
                  </Th>
                  <th className="px-4 py-3 font-medium text-right">Quantity</th>
                  <th className="px-4 py-3 font-medium text-right">Legs</th>
                  <th className="pl-12 pr-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const groups: { name: string; items: typeof pageItems }[] = [];
                  for (const s of pageItems) {
                    const last = groups[groups.length - 1];
                    if (last && last.name === s.name) last.items.push(s);
                    else groups.push({ name: s.name, items: [s] });
                  }
                  return groups.map((g, gi) => {
                    const groupPnl = g.items.reduce((a, x) => a + strategyPnL(x), 0);
                    return (
                      <React.Fragment key={`${g.name}-${gi}`}>
                        <tr className="bg-muted/30 border-y border-border/60">
                          <td colSpan={6} className="px-4 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span className="font-semibold text-sm text-foreground truncate">
                                  {g.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  · {g.items.length}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-xs font-semibold tabular-nums",
                                  pnlClass(groupPnl),
                                )}
                              >
                                {fmtINR(groupPnl)}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {g.items.map((s) => {
                          const pnl = strategyPnL(s);
                          const qty = s.legs[0]?.quantity ?? 0;
                          return (
                            <tr
                              key={s.id}
                              className="border-b border-border/40 hover:bg-muted/30 transition-colors group"
                            >
                              <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground tabular-nums">
                                <Link
                                  to="/trade/$id"
                                  params={{ id: s.id }}
                                  className="hover:text-primary transition-colors"
                                >
                                  {fmtDate(s.tradeDate)}
                                </Link>
                              </td>
                              <td className="px-4 py-3.5">
                                <Link to="/trade/$id" params={{ id: s.id }} title="View strategy">
                                  <Badge
                                    variant="secondary"
                                    className="font-medium cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                                  >
                                    {s.instrument}
                                  </Badge>
                                </Link>
                              </td>
                              <td
                                className={cn(
                                  "px-4 py-3.5 text-right font-semibold tabular-nums",
                                  pnlClass(pnl),
                                )}
                              >
                                {fmtINR(pnl)}
                              </td>
                              <td className="px-4 py-3.5 text-right text-muted-foreground tabular-nums">
                                {qty}
                              </td>
                              <td className="px-4 py-3.5 text-right text-muted-foreground tabular-nums">
                                {s.legs.length}
                              </td>
                              <td className="pl-12 pr-4 py-3.5 text-right">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                      title="Actions"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-36 p-1">
                                    <Link
                                      to="/trade/$id"
                                      params={{ id: s.id }}
                                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                                    >
                                      <Eye className="h-4 w-4" /> View
                                    </Link>
                                    <Link
                                      to="/new"
                                      search={{ id: s.id }}
                                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                                    >
                                      <Pencil className="h-4 w-4" /> Edit
                                    </Link>
                                    <button
                                      onClick={() => {
                                        if (confirmIfEnabled(`Delete "${s.name}"?`))
                                          removeStrategy(s.id);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" /> Delete
                                    </button>
                                  </PopoverContent>
                                </Popover>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <HistoryIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No strategies found.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Try adjusting your filters.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/20">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <div className="text-xs text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums mt-1.5", valueClass)}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  asc,
  right,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  asc?: boolean;
  right?: boolean;
}) {
  return (
    <th className={cn("px-4 py-3 select-none font-medium", right ? "text-right" : "")}>
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active ? "text-foreground" : "",
        )}
      >
        {children}
        {active && (asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}
