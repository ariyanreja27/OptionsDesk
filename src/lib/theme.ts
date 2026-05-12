import { useEffect, useState } from "react";

export const THEME_KEY = "optionstats:theme";
export type Theme = "light" | "dark";

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.classList.toggle("light", t === "light");
}

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_KEY) as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

/** Write a new theme to localStorage and notify all listeners in this window. */
export function setPersistedTheme(t: Theme) {
  window.localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
  // Dispatch a storage event so other components using useTheme() stay in sync.
  window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: t }));
}

/** Hook that reads theme from localStorage and re-renders on any external change. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    // Apply on first mount
    applyTheme(theme);
    const handler = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [theme, setPersistedTheme];
}
