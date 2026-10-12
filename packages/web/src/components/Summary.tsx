import { formatTime, type RunAnalysis } from "@speedrunner/core";
import { METRICS, luckChance } from "../explain";
import { formatSave } from "../format";
import { StatRow } from "./Metric";

/**
 * The three comparisons a runner cares about, laid out like a splits panel:
 * name on the left, time on the right, delta against the PB beside it.
 */
export function Summary({ analysis: a }: { analysis: RunAnalysis }) {
  const pb = a.personalBest;
  const delta = (t: number | null) => (pb != null && t != null && t !== pb ? `−${formatSave(pb - t)}` : null);
  return (
    <div className="comparisons" role="table" aria-label="Run comparisons">
      <StatRow doc={METRICS.personalBest} value={formatTime(a.personalBest)} note="Where you are now" />
      <StatRow
        doc={METRICS.realisticTarget}
        value={formatTime(a.realisticTarget)}
        delta={delta(a.realisticTarget)}
        note={
          a.realisticTarget == null
            ? "Needs a PB with a final time"
            : "Every segment at your good-day pace"
        }
        lead
      />
      <StatRow
        doc={METRICS.sumOfBest}
        value={formatTime(a.sumOfBest)}
        delta={delta(a.sumOfBest)}
        note={
          a.luckNeeded
            ? `Every segment at its gold, needing good luck in ${a.luckNeeded.segments} segment${a.luckNeeded.segments === 1 ? "" : "s"} (${luckChance(a.luckNeeded.chance)} of runs get it)`
            : "Every segment at its gold"
        }
      />
    </div>
  );
}

