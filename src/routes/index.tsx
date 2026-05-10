import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  strategyPnL,
  strategyPremiumCollected,
  strategyCapitalUsed,
  strategyTemplateLabel,
  INSTRUMENTS,
  type Strategy,
} from "@/lib/types";
import { fmtINR, fmtNum, pnlClass } from "@/lib/format";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  PlusCircle,
  BarChart3,
  LineChart as LineIcon,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — OptionDesk" },
      {
        name: "description",
        content: "Analytics overview of your options trading strategy backtests.",
      },
    ],
  }),
  component: Dashboard,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.15)",
} as const;

function Dashboard() {
  const strategies = useStore((s) => s.strategies);
  const templates = useStore((s) => s.templates);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [inst, setInst] = useState("all");
  const [stype, setStype] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [equityMode, setEquityMode] = useState<"line" | "bar">("line");

  const strategyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) if (t.name !== "Custom") set.add(t.name);
    for (const s of strategies) {
      const label = strategyTemplateLabel(s);
      if (label && label !== "Custom") set.add(label);
    }
    return Array.from(set).sort();
  }, [templates, strategies]);

  const filtered = useMemo(() => {
    return strategies.filter((s: Strategy) => {
      if (from && s.tradeDate < from) return false;
      if (to && s.tradeDate > to) return false;
      if (inst !== "all" && s.instrument !== inst) return false;
      if (stype !== "all" && strategyTemplateLabel(s) !== stype) return false;
      const pnl = strategyPnL(s);
      if (outcome === "win" && pnl <= 0) return false;
      if (outcome === "loss" && pnl >= 0) return false;
      return true;
    });
  }, [strategies, from, to, inst, stype, outcome]);

  const stats = useMemo(() => {
    const sorted = [...filtered].sort((a: Strategy, b: Strategy) =>
      a.tradeDate.localeCompare(b.tradeDate),
    );
    const pnls = sorted.map(strategyPnL);
    const total = pnls.reduce((a: number, b: number) => a + b, 0);
    const wins = pnls.filter((p: number) => p > 0);
    const losses = pnls.filter((p: number) => p < 0);

    // Per-day aggregation
    const byDate = new Map<string, number>();
    for (const s of sorted)
      byDate.set(s.tradeDate, (byDate.get(s.tradeDate) ?? 0) + strategyPnL(s));
    const dayPnls = Array.from(byDate.values());
    const winDays = dayPnls.filter((p) => p > 0).length;
    const lossDays = dayPnls.filter((p) => p < 0).length;

    // Streaks (per trade)
    let maxWinStreak = 0,
      maxLossStreak = 0,
      curW = 0,
      curL = 0;
    for (const p of pnls) {
      if (p > 0) {
        curW++;
        curL = 0;
        maxWinStreak = Math.max(maxWinStreak, curW);
      } else if (p < 0) {
        curL++;
        curW = 0;
        maxLossStreak = Math.max(maxLossStreak, curL);
      } else {
        curW = 0;
        curL = 0;
      }
    }

    // Max drawdown from cumulative equity
    let acc = 0,
      peak = 0,
      maxDD = 0;
    for (const p of pnls) {
      acc += p;
      peak = Math.max(peak, acc);
      maxDD = Math.min(maxDD, acc - peak);
    }

    return {
      totalTrades: filtered.length,
      strategies: new Set(filtered.map(strategyTemplateLabel)).size,
      totalPnL: total,
      winRate: filtered.length ? (wins.length / filtered.length) * 100 : 0,
      avgWin: wins.length ? wins.reduce((a: number, b: number) => a + b, 0) / wins.length : 0,
      avgLoss: losses.length
        ? losses.reduce((a: number, b: number) => a + b, 0) / losses.length
        : 0,
      maxWin: pnls.length ? Math.max(...pnls) : 0,
      maxLoss: pnls.length ? Math.min(...pnls) : 0,
      premium: filtered.reduce((a: number, s: Strategy) => a + strategyPremiumCollected(s), 0),
      capital: filtered.reduce((a: number, s: Strategy) => a + strategyCapitalUsed(s), 0),
      wins: wins.length,
      losses: losses.length,
      tradingDays: byDate.size,
      winDays,
      lossDays,
      maxWinStreak,
      maxLossStreak,
      drawdown: maxDD,
    };
  }, [filtered]);

  const equityCurve = useMemo(() => {
    // Aggregate by date (one bar/point per day)
    const byDate = new Map<string, number>();
    for (const s of filtered) {
      byDate.set(s.tradeDate, (byDate.get(s.tradeDate) ?? 0) + strategyPnL(s));
    }
    const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
    let acc = 0;
    return sorted.map(([date, pnl]) => {
      acc += pnl;
      return { date: fmtShortDate(date), equity: acc, pnl };
    });
  }, [filtered]);

  // Offset (0..1) in the chart where equity = 0 sits, used for split gradient.
  const equityZeroOffset = useMemo(() => {
    if (!equityCurve.length) return 1;
    const vals = equityCurve.map((d) => d.equity);
    const max = Math.max(...vals, 0);
    const min = Math.min(...vals, 0);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [equityCurve]);

  const radialWinRate = [
    {
      name: "Win Rate",
      value: stats.winRate,
      fill: stats.winRate >= 50 ? "var(--profit)" : "var(--loss)",
    },
  ];

  const heatmap = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const s of filtered)
      dayMap.set(s.tradeDate, (dayMap.get(s.tradeDate) ?? 0) + strategyPnL(s));
    const today = new Date();
    const months: { year: number; month: number; days: { date: string; pnl: number }[] }[] = [];
    // Last 12 months including current month
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = ref.getFullYear();
      const month = ref.getMonth();
      const last = new Date(year, month + 1, 0).getDate();
      const days: { date: string; pnl: number }[] = [];
      for (let d = 1; d <= last; d++) {
        const dt = new Date(year, month, d);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        days.push({ date: key, pnl: dayMap.get(key) ?? 0 });
      }
      months.push({ year, month, days });
    }
    return months;
  }, [filtered]);

  const heatmapMax = useMemo(() => {
    let m = 1;
    for (const mo of heatmap) for (const d of mo.days) m = Math.max(m, Math.abs(d.pnl));
    return m;
  }, [heatmap]);

  if (strategies.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-10 space-y-6">
        {/* Header — minimal */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Overview
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Performance across all simulated strategies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/history">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <BarChart3 className="h-4 w-4" /> History
              </Button>
            </Link>
            <Link to="/new" search={{ id: undefined }}>
              <Button size="sm" className="gap-1.5 h-9">
                <PlusCircle className="h-4 w-4" /> New Entry
              </Button>
            </Link>
          </div>
        </header>

        {/* Filters — sleek pill bar */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 mt-1 text-sm"
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 mt-1 text-sm"
              />
            </div>
            <div>
              <Label>Instrument</Label>
              <Select value={inst} onValueChange={setInst}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {INSTRUMENTS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Strategy</Label>
              <Select value={stype} onValueChange={setStype}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {strategyOptions.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="win">Wins</SelectItem>
                  <SelectItem value="loss">Losses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-9"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setInst("all");
                  setStype("all");
                  setOutcome("all");
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Compact stats panel */}
        <StatsPanel stats={stats} />

        {/* Charts row 1: Equity area/bar + Radial win rate */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard
            className="lg:col-span-2"
            icon={<LineIcon className="h-4 w-4" />}
            title={equityMode === "line" ? "Equity Curve" : "Daily P&L"}
            subtitle={equityMode === "line" ? "Cumulative P&L over time" : "Per-day net P&L"}
            actions={
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setEquityMode("bar")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    equityMode === "bar"
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Bar
                </button>
                <button
                  type="button"
                  onClick={() => setEquityMode("line")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    equityMode === "line"
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LineIcon className="h-3.5 w-3.5" /> Line
                </button>
              </div>
            }
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {equityMode === "line" ? (
                  <AreaChart data={equityCurve} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--profit)" stopOpacity={0.4} />
                        <stop
                          offset={`${equityZeroOffset * 100}%`}
                          stopColor="var(--profit)"
                          stopOpacity={0.05}
                        />
                        <stop
                          offset={`${equityZeroOffset * 100}%`}
                          stopColor="var(--loss)"
                          stopOpacity={0.05}
                        />
                        <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="eqStroke" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--profit)" />
                        <stop offset={`${equityZeroOffset * 100}%`} stopColor="var(--profit)" />
                        <stop offset={`${equityZeroOffset * 100}%`} stopColor="var(--loss)" />
                        <stop offset="100%" stopColor="var(--loss)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [value, "Equity"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="url(#eqStroke)"
                      strokeWidth={2.5}
                      fill="url(#eqArea)"
                      activeDot={(props: {
                        cx?: number;
                        cy?: number;
                        payload?: { equity?: number };
                      }) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null) return <g />;
                        const color = (payload?.equity ?? 0) >= 0 ? "var(--profit)" : "var(--loss)";
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={color}
                            stroke="var(--background)"
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={equityCurve} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    />
                    <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                      {equityCurve.map((d, i) => (
                        <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            icon={<Target className="h-4 w-4" />}
            title="Win Rate"
            subtitle={`${stats.wins} of ${stats.wins + stats.losses} trades`}
          >
            <div className="h-72 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="100%"
                  data={radialWinRate}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    background={{ fill: "var(--muted)" }}
                    dataKey="value"
                    cornerRadius={20}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div
                  className={cn(
                    "text-4xl font-bold tabular-nums",
                    stats.winRate >= 50 ? "text-profit" : "text-loss",
                  )}
                >
                  {stats.winRate.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Success rate</div>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Heatmap */}
        <ChartCard
          icon={<Activity className="h-4 w-4" />}
          title="Daily Activity"
          subtitle="Last 12 months · daily P&L intensity"
        >
          <div className="pt-2">
            <Heatmap months={heatmap} max={heatmapMax} />
            <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <span>Loss</span>
              <div className="flex gap-0.5">
                {[0.2, 0.45, 0.7, 1].map((o, i) => (
                  <div
                    key={`l${i}`}
                    className="h-3 w-3 rounded-sm"
                    style={{
                      background: `color-mix(in oklab, var(--loss) ${o * 100}%, transparent)`,
                    }}
                  />
                ))}
                <div className="h-3 w-3 rounded-sm bg-muted" />
                {[0.2, 0.45, 0.7, 1].map((o, i) => (
                  <div
                    key={`p${i}`}
                    className="h-3 w-3 rounded-sm"
                    style={{
                      background: `color-mix(in oklab, var(--profit) ${o * 100}%, transparent)`,
                    }}
                  />
                ))}
              </div>
              <span>Profit</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
      {children}
    </label>
  );
}

type DashboardStats = {
  totalPnL: number;
  winRate: number;
  wins: number;
  losses: number;
  totalTrades: number;
  tradingDays: number;
  winDays: number;
  lossDays: number;
  maxWinStreak: number;
  maxLossStreak: number;
  drawdown: number;
  avgWin: number;
  avgLoss: number;
  maxWin: number;
  maxLoss: number;
  premium: number;
  capital: number;
  strategies: number;
};

function StatsPanel({ stats }: { stats: DashboardStats }) {
  const positive = stats.totalPnL >= 0;
  const winRate = Math.max(0, Math.min(100, stats.winRate || 0));

  const groups: {
    title: string;
    items: { label: string; value: string; cls?: string }[];
  }[] = [
    {
      title: "Activity",
      items: [
        { label: "Trading Days", value: fmtNum(stats.tradingDays, 0) },
        { label: "Win Days", value: fmtNum(stats.winDays, 0), cls: "text-profit" },
        { label: "Loss Days", value: fmtNum(stats.lossDays, 0), cls: "text-loss" },
      ],
    },
    {
      title: "Trades",
      items: [
        { label: "Total", value: fmtNum(stats.totalTrades, 0) },
        { label: "Wins", value: fmtNum(stats.wins, 0), cls: "text-profit" },
        { label: "Losses", value: fmtNum(stats.losses, 0), cls: "text-loss" },
      ],
    },
    {
      title: "Streaks & Risk",
      items: [
        { label: "Win Streak", value: fmtNum(stats.maxWinStreak, 0), cls: "text-profit" },
        { label: "Loss Streak", value: fmtNum(stats.maxLossStreak, 0), cls: "text-loss" },
        { label: "Max Drawdown", value: fmtINR(stats.drawdown), cls: "text-loss" },
      ],
    },
    {
      title: "Performance",
      items: [
        { label: "Avg Win", value: fmtINR(stats.avgWin), cls: "text-profit" },
        { label: "Avg Loss", value: fmtINR(stats.avgLoss), cls: "text-loss" },
        { label: "Best Trade", value: fmtINR(stats.maxWin), cls: "text-profit" },
        { label: "Worst Trade", value: fmtINR(stats.maxLoss), cls: "text-loss" },
      ],
    },
  ];

  // Win-rate ring (conic gradient)
  const ringBg = `conic-gradient(var(--profit) ${winRate * 3.6}deg, color-mix(in oklab, var(--muted-foreground) 18%, transparent) 0)`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* Ambient gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: positive
            ? "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--profit) 14%, transparent), transparent 60%)"
            : "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--loss) 14%, transparent), transparent 60%)",
        }}
      />

      {/* Hero row */}
      <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-4 p-5 border-b border-border/60">
        {/* Net P&L */}
        <div className="flex items-center gap-4 lg:flex-1 min-w-0">
          <div
            className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ring-1",
              positive
                ? "bg-profit/15 text-profit ring-profit/25"
                : "bg-loss/15 text-loss ring-loss/25",
            )}
          >
            {positive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Net P&amp;L
            </div>
            <div
              className={cn(
                "text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums leading-none mt-1",
                pnlClass(stats.totalPnL),
              )}
            >
              {fmtINR(stats.totalPnL)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: positive
                    ? "color-mix(in oklab, var(--profit) 14%, transparent)"
                    : "color-mix(in oklab, var(--loss) 14%, transparent)",
                  color: positive ? "var(--profit)" : "var(--loss)",
                }}
              >
                <ArrowUpRight className={cn("h-3 w-3", !positive && "rotate-90")} />
                {positive ? "Net profit" : "Net loss"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                across {fmtNum(stats.totalTrades, 0)} trades
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px bg-border/60" />

        {/* Win rate ring */}
        <div className="flex items-center gap-4 lg:w-[260px]">
          <div
            className="relative h-16 w-16 rounded-full shrink-0 grid place-items-center"
            style={{ background: ringBg }}
          >
            <div className="absolute inset-[5px] rounded-full bg-card grid place-items-center">
              <span className="text-sm font-bold tabular-nums text-profit">
                {winRate.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Win Rate
            </div>
            <div className="text-sm font-medium mt-1">
              <span className="text-profit tabular-nums">{fmtNum(stats.wins, 0)}W</span>
              <span className="text-muted-foreground mx-1.5">·</span>
              <span className="text-loss tabular-nums">{fmtNum(stats.losses, 0)}L</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {fmtNum(stats.tradingDays, 0)} trading days
            </div>
          </div>
        </div>
      </div>

      {/* Grouped metrics */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g, gi) => (
          <div
            key={g.title}
            className={cn(
              "p-4 md:p-5",
              gi !== 0 && "border-t sm:border-t-0 border-border/60",
              gi !== 0 && "sm:border-l",
              gi === 2 && "sm:border-t lg:border-t-0",
            )}
          >
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-3">
              {g.title}
            </div>
            <div className="space-y-2">
              {g.items.map((it) => (
                <div key={it.label} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{it.label}</span>
                  <span className={cn("text-sm font-semibold tabular-nums", it.cls)}>
                    {it.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({
  icon,
  title,
  subtitle,
  children,
  className,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {icon}
            </div>
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-9">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

type HeatmapMonth = { year: number; month: number; days: { date: string; pnl: number }[] };

function Heatmap({ months, max }: { months: HeatmapMonth[]; max: number }) {
  const [active, setActive] = useState<{ date: string; pnl: number; x: number; y: number } | null>(
    null,
  );

  const handleMove = (e: React.MouseEvent, d: { date: string; pnl: number }) => {
    setActive({ date: d.date, pnl: d.pnl, x: e.clientX, y: e.clientY });
  };

  const renderCell = (d: { date: string; pnl: number } | null, key: string) => {
    if (!d) return <div key={key} style={{ width: 12, height: 12 }} />;
    const intensity = Math.abs(d.pnl) / max;
    const color =
      d.pnl === 0
        ? "var(--muted)"
        : d.pnl > 0
          ? `color-mix(in oklab, var(--profit) ${15 + intensity * 85}%, transparent)`
          : `color-mix(in oklab, var(--loss) ${15 + intensity * 85}%, transparent)`;
    const isActive = active?.date === d.date;
    return (
      <button
        key={key}
        type="button"
        onMouseEnter={(e) => handleMove(e, d)}
        onMouseMove={(e) => handleMove(e, d)}
        onMouseLeave={() => setActive((cur) => (cur?.date === d.date ? null : cur))}
        onClick={(e) => handleMove(e, d)}
        aria-label={`${d.date}: ${fmtINR(d.pnl)}`}
        className={cn(
          "rounded-[3px] border transition-transform",
          isActive ? "border-foreground/60 scale-125" : "border-border/30 hover:scale-110",
        )}
        style={{ width: 12, height: 12, background: color }}
      />
    );
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-0 items-start min-w-max">
          {/* Day-of-week labels column */}
          <div className="flex flex-col shrink-0 mr-1.5" style={{ paddingTop: 14 + 6 }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="text-[9px] text-muted-foreground select-none flex items-center justify-end pr-1"
                style={{ height: 12, marginBottom: i < DAY_LABELS.length - 1 ? 3 : 0 }}
              >
                {label}
              </div>
            ))}
          </div>
          {/* Month columns */}
          <div className="flex gap-3 items-start">
            {months.map((m) => {
              // Build weeks (rows) for this month only. First week starts on the Sunday of the row containing day 1.
              const firstDow = new Date(m.year, m.month, 1).getDay(); // 0=Sun
              const totalCells = firstDow + m.days.length;
              const rowCount = Math.ceil(totalCells / 7);
              const rows: ({ date: string; pnl: number } | null)[][] = [];
              for (let r = 0; r < rowCount; r++) {
                const row: ({ date: string; pnl: number } | null)[] = [];
                for (let c = 0; c < 7; c++) {
                  const idx = r * 7 + c - firstDow;
                  row.push(idx >= 0 && idx < m.days.length ? m.days[idx] : null);
                }
                rows.push(row);
              }
              return (
                <div key={`${m.year}-${m.month}`} className="flex flex-col shrink-0">
                  <div
                    className="text-[10px] font-medium text-muted-foreground select-none mb-1.5 text-center"
                    style={{ height: 14, lineHeight: "14px" }}
                  >
                    {MONTH_NAMES[m.month]}
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    {rows.map((row, ri) => (
                      <div key={ri} className="flex gap-[3px]">
                        {row.map((d, ci) => renderCell(d, `${ri}-${ci}`))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating popover near cursor */}
      {active && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover px-3 py-2 shadow-xl"
          style={{
            left: Math.min(
              active.x + 14,
              (typeof window !== "undefined" ? window.innerWidth : 1200) - 200,
            ),
            top: Math.max(active.y - 60, 8),
          }}
        >
          <div className="text-xs font-semibold text-foreground">{formatLongDate(active.date)}</div>
          <div className={cn("text-xs font-medium tabular-nums mt-0.5", pnlClass(active.pnl))}>
            P&L : {active.pnl === 0 ? "—" : fmtINR(active.pnl)}
          </div>
        </div>
      )}
    </div>
  );
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function EmptyState() {
  const features = [
    {
      icon: <LineIcon className="h-4 w-4" />,
      title: "Equity curve",
      desc: "Visualize cumulative P&L over time",
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      title: "Daily P&L breakdown",
      desc: "See win/loss days at a glance",
    },
    {
      icon: <Target className="h-4 w-4" />,
      title: "Win rate & ROI",
      desc: "Track every metric that matters",
    },
  ];
  return (
    <div className="w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-chart-5/15 blur-3xl" />
        <div className="relative p-8 md:p-12">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> OptionDesk Journal
            </div>
            <div className="mt-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shadow-lg shadow-primary/30">
              <TrendingUp className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">
              Start journaling your strategies
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              Record your simulated options strategies and watch professional analytics build
              automatically.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/new" search={{ id: undefined }}>
                <Button size="lg" className="gap-2 h-11 px-6">
                  <PlusCircle className="h-5 w-5" /> Create your first entry
                </Button>
              </Link>
              <Link to="/data">
                <Button size="lg" variant="outline" className="h-11 px-6">
                  Import data
                </Button>
              </Link>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/60 bg-background/40 p-4 backdrop-blur"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  {f.icon}
                </div>
                <div className="mt-3 text-sm font-semibold">{f.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
