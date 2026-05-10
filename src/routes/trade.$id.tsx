import { confirmIfEnabled } from "@/lib/confirm";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import {
  legPnL,
  strategyPnL,
  totalLots,
  totalQty,
  strategyPremiumCollected,
  strategyCapitalUsed,
  strategyTemplateLabel,
  strategyExitReason,
} from "@/lib/types";
import { fmtINR, pnlClass } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Layers,
  Package,
  Hash,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  Coins,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trade/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Trade ${params.id} — OptionStats` },
      { name: "description", content: "Detailed view of a saved options trading strategy." },
    ],
  }),
  component: TradeDetails,
});

function TradeDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const strategy = useStore((s) => s.strategies.find((x) => x.id === id));
  const remove = useStore((s) => s.remove);

  if (!strategy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Strategy not found.</p>
          <Link to="/history">
            <Button variant="ghost" className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to history
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const pnl = strategyPnL(strategy);
  const premium = strategyPremiumCollected(strategy);
  const capital = strategyCapitalUsed(strategy);
  const roi = capital > 0 ? (pnl / capital) * 100 : 0;
  const isProfit = pnl >= 0;

  const onDelete = () => {
    if (confirmIfEnabled("Delete this strategy? This cannot be undone.")) {
      remove(strategy.id);
      toast.success("Strategy deleted");
      navigate({ to: "/history" });
    }
  };

  const stats = [
    { label: "Total Legs", value: String(strategy.legs.length), icon: Layers },
    { label: "Total Lots", value: String(totalLots(strategy)), icon: Package },
    { label: "Total Quantity", value: String(totalQty(strategy)), icon: Hash },
    { label: "Premium Collected", value: fmtINR(premium), icon: Coins },
    { label: "Capital Used", value: fmtINR(capital), icon: Wallet },
    {
      label: "Highest Profit",
      value: fmtINR(strategy.highestProfit),
      icon: TrendingUp,
      tone: "profit" as const,
      sub: strategy.highestProfitTime,
    },
    {
      label: "Highest Loss",
      value: fmtINR(strategy.highestLoss),
      icon: TrendingDown,
      tone: "loss" as const,
      sub: strategy.highestLossTime,
    },
    {
      label: "ROI",
      value: roi.toFixed(2) + "%",
      icon: Percent,
      tone: (roi >= 0 ? "profit" : "loss") as "profit" | "loss",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <Link to="/history">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> History
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/new" search={{ id: strategy.id }}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-loss border-loss/30 hover:bg-loss/10 hover:text-loss"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>

        {/* Hero */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-6",
            isProfit
              ? "border-profit/20 bg-gradient-to-br from-profit/5 via-card to-card"
              : "border-loss/20 bg-gradient-to-br from-loss/5 via-card to-card",
          )}
        >
          <div
            className={cn(
              "absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-30",
              isProfit ? "bg-profit" : "bg-loss",
            )}
          />
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <Badge variant="secondary" className="font-medium">
                  {strategy.instrument}
                </Badge>
                {strategyTemplateLabel(strategy) && (
                  <Badge className="font-medium">{strategyTemplateLabel(strategy)}</Badge>
                )}
                {strategyExitReason(strategy) && (
                  <Badge variant="outline" className="font-medium">
                    {strategyExitReason(strategy)}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {strategy.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {strategy.tradeDate}
                </span>
                {(strategy.legs[0]?.entryTime || strategy.legs[0]?.exitTime) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {strategy.legs[0]?.entryTime ?? "—"} → {strategy.legs[0]?.exitTime ?? "—"}
                  </span>
                )}
                {strategy.entrySpot != null && (
                  <span className="inline-flex items-center gap-1.5">
                    Spot{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {strategy.entrySpot}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="md:text-right shrink-0">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Net P&L
              </div>
              <div
                className={cn(
                  "text-4xl md:text-5xl font-bold tabular-nums tracking-tight mt-1",
                  pnlClass(pnl),
                )}
              >
                {fmtINR(pnl)}
              </div>
              <div
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                  pnlClass(roi),
                )}
              >
                {roi >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                ROI {roi.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </span>
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    s.tone === "profit" && "bg-profit/10 text-profit",
                    s.tone === "loss" && "bg-loss/10 text-loss",
                    !s.tone && "bg-muted text-muted-foreground",
                  )}
                >
                  <s.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div
                className={cn(
                  "mt-2.5 text-xl font-semibold tabular-nums tracking-tight",
                  s.tone === "profit" && "text-profit",
                  s.tone === "loss" && "text-loss",
                )}
              >
                {s.value}
              </div>
              {s.sub && <div className="text-[11px] text-muted-foreground mt-1">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Legs */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Option Legs</h2>
              <span className="text-xs text-muted-foreground">· {strategy.legs.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/60">
                  <th className="px-4 py-2.5 font-medium w-10">#</th>
                  <th className="px-4 py-2.5 font-medium">Underlying</th>
                  <th className="px-4 py-2.5 font-medium text-right">Strike</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium text-right">Entry ₹</th>
                  <th className="px-4 py-2.5 font-medium text-right">Exit ₹</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lot × Qty</th>
                  <th className="px-4 py-2.5 font-medium">Expiry</th>
                  <th className="px-4 py-2.5 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {strategy.legs.map((l, i) => {
                  const p = legPnL(l);
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{l.underlying}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.strike}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={l.optionType === "CE" ? "default" : "secondary"}
                          className="font-medium"
                        >
                          {l.optionType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md",
                            l.action === "BUY"
                              ? "bg-primary/10 text-primary"
                              : "bg-chart-4/10 text-chart-4",
                          )}
                        >
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.entryPremium}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.exitPremium}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                        {l.lotSize} × {l.quantity}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{l.expiry}</td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-semibold tabular-nums",
                          pnlClass(p),
                        )}
                      >
                        {fmtINR(p)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Tags */}
        {(strategy.notes || (strategy.tags && strategy.tags.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategy.tags && strategy.tags.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {strategy.tags.map((t) => (
                    <Badge key={t} variant="outline" className="font-medium">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {strategy.notes && (
              <div
                className={cn(
                  "rounded-2xl border border-border bg-card p-5",
                  !(strategy.tags && strategy.tags.length > 0) && "md:col-span-2",
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Notes</h3>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {strategy.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
