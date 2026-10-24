import { Palette } from "lucide-react";
import { themeNames, type ThemeId } from "../config/schema";
import { saveSettings, useSettings } from "../config/store";
export default function ThemeSwitch() {
  const c = useSettings();
  return (
    <label className="theme-switch">
      <Palette size={17} />
      <span className="sr-only">Тема оформления</span>
      <select
        aria-label="Тема оформления"
        value={c.interface.theme}
        onChange={(e) => {
          try {
            saveSettings({
              ...c,
              interface: { ...c.interface, theme: e.target.value as ThemeId },
            });
          } catch {
            /* Existing settings remain active if storage is unavailable. */
          }
        }}
      >
        {Object.entries(themeNames).map(([id, title]) => (
          <option key={id} value={id}>
            {title.replace("Product Lab ", "")}
          </option>
        ))}
      </select>
    </label>
  );
}
