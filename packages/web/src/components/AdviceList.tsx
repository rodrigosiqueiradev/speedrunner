import { type Advice, type AdviceKind } from "@speedrunner/core";
import { formatSave } from "../format";

const LABELS: Record<AdviceKind, string> = {
  "weak-in-pb": "Slow in PB",
  inconsistent: "Inconsistent",
  "gold-is-rare": "Gold is rare",
  "run-killer": "Runs die here",
};

export function AdviceList({ advice }: { advice: Advice[] }) {
  if (advice.length === 0) {
    return <p className="muted">Nothing stands out yet. Do more attempts and check back.</p>;
  }
  return (
    <ol className="advice">
      {advice.slice(0, 10).map((a, i) => (
        <li key={`${a.segmentIndex}-${a.kind}-${i}`}>
          <div className="advice-head">
            <span className={`tag ${a.kind}`}>{LABELS[a.kind]}</span>
            <strong>{a.segmentName}</strong>
            {a.estimatedSave > 0 && <span className="muted">~{formatSave(a.estimatedSave)}</span>}
          </div>
          <p>{a.message}</p>
        </li>
      ))}
    </ol>
  );
}
