import { useStore } from "./store";

/**
 * Prompt the user before a destructive action — but skip the prompt when the
 * "Confirm before deleting" setting is OFF.
 */
export function confirmIfEnabled(message: string): boolean {
  if (typeof window === "undefined") return true;
  const enabled = useStore.getState().settings.confirmDeletes;
  if (!enabled) return true;
  return window.confirm(message);
}
