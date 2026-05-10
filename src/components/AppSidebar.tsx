import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Database,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  BookTemplate,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { strategyPnL } from "@/lib/types";
import { fmtINR, pnlClass } from "@/lib/format";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "New Entry", url: "/new", icon: PlusCircle },
  { title: "Trade History", url: "/history", icon: History },
  { title: "Templates", url: "/templates", icon: BookTemplate },
  { title: "Import / Export", url: "/data", icon: Database },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const showPnL = useStore((s) => s.settings.showPnLInSidebar);
  const strategies = useStore((s) => s.strategies);
  const totalPnL = strategies.reduce((a, s) => a + strategyPnL(s), 0);
  // Avoid SSR/CSR mismatch — persisted store hydrates only on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Sidebar collapsible="icon" className="relative">
      <SidebarHeader>
        <Link
          to="/"
          className={cn("flex items-center gap-2 py-3", collapsed ? "px-0 justify-center" : "px-2")}
          title="OptionDesk"
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-5 shadow-lg shadow-primary/30 shrink-0",
              collapsed ? "h-8 w-8" : "h-9 w-9",
            )}
          >
            <TrendingUp
              className={cn(collapsed ? "h-4 w-4" : "h-5 w-5", "text-primary-foreground")}
            />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">OptionDesk</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Trading Journal
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(collapsed && "justify-center h-10")}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className={cn(collapsed ? "!h-5 !w-5" : "h-4 w-4")} />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {mounted && showPnL && !collapsed && (
        <div className="px-3 py-2 mt-auto border-t border-border/60">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total P&L
          </div>
          <div className={cn("text-sm font-semibold tabular-nums", pnlClass(totalPnL))}>
            {fmtINR(totalPnL)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {strategies.length} {strategies.length === 1 ? "strategy" : "strategies"}
          </div>
        </div>
      )}

      {/* Edge-attached arrow toggle */}
      {!isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-20 -right-3 z-30 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition-all hover:bg-primary hover:text-primary-foreground hover:scale-110"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}
    </Sidebar>
  );
}
