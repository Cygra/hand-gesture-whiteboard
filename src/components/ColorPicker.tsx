import { useState, type CSSProperties } from "react";
import { DRAWING_COLORS } from "@/lib/colors";
import type { UiText } from "@/lib/i18n";
import type { Locale, ThemeMode } from "@/lib/types";

type ColorPickerProps = {
  selectedColor: string | null;
  onChange: (color: string | null) => void;
  locale: Locale;
  themeMode: ThemeMode;
  text: UiText;
};

export function ColorPicker({ selectedColor, onChange, locale, themeMode, text }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState("#7899ba");
  const preset = DRAWING_COLORS.find(({ hex }) => hex === selectedColor?.toLowerCase());
  const isCustom = selectedColor !== null && !preset;
  const activeName = selectedColor === null
    ? text.colorRandom
    : preset?.name[locale] ?? text.colorCustom;

  return (
    <div className="color-picker" data-theme={themeMode}>
      <div className="color-picker__header">
        <span className="color-picker__label">{text.colorLabel}</span>
        <span className="color-picker__value" aria-live="polite">
          {activeName}
          {selectedColor && <span className="color-picker__hex">{selectedColor.toUpperCase()}</span>}
        </span>
      </div>
      <div className="color-picker__swatches" role="group" aria-label={text.colorLabel}>
        <button
          type="button"
          className="color-swatch color-swatch--random"
          title={text.colorRandom}
          aria-label={text.colorRandom}
          aria-pressed={selectedColor === null}
          onClick={() => onChange(null)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m12 5 1.8 5.2L19 12l-5.2 1.8L12 19l-1.8-5.2L5 12l5.2-1.8L12 5Z" fill="currentColor" />
          </svg>
        </button>
        {DRAWING_COLORS.map(({ hex, name }) => (
          <button
            type="button"
            key={hex}
            className="color-swatch color-swatch--preset"
            style={{ "--swatch-color": hex } as CSSProperties}
            title={`${name[locale]} · ${hex.toUpperCase()}`}
            aria-label={name[locale]}
            aria-pressed={preset?.hex === hex}
            onClick={() => onChange(hex)}
          />
        ))}
        <label
          className="color-swatch color-swatch--custom"
          data-selected={isCustom}
          title={text.colorCustom}
          style={{ "--swatch-color": isCustom ? selectedColor : "transparent" } as CSSProperties}
        >
          <input
            type="color"
            aria-label={text.colorCustom}
            value={isCustom ? selectedColor : customColor}
            onChange={(event) => {
              setCustomColor(event.target.value);
              onChange(event.target.value);
            }}
          />
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </label>
      </div>
    </div>
  );
}
