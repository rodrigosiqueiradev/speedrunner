import { useEffect, useId, useRef, useState } from "react";
import type { MetricDoc } from "../explain";

/** A small "?" button that explains a metric and links to its full explanation. */
export function InfoTip({ doc }: { doc: MetricDoc }) {
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
        ?
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

/** Opens a metric's entry in the How it works section and scrolls to it. */
export function revealExplanation(id: string) {
  const el = document.getElementById(`how-${id}`);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.querySelector("summary")?.focus({ preventScroll: true });
}
