import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { confirmIfEnabled } from "@/lib/confirm";
import { useTheme } from "@/lib/theme";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  BookTemplate,
  Database,
  AlertTriangle,
  Star,
  SlidersHorizontal,
  Clock,
  RotateCcw,
  Download,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — OptionStats" },
      { name: "description", content: "Manage your OptionStats preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const templates = useStore((s) => s.templates);
  const defaultTemplate = useStore((s) => s.defaultTemplate);
  const setDefaultTemplate = useStore((s) => s.setDefaultTemplate);
  const strategies = useStore((s) => s.strategies);
  const resetStrategies = useStore((s) => s.resetStrategies);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetSettings = useStore((s) => s.resetSettings);

  const [theme, setTheme] = useTheme();
  const changeTheme = setTheme;

  const wipe = () => {
    if (
      !confirmIfEnabled(
        `This will permanently delete all ${strategies.length} saved trade entries. Continue?`,
      )
    )
      return;
    resetStrategies();
    toast.success("All trade entries cleared");
  };

  const [exportOpen, setExportOpen] = useState(false);
  const [exportTrades, setExportTrades] = useState(true);
  const [exportTemplates, setExportTemplates] = useState(true);

  const runExport = () => {
    if (!exportTrades && !exportTemplates) {
      toast.error("Select at least one option to export");
      return;
    }
    const payload: Record<string, unknown> = {
      version: 1,
      exportedAt: new Date().toISOString(),
    };
    if (exportTrades) payload.strategies = strategies;
    if (exportTemplates) {
      payload.templates = templates;
      payload.defaultTemplate = defaultTemplate;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const parts = [
      exportTrades ? `${strategies.length}-trades` : null,
      exportTemplates ? `${templates.length}-templates` : null,
    ].filter(Boolean);
    a.href = url;
    a.download = `optionstats-${parts.join("-")}-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Export downloaded");
    setExportOpen(false);
  };
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <header className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-none">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Manage preferences and your trade journal.
            </p>
          </div>
        </header>

        {/* Default template */}
        <Section icon={<Star className="h-4 w-4 text-primary" />} title="Default Template">
          <p className="text-sm text-muted-foreground -mt-2">
            Used to pre-fill the New Entry page. Pick{" "}
            <span className="font-medium text-foreground">Custom</span> on New Entry to enter a
            one-off strategy without saving it as a template.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={defaultTemplate} onValueChange={setDefaultTemplate}>
              <SelectTrigger className="h-10 w-[280px]">
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
            <Link to="/templates">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BookTemplate className="h-4 w-4" /> Manage templates
              </Button>
            </Link>
          </div>
        </Section>

        {/* Behavior toggles */}
        <Section icon={<Clock className="h-4 w-4 text-primary" />} title="Behavior">
          <ToggleRow
            label="Auto-advance Trade Date"
            description="When opening New Entry, pre-fill the date with the next trading day after your last entry."
            checked={settings.autoNextTradingDay}
            onChange={(v) => updateSettings({ autoNextTradingDay: v })}
          />
          <ToggleRow
            label="Confirm before deleting"
            description="Show a confirmation prompt before deleting strategies or templates."
            checked={settings.confirmDeletes}
            onChange={(v) => updateSettings({ confirmDeletes: v })}
          />
          <ToggleRow
            label="Show running P&L in sidebar"
            description="Display total P&L across visible strategies in the sidebar header."
            checked={settings.showPnLInSidebar}
            onChange={(v) => updateSettings({ showPnLInSidebar: v })}
          />
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                resetSettings();
                toast.success("Defaults restored");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
            </Button>
          </div>
        </Section>

        {/* Appearance */}
        <Section
          icon={
            theme === "dark" ? (
              <Moon className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-primary" />
            )
          }
          title="Appearance"
        >
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => changeTheme("light")}
            >
              <Sun className="h-4 w-4" /> Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => changeTheme("dark")}
            >
              <Moon className="h-4 w-4" /> Dark
            </Button>
          </div>
        </Section>

        {/* Data */}
        <Section icon={<Database className="h-4 w-4 text-primary" />} title="Data">
          <p className="text-sm text-muted-foreground -mt-2">
            Backup or restore your journal as JSON.
          </p>
          <div className="flex flex-wrap gap-2">
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" /> Export
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
                    onCheckedChange={(v: boolean | "indeterminate") => setExportTrades(v === true)}
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
                    onClick={runExport}
                    disabled={!exportTrades && !exportTemplates}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Link to="/data">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Database className="h-4 w-4" /> Import / advanced
              </Button>
            </Link>
          </div>
        </Section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Permanently delete all {strategies.length} trade entries. Templates and preferences are
            not affected.
          </p>
          <Button variant="destructive" size="sm" onClick={wipe}>
            Clear all trade entries
          </Button>
        </section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
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
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
