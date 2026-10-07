import { formatTime, type RunAnalysis } from "@speedrunner/core";
import { METRICS, type MetricDoc } from "../explain";
import { formatSave } from "../format";
import { InfoTip } from "./InfoTip";

/**
 * The three comparisons a runner cares about, laid out like a splits panel:
 * name on the left, time on the right, delta against the PB beside it.
 */
export function Summary({ analysis: a }: { analysis: RunAnalysis }) {
  const pb = a.personalBest;
  const delta = (t: number | null) => (pb != null && t != null && t !== pb ? `−${formatSave(pb - t)}` : null);
  return (
    <div className="comparisons" role="table" aria-label="Run comparisons">
      <Row doc={METRICS.personalBest} time={a.personalBest} note="Where you are now" />
      <Row
        doc={METRICS.realisticTarget}
        time={a.realisticTarget}
        delta={delta(a.realisticTarget)}
        note={
          a.realisticTarget == null
            ? "Needs more attempts per segment"
            : "Every segment at your good-day pace"
        }
        lead
      />
      <Row doc={METRICS.sumOfBest} time={a.sumOfBest} delta={delta(a.sumOfBest)} note="Every segment at its gold" />
    </div>
  );
}

function Row({
  doc,
  time,
  delta,
  note,
  lead,
}: {
  doc: MetricDoc;
  time: number | null;
  delta?: string | null;
  note: string;
  lead?: boolean;
}) {
  return (
    <div className={`comparison${lead ? " lead" : ""}`} role="row">
      <div className="comparison-name" role="rowheader">
        <span className="comparison-label">
          {doc.label} <InfoTip doc={doc} />
        </span>
        <span className="comparison-note">{note}</span>
      </div>
      <div className="comparison-delta" role="cell">{delta ?? ""}</div>
      <div className="comparison-time" role="cell">{formatTime(time)}</div>
    </div>
  );
}
