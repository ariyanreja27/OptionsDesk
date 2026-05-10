export function fmtINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return sign + "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function fmtNum(n: number, d = 2): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}

export function pnlClass(n: number): string {
  if (n > 0) return "text-profit";
  if (n < 0) return "text-loss";
  return "text-muted-foreground";
}
