export type Instrument = "BANKNIFTY" | "NIFTY50" | "FINNIFTY" | "SENSEX" | "STOCK OPTIONS";
export type StrategyType =
  | "Single Leg"
  | "Iron Condor"
  | "Straddle"
  | "Strangle"
  | "Iron Butterfly"
  | "Custom Multi-leg";
export type ExitReason =
  | "Target Hit"
  | "Stop Loss Hit"
  | "Day End Exit"
  | "Time-based Exit"
  | "Expiry Exit"
  | "Manual Exit";
export type OptionType = "CE" | "PE";
export type Action = "BUY" | "SELL";

export interface OptionLeg {
  id: string;
  underlying: string;
  strike: number;
  optionType: OptionType;
  action: Action;
  entryPremium: number;
  exitPremium: number;
  quantity: number;
  expiry: string;
  entryTime?: string;
  exitTime?: string;
  exitReason?: ExitReason;
  /** legacy field — older entries multiplied lotSize × quantity */
  lotSize?: number;
}

export interface Strategy {
  id: string;
  name: string;
  tradeDate: string;
  instrument: Instrument;
  /** Template used to create this strategy (replaces old strategyType) */
  template?: string;
  legs: OptionLeg[];
  highestProfit: number;
  highestProfitTime: string;
  highestLoss: number;
  highestLossTime: string;
  notes: string;
  createdAt: string;
  // Legacy / optional fields kept for backward compatibility
  entryTime?: string;
  exitTime?: string;
  entrySpot?: number;
  exitReason?: ExitReason;
  strategyType?: StrategyType;
  tags?: string[];
}

export const INSTRUMENTS: Instrument[] = [
  "BANKNIFTY",
  "NIFTY50",
  "FINNIFTY",
  "SENSEX",
  "STOCK OPTIONS",
];
export const STRATEGY_TYPES: StrategyType[] = [
  "Single Leg",
  "Iron Condor",
  "Straddle",
  "Strangle",
  "Iron Butterfly",
  "Custom Multi-leg",
];
export const EXIT_REASONS: ExitReason[] = [
  "Target Hit",
  "Stop Loss Hit",
  "Day End Exit",
  "Time-based Exit",
  "Expiry Exit",
  "Manual Exit",
];

export interface StrategyTemplate {
  name: string;
  instrument?: Instrument;
  legs: Array<Partial<OptionLeg> & { optionType: OptionType; action: Action }>;
}

export const TEMPLATES: StrategyTemplate[] = [
  {
    name: "1.5% SL BNF Strangle",
    instrument: "BANKNIFTY",
    legs: [
      {
        optionType: "CE",
        action: "SELL",
        quantity: 150,
        entryTime: "09:20",
        exitTime: "15:15",
        exitReason: "Time-based Exit",
      },
      {
        optionType: "PE",
        action: "SELL",
        quantity: 150,
        entryTime: "09:20",
        exitTime: "15:15",
        exitReason: "Time-based Exit",
      },
      {
        optionType: "CE",
        action: "BUY",
        quantity: 150,
        entryTime: "09:20",
        exitTime: "15:15",
        exitReason: "Time-based Exit",
      },
      {
        optionType: "PE",
        action: "BUY",
        quantity: 150,
        entryTime: "09:20",
        exitTime: "15:15",
        exitReason: "Time-based Exit",
      },
    ],
  },
];

export const TEMPLATE_NAMES = TEMPLATES.map((t) => t.name);

function legQty(leg: OptionLeg): number {
  // Legacy entries stored lot size & lots; new entries store total qty with lotSize=1 (or undefined)
  const ls = leg.lotSize && leg.lotSize > 0 ? leg.lotSize : 1;
  return ls * leg.quantity;
}

export function legPnL(leg: OptionLeg): number {
  const diff =
    leg.action === "SELL" ? leg.entryPremium - leg.exitPremium : leg.exitPremium - leg.entryPremium;
  return diff * legQty(leg);
}

export function strategyPnL(s: Strategy): number {
  return s.legs.reduce((acc, l) => acc + legPnL(l), 0);
}

export function strategyPremiumCollected(s: Strategy): number {
  return s.legs.reduce((acc, l) => {
    if (l.action === "SELL") return acc + l.entryPremium * legQty(l);
    return acc;
  }, 0);
}

export function strategyCapitalUsed(s: Strategy): number {
  return s.legs.reduce((acc, l) => {
    const notional = l.entryPremium * legQty(l);
    return acc + (l.action === "BUY" ? notional : notional * 0.2);
  }, 0);
}

export function totalLots(s: Strategy): number {
  return s.legs.reduce((a, l) => a + l.quantity, 0);
}

export function totalQty(s: Strategy): number {
  return s.legs.reduce((a, l) => a + legQty(l), 0);
}

/** Primary exit reason of a strategy: prefer leg-level (new), fall back to strategy-level (legacy). */
export function strategyExitReason(s: Strategy): ExitReason {
  if (s.exitReason) return s.exitReason;
  for (const l of s.legs) if (l.exitReason) return l.exitReason;
  return "Time-based Exit";
}

/** Display label for the strategy "kind" — new template name or legacy strategy type. */
export function strategyTemplateLabel(s: Strategy): string {
  return s.template ?? s.strategyType ?? "Custom";
}

/** Advance a YYYY-MM-DD date by one trading day, skipping Sat/Sun. */
export function formatLocalYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Advance a YYYY-MM-DD date by one trading day, skipping Sat/Sun. */
export function nextTradingDay(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return formatLocalYYYYMMDD(d);
}

/** Nearest upcoming Thursday (weekly expiry) on or after `from` (YYYY-MM-DD). */
export function nearestWeeklyThursday(from: string): string {
  const d = new Date(from + "T00:00:00");
  const diff = (4 - d.getDay() + 7) % 7; // Thursday = 4
  d.setDate(d.getDate() + diff);
  return formatLocalYYYYMMDD(d);
}
