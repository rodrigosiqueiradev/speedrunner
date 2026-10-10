import type { Advice, AdviceKind } from "@speedrunner/core";
import { formatSave } from "../format";
import { revealExplanation } from "./InfoTip";

const LABELS: Record<AdviceKind, string> = {
  "weak-in-pb": "Slow in PB",
  inconsistent: "Inconsistent",
  "gold-is-rare": "Gold is rare",
  "run-killer": "Runs die here",
};

/**
 * A ranked list: one row per segment, ordered by the most time any of its advice is worth.
 * With onMore, it shows the first few rows and a link to the full list instead of the rules link.
 */
export function AdviceList({
  advice,
  onSelect,
  limit = 6,
  onMore,
}: {
  advice: Advice[];
  onSelect: (index: number) => void;
  limit?: number;
  onMore?: () => void;
}) {
  if (advice.length === 0) {
    return (
      <p className="empty-note">
        Nothing stands out yet. Advice appears once segments have at least a handful of attempts each.
      </p>
    );
  }
  const groups = new Map<number, Advice[]>();
  for (const a of advice) groups.set(a.segmentIndex, [...(groups.get(a.segmentIndex) ?? []), a]);
  const all = [...groups.values()].slice(0, 6);
  const ranked = all.slice(0, limit);

  return (
    <>
      <ol className="advice">
        {ranked.map((items, rank) => {
          const top = Math.max(...items.map((i) => i.estimatedSave));
          return (
            <li key={items[0].segmentIndex} className="advice-row">
              <span className="advice-rank" aria-hidden>
                {rank + 1}
              </span>
              <div className="advice-main">
                <div className="advice-head">
                  <button className="link-button advice-name" onClick={() => onSelect(items[0].segmentIndex)}>
                    {items[0].segmentName}
                  </button>
                  <span className="advice-tags">
                    {items.map((a) => (
                      <span key={a.kind} className={`tag ${a.kind}`}>
                        {LABELS[a.kind]}
                      </span>
                    ))}
                  </span>
                </div>
                <ul className="advice-reasons">
                  {items.map((a) => (
                    <li key={a.kind}>{a.message}</li>
                  ))}
                </ul>
              </div>
              {top > 0 && (
                <span className="advice-worth" title="Estimated time this advice is worth">
                  ~{formatSave(top)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {onMore ? (
        all.length > ranked.length && (
          <p className="section-foot">
            <button className="link-button text-link" onClick={onMore}>
              See all {all.length} and a practice plan
            </button>
          </p>
        )
      ) : (
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
      )}
    </>
  );
}
