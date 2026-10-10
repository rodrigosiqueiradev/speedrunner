import { useEffect, useId, useRef, useState } from "react";
import type { MetricDoc } from "../explain";
import { InfoIcon } from "./Icons";

/** What a tooltip needs from a metric's explanation. */
export type TipDoc = Pick<MetricDoc, "id" | "label" | "short">;

/** A small "?" button that explains a metric and links to its full explanation. */
export function InfoTip({ doc }: { doc: TipDoc }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span className="infotip" ref={ref}>
      <button
        type="button"
        className="infotip-button"
        aria-label={`How is ${doc.label} calculated?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <InfoIcon />
      </button>
      {open && (
        <span className="infotip-panel" id={id} role="note">
          <span>{doc.short}</span>
          <a
            href={`#how-${doc.id}`}
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              revealExplanation(doc.id);
            }}
          >
            How it's calculated
          </a>
        </span>
      )}
    </span>
  );
}

/** Fired with a tab panel's id when something inside that hidden panel needs to be shown. */
export const SHOW_PANEL = "speedrunner:show-panel";

/** Opens a metric's entry in the How it works section and scrolls to it. */
export function revealExplanation(id: string) {
  const el = document.getElementById(`how-${id}`);
  if (!el) return;
  const panel = el.closest<HTMLElement>("[role=tabpanel]");
  if (panel?.hidden) window.dispatchEvent(new CustomEvent(SHOW_PANEL, { detail: panel.id }));
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.querySelector("summary")?.focus({ preventScroll: true });
}
