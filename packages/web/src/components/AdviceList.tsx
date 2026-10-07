import type { Advice, AdviceKind } from "@speedrunner/core";
import { formatSave } from "../format";
import { revealExplanation } from "./InfoTip";

const LABELS: Record<AdviceKind, string> = {
  "weak-in-pb": "Slow in PB",
  inconsistent: "Inconsistent",
  "gold-is-rare": "Gold is rare",
  "run-killer": "Runs die here",
};

/** Groups advice by segment so each segment appears once, ranked by its best estimate. */
export function AdviceList({ advice }: { advice: Advice[] }) {
  if (advice.length === 0) {
    return <p className="muted">Nothing stands out yet. Do more attempts and check back.</p>;
  }
  const groups = new Map<number, Advice[]>();
  for (const a of advice) groups.set(a.segmentIndex, [...(groups.get(a.segmentIndex) ?? []), a]);
  const ranked = [...groups.values()].slice(0, 6);

  return (
    <>
      <ol className="advice">
        {ranked.map((items) => {
          const top = Math.max(...items.map((i) => i.estimatedSave));
          return (
            <li key={items[0].segmentIndex} className="advice-card">
              <div className="advice-head">
                <strong>{items[0].segmentName}</strong>
                {top > 0 && <span className="advice-worth" title="Estimated time this advice is worth">worth ~{formatSave(top)}</span>}
              </div>
              <ul>
                {items.map((a) => (
                  <li key={a.kind}>
                    <span className="tag">{LABELS[a.kind]}</span> {a.message}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <p className="section-foot">
        <a
          href="#how-advice"
          onClick={(e) => {
            e.preventDefault();
            revealExplanation("advice");
          }}
        >
          When each kind of advice appears
        </a>
      </p>
    </>
  );
}
