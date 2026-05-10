import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Strategy, StrategyTemplate } from "./types";
import { TEMPLATES } from "./types";

export interface AppSettings {
  autoNextTradingDay: boolean;
  confirmDeletes: boolean;
  showPnLInSidebar: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoNextTradingDay: true,
  confirmDeletes: true,
  showPnLInSidebar: true,
};

interface State {
  strategies: Strategy[];
  add: (s: Strategy) => void;
  update: (s: Strategy) => void;
  remove: (id: string) => void;
  replaceAll: (list: Strategy[]) => void;
  mergeAll: (list: Strategy[]) => void;
  // Templates
  templates: StrategyTemplate[];
  defaultTemplate: string;
  addTemplate: (t: StrategyTemplate) => void;
  updateTemplate: (originalName: string, t: StrategyTemplate) => void;
  removeTemplate: (name: string) => void;
  setDefaultTemplate: (name: string) => void;
  replaceAllTemplates: (list: StrategyTemplate[], defaultName: string) => void;
  resetStrategies: () => void;
  // Settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
  // Last Trade Date used when CREATING a new entry (edits do NOT update this).
  lastNewEntryTradeDate?: string;
  setLastNewEntryTradeDate: (date: string) => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      strategies: [],
      add: (s) => set((st) => ({ strategies: [s, ...st.strategies] })),
      update: (s) =>
        set((st) => ({ strategies: st.strategies.map((x) => (x.id === s.id ? s : x)) })),
      remove: (id) => set((st) => ({ strategies: st.strategies.filter((x) => x.id !== id) })),
      replaceAll: (list) => set({ strategies: list }),
      mergeAll: (list) =>
        set((st) => {
          const map = new Map(st.strategies.map((s) => [s.id, s]));
          for (const s of list) map.set(s.id, s);
          return { strategies: Array.from(map.values()) };
        }),
      templates: TEMPLATES,
      defaultTemplate: "1.5% SL BNF Strangle",
      addTemplate: (t) =>
        set((st) => {
          if (st.templates.some((x) => x.name === t.name)) return st;
          return { templates: [...st.templates, t] };
        }),
      updateTemplate: (originalName, t) =>
        set((st) => ({
          templates: st.templates.map((x) => (x.name === originalName ? t : x)),
          defaultTemplate: st.defaultTemplate === originalName ? t.name : st.defaultTemplate,
        })),
      removeTemplate: (name) =>
        set((st) => {
          const remaining = st.templates.filter((x) => x.name !== name);
          return {
            templates: remaining,
            defaultTemplate:
              st.defaultTemplate === name ? (remaining[0]?.name ?? "") : st.defaultTemplate,
          };
        }),
      setDefaultTemplate: (name) => set({ defaultTemplate: name }),
      replaceAllTemplates: (list, defaultName) =>
        set({
          templates: list.filter((t) => t.name !== "Custom"),
          defaultTemplate: defaultName,
        }),
      resetStrategies: () => set({ strategies: [] }),
      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      lastNewEntryTradeDate: undefined,
      setLastNewEntryTradeDate: (date) => set({ lastNewEntryTradeDate: date }),
    }),
    {
      name: "options-journal-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : ({
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
              length: 0,
              clear: () => {},
              key: () => null,
            } as Storage),
      ),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // Drop legacy "Custom" template entry — Custom is no longer a template.
        let templates = (
          p.templates && p.templates.length ? p.templates : current.templates
        ).filter((t) => t.name !== "Custom");
        const hasSeed = templates.some((t) => t.name === "1.5% SL BNF Strangle");
        if (!hasSeed) {
          templates = [...templates, ...TEMPLATES.filter((t) => t.name === "1.5% SL BNF Strangle")];
        }
        const defaultTemplate =
          p.defaultTemplate && p.defaultTemplate !== "Custom"
            ? p.defaultTemplate
            : current.defaultTemplate;
        return {
          ...current,
          ...p,
          templates,
          defaultTemplate,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
