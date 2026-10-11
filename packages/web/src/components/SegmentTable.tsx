import { ANALYSIS_DEFAULTS, formatTime, type LuckSuggestion, type SegmentStats } from "@speedrunner/core";
import { METRICS, type MetricDoc } from "../explain";
import { formatSave } from "../format";
import { MetricHeader } from "./Metric";
import { TableWrap } from "./Layout";

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);

const COLUMNS: Array<{ doc: MetricDoc; cell: (s: SegmentStats) => string }> = [
  { doc: METRICS.pbTime, cell: (s) => formatTime(s.pbTime) },
  { doc: METRICS.gold, cell: (s) => formatTime(s.gold) },
  { doc: METRICS.median, cell: (s) => formatTime(s.median) },
  { doc: METRICS.timeSaveVsGold, cell: (s) => formatSave(s.timeSaveVsGold) },
  { doc: METRICS.realisticTimeSave, cell: (s) => formatSave(s.realisticTimeSave) },
  { doc: METRICS.variability, cell: (s) => pct(s.variability) },
  { doc: METRICS.resetRate, cell: (s) => pct(s.resetRate) },
];

export interface LuckControls {
  /** Segments whose times look luck-based, for the runner to confirm. */
  suggestions: LuckSuggestion[];
  onToggle: (segmentName: string, on: boolean) => void;
}

export function SegmentTable({
  segments,
  selected,
  luck,
}: {
  segments: SegmentStats[];
  selected: number | null;
  luck?: LuckControls;
}) {
  const suggested = new Map(luck?.suggestions.map((x) => [x.index, x]));
  return (
    <TableWrap>
      <table className="segments">
        <thead>
          <tr>
            <th scope="col">Segment</th>
            {COLUMNS.map((c) => (
              <MetricHeader key={c.doc.id} doc={c.doc} />
            ))}
            {luck && <MetricHeader doc={METRICS.luck} />}
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.index} id={`segment-${s.index}`} className={selected === s.index ? "selected" : undefined}>
              <th scope="row">
                {s.name}
                {s.suspiciousGold && (
                  <span className="flag" title="LiveSplit's stored gold looks like a mis-split and was ignored">
                    gold ignored
                  </span>
                )}
                {s.samples < ANALYSIS_DEFAULTS.minSamples && <span className="flag muted">few attempts</span>}
                {s.luck && (
                  <span className="seg-note" title="How often luck went your way here recently, and what bad luck typically costs">
                    Good luck {pct(s.luck.goodShare)}
                    {s.luck.cost != null && ` · bad luck +${formatSave(s.luck.cost)}`}
                  </span>
                )}
                {luck && !s.luckMarked && suggested.has(s.index) && (
                  <span className="seg-note suggest" title={suggestionTitle(suggested.get(s.index)!)}>
                    Looks like luck
                  </span>
                )}
              </th>
              {COLUMNS.map((c) => (
                <td key={c.doc.id}>{c.cell(s)}</td>
              ))}
              {luck && (
                <td className="luck-cell">
                  <input
                    type="checkbox"
                    checked={s.luckMarked}
                    aria-label={`Luck decides ${s.name}`}
                    onChange={(e) => luck.onToggle(s.name, e.target.checked)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function suggestionTitle(x: LuckSuggestion): string {
  const odds =
    x.goodShare != null && x.cost != null
      ? ` Good luck in ${pct(x.goodShare)} of your attempts; bad luck typically costs ${formatSave(x.cost)}.`
      : "";
  return x.reason === "name"
    ? `Its name says RNG.${odds} Tick it if luck decides this segment.`
    : `Your times here fall into a fast and a slow group that don't streak or improve over time, as luck does.${odds} Tick it if luck decides this segment.`;
}
