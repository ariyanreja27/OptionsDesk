import { confirmIfEnabled } from "@/lib/confirm";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { strategyPnL } from "@/lib/types";
import type { Strategy } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Import / Export — OptionStats" },
      { name: "description", content: "Backup or restore your local trading journal data." },
    ],
  }),
  component: DataPage,
});

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function strategiesToCSV(list: Strategy[]): string {
  const rows: string[] = [];
  rows.push(
    [
      "id",
      "date",
      "name",
      "instrument",
      "strategy_type",
      "exit_reason",
      "entry_spot",
      "entry_time",
      "exit_time",
      "leg_no",
      "underlying",
      "strike",
      "option_type",
      "action",
      "entry_premium",
      "exit_premium",
      "lot_size",
      "quantity",
      "expiry",
      "leg_pnl",
      "strategy_pnl",
    ].join(","),
  );
  for (const s of list) {
    const sp = strategyPnL(s);
    s.legs.forEach((l, i) => {
      const diff =
        l.action === "SELL" ? l.entryPremium - l.exitPremium : l.exitPremium - l.entryPremium;
      const ls = l.lotSize && l.lotSize > 0 ? l.lotSize : 1;
      const lp = diff * ls * l.quantity;
      rows.push(
        [
          s.id,
          s.tradeDate,
          JSON.stringify(s.name),
          s.instrument,
          s.template ?? s.strategyType ?? "",
          l.exitReason ?? s.exitReason ?? "",
          "",
          l.entryTime ?? "",
          l.exitTime ?? "",
          i + 1,
          l.underlying,
          l.strike,
          l.optionType,
          l.action,
          l.entryPremium,
          l.exitPremium,
          ls,
          l.quantity,
          l.expiry,
          lp,
          sp,
        ].join(","),
      );
    });
  }
  return rows.join("\n");
}

