import { useLayoutEffect } from "react";
import type { AppConfig } from "./schema";
import { useSettings } from "./store";
export function applyTheme(c: AppConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = c.interface.theme;
  root.dataset.density = c.interface.density;
  root.dataset.characters = c.interface.characters ? "on" : "off";
  root.dataset.decorations = c.interface.decorations ? "on" : "off";
  root.dataset.animations = c.interface.animations ? "on" : "off";
  root.dataset.rewardAnimations = c.game.rewardAnimations ? "on" : "off";
  root.dataset.showProgress = c.lessons.showProgress ? "on" : "off";
  root.dataset.levels = c.game.levels ? "on" : "off";
  root.dataset.points = c.scoring.enabled ? "on" : "off";
  root.dataset.accent = c.interface.accent;
  root.dataset.welcome = c.content.showWelcome ? "on" : "off";
  root.dataset.recommendations = c.content.recommendations ? "on" : "off";
  root.dataset.banners = c.content.banners ? "on" : "off";
  root.dataset.demos = c.content.showDemos ? "on" : "off";
  for (const [key, value] of Object.entries(c.content.sections))
    root.setAttribute("data-nav-" + key, value ? "on" : "off");
  root.dataset.ranking = c.game.ranking ? "on" : "off";
  root.dataset.achievements = c.game.achievements ? "on" : "off";
  root.dataset.certificates = c.game.certificates ? "on" : "off";
  root.style.colorScheme = ["dark", "finance"].includes(c.interface.theme)
    ? "dark"
    : "light";
}
export function useTheme() {
  const c = useSettings();
  useLayoutEffect(() => applyTheme(c), [c]);
}
