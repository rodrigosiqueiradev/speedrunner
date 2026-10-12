import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { deriveCustomTheme, type ColourScheme } from "../customTheme";
import {
  PALETTES,
  THEME_OPTIONS,
  activeScheme,
  saveCustom,
  savePalette,
  saveTheme,
  savedCustom,
  savedPalette,
  savedTheme,
  type CustomColours,
  type Palette,
  type Theme,
} from "../theme";
import { Toggle } from "./Controls";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The footer's Appearance control: mode, a palette, and an optional custom theme. */
export function Appearance() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Theme>(savedTheme);
  const [palette, setPalette] = useState<Palette>(savedPalette);
  const [custom, setCustom] = useState<CustomColours | null>(savedCustom);
  const [scheme, setScheme] = useState<ColourScheme>(activeScheme);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const modeId = useId();
  const dialogId = useId();

  useEffect(() => {
    const sync = () => {
      setMode(savedTheme());
      setPalette(savedPalette());
      setCustom(savedCustom());
      setScheme(activeScheme());
    };
    window.addEventListener("storage", sync);
    let media: MediaQueryList | null = null;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", sync);
    } catch {
      // The note still follows the mode chosen in this window.
    }
    return () => {
      window.removeEventListener("storage", sync);
      media?.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!panel || !button) return;

    const place = () => {
      const bounds = button.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 32);
      const left = Math.max(8, Math.min(bounds.left + bounds.width / 2 - width / 2, window.innerWidth - width - 8));
      const top = Math.max(8, bounds.top - 8 - panel.offsetHeight);
      panel.style.width = `${width}px`;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    place();
    panel.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();

    const close = () => {
      setOpen(false);
      button.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>("button, input, [href]")].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.contains(target) && !button.contains(target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current || !buttonRef.current) return;
    const bounds = buttonRef.current.getBoundingClientRect();
    const panel = panelRef.current;
    const width = Math.min(280, window.innerWidth - 32);
    const left = Math.max(8, Math.min(bounds.left + bounds.width / 2 - width / 2, window.innerWidth - width - 8));
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(8, bounds.top - 8 - panel.offsetHeight)}px`;
  }, [open, palette, custom]);

  const chip = chipBackground(palette, custom);
  const derived = palette === "custom" && custom ? deriveCustomTheme(custom.accent, custom.tint, scheme) : null;
  const caption = palette === "custom" ? "Custom" : PALETTES.find((item) => item.id === palette)?.label;

  const choosePalette = (next: Exclude<Palette, "custom">) => {
    savePalette(next);
    setPalette(next);
  };

  const onSwatchKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowUp" && key !== "Home" && key !== "End") return;
    event.preventDefault();
    const ids = PALETTES.map((item) => item.id);
    const focused = (event.target as HTMLElement).dataset.paletteId;
    const current = ids.indexOf((focused ?? (palette === "custom" ? "speedrunner" : palette)) as (typeof ids)[number]);
    let nextIndex = current;
    if (key === "Home") nextIndex = 0;
    else if (key === "End") nextIndex = ids.length - 1;
    else if (current < 0) nextIndex = key === "ArrowLeft" || key === "ArrowUp" ? ids.length - 1 : 0;
    else if (key === "ArrowRight" || key === "ArrowDown") nextIndex = (current + 1) % ids.length;
    else nextIndex = (current - 1 + ids.length) % ids.length;
    const next = ids[nextIndex];
    if (!next) return;
    choosePalette(next);
    panelRef.current?.querySelector<HTMLElement>(`[data-palette-id="${next}"]`)?.focus();
  };

  const updateCustom = (next: CustomColours) => {
    saveCustom(next);
    setCustom(next);
    if (palette === "custom") savePalette("custom");
  };

  return (
    <span className="appearance">
      <button
        ref={buttonRef}
        type="button"
        className="appearance-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={chip ? "appearance-chip" : "appearance-chip appearance-chip-contrast"} style={chip ? { background: chip } : undefined} aria-hidden="true" />
        Appearance
      </button>
      {open && (
        <div ref={panelRef} id={dialogId} className="appearance-panel" role="dialog" aria-labelledby={titleId}>
          <p id={titleId} className="appearance-title">
            Appearance
          </p>
          <div className="appearance-field">
            <span id={modeId} className="appearance-label">
              Mode
            </span>
            <Toggle
              small
              labelledBy={modeId}
              options={THEME_OPTIONS}
              value={mode}
              onChange={(next) => {
                saveTheme(next);
                setMode(next);
                setScheme(activeScheme());
              }}
            />
          </div>
          <div className="appearance-field">
            <span className="appearance-label">Theme</span>
            <div className="appearance-swatches" role="radiogroup" aria-label="Theme" onKeyDown={onSwatchKey}>
              {PALETTES.map((item) => {
                const selected = palette === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={item.label}
                    tabIndex={selected || (palette === "custom" && item.id === "speedrunner") ? 0 : -1}
                    data-palette-id={item.id}
                    className={item.id === "contrast" ? "appearance-swatch appearance-swatch-contrast" : "appearance-swatch"}
                    style={item.id === "contrast" ? undefined : { background: item.lightFill }}
                    onClick={() => choosePalette(item.id)}
                  />
                );
              })}
            </div>
            <p className="appearance-caption">{caption}</p>
            <button
              type="button"
              className="link-button text-link appearance-custom-button"
              aria-pressed={palette === "custom"}
              onClick={() => {
                if (palette === "custom") return;
                const accent = PALETTES.find((item) => item.id === palette)?.accent ?? "#2a78d6";
                const next = { accent, tint: null };
                saveCustom(next);
                savePalette("custom");
                setCustom(next);
                setPalette("custom");
              }}
            >
              Custom…
            </button>
          </div>
          {palette === "custom" && custom && (
            <div className="appearance-pickers">
              <ColourField label="Accent" value={custom.accent} onChange={(accent) => updateCustom({ accent, tint: custom.tint })} />
              <label className="appearance-tint">
                <input
                  type="checkbox"
                  checked={custom.tint !== null}
                  onChange={(event) => updateCustom({ accent: custom.accent, tint: event.target.checked ? custom.accent : null })}
                />
                Tint the page
              </label>
              {custom.tint !== null && (
                <ColourField label="Tint" value={custom.tint} onChange={(tint) => updateCustom({ accent: custom.accent, tint })} />
              )}
              {derived?.adjusted && (
                <p className="appearance-note" aria-live="polite">
                  Adjusted so text stays readable.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

function chipBackground(palette: Palette, custom: CustomColours | null): string | null {
  if (palette === "contrast") return null;
  if (palette === "custom") {
    if (!custom) return PALETTES[0].lightFill;
    return deriveCustomTheme(custom.accent, custom.tint, "light").tokens["--accent-fill"];
  }
  return PALETTES.find((item) => item.id === palette)?.lightFill ?? null;
}

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <span className="appearance-colour">
      <span className="appearance-colour-label">{label}</span>
      <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value.toLowerCase())} />
      <input
        className="appearance-hex"
        aria-label={`${label} hex`}
        value={draft}
        maxLength={7}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (HEX.test(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
      />
    </span>
  );
}