function DataPage() {
  const strategies = useStore((s) => s.strategies);
  const templates = useStore((s) => s.templates);
  const defaultTemplate = useStore((s) => s.defaultTemplate);
  const mergeAll = useStore((s) => s.mergeAll);
  const replaceAll = useStore((s) => s.replaceAll);
  const replaceAllTemplates = useStore((s) => s.replaceAllTemplates);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingMode, setPendingMode] = useState<"merge" | "replace">("merge");

  const [exportOpen, setExportOpen] = useState(false);
  const [exportTrades, setExportTrades] = useState(true);
  const [exportTemplates, setExportTemplates] = useState(true);

  const exportJSON = () => {
    const payload: Record<string, unknown> = { version: 1 };
    if (exportTrades) payload.strategies = strategies;
    if (exportTemplates) {
      payload.templates = templates;
      payload.defaultTemplate = defaultTemplate;
    }

    downloadFile(
      `optionstats-${Date.now()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    toast.success("JSON exported");
    setExportOpen(false);
  };
  const exportCSV = () => {
    downloadFile(`optionstats-${Date.now()}.csv`, strategiesToCSV(strategies), "text/csv");
    toast.success("CSV exported");
  };

  const onFile = async (f: File) => {
    try {
      if (f.size > 10 * 1024 * 1024) throw new Error("File too large");
      const text = await f.text();
      const data = JSON.parse(text);
      const list: unknown = Array.isArray(data) ? data : data?.strategies;
      if (!Array.isArray(list)) throw new Error("Invalid format");
      const { validateStrategy, validateTemplate } = await import("@/lib/validation");
      const valid: Strategy[] = [];
      let invalid = 0;
      for (const item of list) {
        const r = validateStrategy(item as Strategy);
        if (r.ok) valid.push(r.value);
        else invalid++;
      }
      if (valid.length === 0) throw new Error("No valid strategies in file");
      if (pendingMode === "replace") {
        if (
          !confirmIfEnabled(
            `Replace all ${strategies.length} existing strategies with ${valid.length} from file?`,
          )
        )
          return;
        replaceAll(valid);
      } else {
        mergeAll(valid);
      }

      // Restore templates if present in the backup
      let templatesRestored = 0;
      if (Array.isArray(data?.templates) && data.templates.length > 0) {
        const { TEMPLATES } = await import("@/lib/types");
        const validTemplates: import("@/lib/types").StrategyTemplate[] = [];
        for (const tpl of data.templates) {
          const r = validateTemplate(tpl);
          if (r.ok) validTemplates.push(r.value);
        }

        if (validTemplates.length > 0) {
          const defaultName: string =
            typeof data.defaultTemplate === "string"
              ? data.defaultTemplate
              : (validTemplates[0]?.name ?? TEMPLATES[0]?.name ?? "");
          replaceAllTemplates(validTemplates, defaultName);
          templatesRestored = validTemplates.length;
        }
      }

      const parts: string[] = [];
      parts.push(
        invalid > 0
          ? `${valid.length} strategies (${invalid} skipped — invalid)`
          : `${valid.length} strategies`,
      );
      if (templatesRestored > 0) parts.push(`${templatesRestored} templates`);
      toast.success(`Imported ${parts.join(" and ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid backup file");
    }
  };

  const clearAll = () => {
    if (
      confirmIfEnabled(
        `Permanently delete all ${strategies.length} strategies? This cannot be undone.`,
      )
    ) {
      replaceAll([]);
      toast.success("All data cleared");
    }
  };

  return (
    <div className="p-4 md:p-8 pr-6 md:pr-12 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-sm text-muted-foreground">
          Back up or restore your trading journal. Data lives only in this browser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {strategies.length} strategies stored locally.
            </p>
            <div className="space-y-2">
              <Popover open={exportOpen} onOpenChange={setExportOpen}>
                <PopoverTrigger asChild>
                  <Button className="w-full justify-start gap-2">
                    <FileJson className="h-4 w-4" /> Export JSON
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold">Export data</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Choose what to include in the JSON file.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-2.5 cursor-pointer hover:border-primary/40 transition-colors">
                    <Checkbox
                      checked={exportTrades}
                      onCheckedChange={(v: boolean | "indeterminate") =>
                        setExportTrades(v === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-none">Trade Entries</div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {strategies.length} {strategies.length === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-2.5 cursor-pointer hover:border-primary/40 transition-colors">
                    <Checkbox
                      checked={exportTemplates}
                      onCheckedChange={(v: boolean | "indeterminate") =>
                        setExportTemplates(v === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-none">Strategy Templates</div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {templates.length} {templates.length === 1 ? "template" : "templates"}
                      </p>
                    </div>
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setExportOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={exportJSON}
                      disabled={!exportTrades && !exportTemplates}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground pl-1">
                Full backup (all trade details). Use this to restore later or move to another
                browser.
              </p>
            </div>
            <div className="space-y-2">
              <Button
                onClick={exportCSV}
                variant="secondary"
                className="w-full justify-start gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export CSV
              </Button>
              <p className="text-xs text-muted-foreground pl-1">
                Spreadsheet format. Open in Excel / Google Sheets for analysis. Cannot be
                re-imported.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Restore from a JSON backup file.</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setPendingMode("merge");
                  fileRef.current?.click();
                }}
                className="w-full justify-start gap-2"
              >
                <Upload className="h-4 w-4" /> Merge Backup
              </Button>
              <p className="text-xs text-muted-foreground pl-1">
                Add trades from the file to your existing data. Nothing is deleted.
              </p>
            </div>
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setPendingMode("replace");
                  fileRef.current?.click();
                }}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Upload className="h-4 w-4" /> Replace All
              </Button>
              <p className="text-xs text-muted-foreground pl-1">
                Wipe current data and load only what's in the file. Use to fully restore a backup.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-loss/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-loss">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete every strategy stored in this browser.
          </p>
          <Button
            variant="outline"
            className="text-loss border-loss/40 hover:bg-loss/10"
            onClick={clearAll}
          >
            Clear All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
