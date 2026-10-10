import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type Tab = "overview" | "practise" | "segments" | "sessions" | "how";

export const TABS: { id: Tab; label: string; hash: string }[] = [
  { id: "overview", label: "Overview", hash: "" },
  { id: "practise", label: "Practise", hash: "#practise" },
  { id: "segments", label: "Segments", hash: "#segments" },
  { id: "sessions", label: "Sessions", hash: "#sessions" },
  { id: "how", label: "How it's calculated", hash: "#how-it-works" },
];

export const tabFromHash = (): Tab => TABS.find((t) => t.hash && t.hash === window.location.hash)?.id ?? "overview";
export const panelId = (tab: Tab) => `panel-${tab}`;

/** The run page's sections, one tab each. Arrow keys move between tabs. */
export function RunTabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === value);
    const next =
      e.key === "ArrowRight" ? (i + 1) % TABS.length
      : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : null;
    if (next == null) return;
    e.preventDefault();
    onChange(TABS[next].id);
    list.current?.querySelector<HTMLElement>(`#tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div className="run-tabs" role="tablist" aria-label="Run sections" ref={list} onKeyDown={onKeyDown}>
      {TABS.map((t) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          className="run-tab"
          role="tab"
          aria-selected={value === t.id}
          aria-controls={panelId(t.id)}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** One tab's content. Hidden tabs stay rendered so links can reach into them. */
export function TabPanel({ tab, current, children }: { tab: Tab; current: Tab; children: ReactNode }) {
  return (
    <div className="tab-panel" role="tabpanel" id={panelId(tab)} aria-labelledby={`tab-${tab}`} hidden={tab !== current}>
      {children}
    </div>
  );
}
