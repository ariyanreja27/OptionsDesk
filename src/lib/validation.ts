import { z } from "zod";
import type { Strategy, OptionLeg } from "./types";
import { INSTRUMENTS, EXIT_REASONS } from "./types";

/**
 * Sanitize a free-text user input.
 * - Strips control chars
 * - Removes <script>/<style> blocks and HTML tags
 * - Removes javascript:/data: protocol fragments
 * - Trims and caps length
 *
 * The journal is local-only, but sanitized data is still safer if the user
 * later imports it elsewhere or if we ever render notes as HTML.
 */
export function sanitizeText(input: unknown, maxLen = 5000): string {
  if (typeof input !== "string") return "";
  let s = input;
  // Strip script/style blocks entirely
  s = s.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  // Strip remaining HTML tags
  s = s.replace(/<\/?[a-z][\s\S]*?>/gi, "");
  // Neutralize dangerous URL schemes
  s = s.replace(/javascript:/gi, "").replace(/data:text\/html/gi, "");
  // Strip on*= event handlers if any survived
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove control chars (keep \n \r \t)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Sanitize a short identifier-ish string (names, labels). */
export function sanitizeName(input: unknown, maxLen = 120): string {
  return sanitizeText(input, maxLen).replace(/[\r\n\t]+/g, " ");
}

/** Coerce a value to a finite non-negative number, or undefined. */
export function toNonNegative(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

/** Coerce to a finite non-positive number (for losses). */
export function toNonPositive(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return 0;
  return n > 0 ? 0 : n;
}

const positiveNum = z
  .number({ invalid_type_error: "Must be a number" })
  .finite("Must be a finite number")
  .nonnegative("Cannot be negative");

const requiredPositive = positiveNum.refine((n) => n > 0, "Required");

export const legSchema = z.object({
  id: z.string(),
  underlying: z.string().min(1).max(40),
  strike: requiredPositive,
  optionType: z.enum(["CE", "PE"]),
  action: z.enum(["BUY", "SELL"]),
  entryPremium: requiredPositive,
  exitPremium: positiveNum,
  quantity: requiredPositive,
  expiry: z.string().min(1, "Expiry required"),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  exitReason: z.enum(EXIT_REASONS as unknown as [string, ...string[]]).optional(),
  lotSize: z.number().nonnegative().optional(),
});

export const strategySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(3, "Strategy name must be at least 3 characters").max(120),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid trade date"),
  instrument: z.enum(INSTRUMENTS as unknown as [string, ...string[]]),
  template: z.string().max(120).optional(),
  legs: z.array(legSchema).min(1, "Add at least one leg"),
  highestProfit: z.number().finite().nonnegative("Profit cannot be negative").max(1e12),
  highestProfitTime: z.string().max(10).optional().or(z.literal("")),
  highestLoss: z.number().finite().nonpositive("Loss cannot be positive").min(-1e12),
  highestLossTime: z.string().max(10).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
  createdAt: z.string(),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  entrySpot: z.number().optional(),
  exitReason: z.enum(EXIT_REASONS as unknown as [string, ...string[]]).optional(),
  strategyType: z.string().optional(),
  tags: z.array(z.string().max(40)).optional(),
});

export type ValidatedStrategy = z.infer<typeof strategySchema>;

/**
 * Validate + sanitize a strategy before persisting. Returns either a clean
 * strategy or a list of human-readable errors.
 */
export function validateStrategy(
  input: Strategy,
): { ok: true; value: Strategy } | { ok: false; errors: string[] } {
  // Pre-sanitize text fields
  const cleaned: Strategy = {
    ...input,
    name: sanitizeName(input.name),
    notes: sanitizeText(input.notes ?? ""),
    template: input.template ? sanitizeName(input.template) : input.template,
    legs: input.legs.map((l) => ({
      ...l,
      underlying: sanitizeName(l.underlying, 40),
    })),
  };

  const result = strategySchema.safeParse(cleaned);
  if (!result.success) {
    const errors = result.error.issues.map((i) => {
      const path = i.path.join(".");
      // Friendlier leg messages
      if (path.startsWith("legs.")) {
        const idx = Number(i.path[1]);
        const field = i.path[2];
        return `Leg ${idx + 1} ${field}: ${i.message}`;
      }
      return path ? `${path}: ${i.message}` : i.message;
    });
    return { ok: false, errors };
  }
  return { ok: true, value: cleaned };
}

/** Lightweight check used to validate a single leg's required numeric fields. */
export function legHasRequiredNumbers(l: OptionLeg): boolean {
  return (
    Number.isFinite(l.strike) &&
    l.strike > 0 &&
    Number.isFinite(l.quantity) &&
    l.quantity > 0 &&
    Number.isFinite(l.entryPremium) &&
    l.entryPremium > 0 &&
    Number.isFinite(l.exitPremium) &&
    l.exitPremium >= 0
  );
}

export const templateLegSchema = z.object({
  id: z.string().optional(),
  underlying: z.string().max(40).optional(),
  strike: positiveNum.optional(),
  optionType: z.enum(["CE", "PE"]),
  action: z.enum(["BUY", "SELL"]),
  entryPremium: positiveNum.optional(),
  exitPremium: positiveNum.optional(),
  quantity: positiveNum.optional(),
  expiry: z.string().optional(),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  exitReason: z.enum(EXIT_REASONS as unknown as [string, ...string[]]).optional(),
  lotSize: z.number().nonnegative().optional(),
});

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Template name required").max(120),
  instrument: z.enum(INSTRUMENTS as unknown as [string, ...string[]]).optional(),
  legs: z.array(templateLegSchema).min(1, "Template must have at least one leg"),
});

export function validateTemplate(
  input: unknown,
): { ok: true; value: import("./types").StrategyTemplate } | { ok: false; errors: string[] } {
  if (typeof input !== "object" || input === null) return { ok: false, errors: ["Invalid object"] };

  const cleaned = {
    ...(input as Record<string, unknown>),
    name: sanitizeName((input as Record<string, unknown>).name),
  };

  const result = templateSchema.safeParse(cleaned);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return { ok: false, errors };
  }
  return { ok: true, value: result.data as import("./types").StrategyTemplate };
}
