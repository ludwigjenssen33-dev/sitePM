import { useSyncExternalStore } from "react";
import {
  cloneConfig,
  defaults,
  parseSettings,
  settingsExport,
  settingsKey,
  type AppConfig,
} from "./schema";
function read() {
  try {
    const raw = localStorage.getItem(settingsKey);
    if (raw) return parseSettings(JSON.parse(raw));
    const old = localStorage.getItem("product-lab-settings-v1");
    return old ? parseSettings(JSON.parse(old)) : cloneConfig();
  } catch {
    return cloneConfig();
  }
}
let current: AppConfig = read();
const listeners = new Set<() => void>();
export const getSettings = () => current;
export function saveSettings(value: unknown) {
  const next = parseSettings(value);
  localStorage.setItem(settingsKey, JSON.stringify(settingsExport(next)));
  current = next;
  listeners.forEach((f) => f());
  return next;
}
export function resetSettings() {
  localStorage.removeItem(settingsKey);
  localStorage.removeItem("product-lab-settings-v1");
  current = cloneConfig();
  listeners.forEach((f) => f());
  return current;
}
export function useSettings() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSettings,
    () => defaults,
  );
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === settingsKey || e.key === null) {
      current = read();
      listeners.forEach((f) => f());
    }
  });
