import { ANALYSIS_DEFAULTS, formatTime, type SegmentStats } from "@speedrunner/core";
import { METRICS, type MetricDoc } from "../explain";
import { formatSave } from "../format";
import { InfoTip } from "./InfoTip";

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

export function SegmentTable({ segments }: { segments: SegmentStats[] }) {
  return (
    <div className="table-wrap">
      <table className="segments">
        <thead>
          <tr>
            <th scope="col">Segment</th>
            {COLUMNS.map((c) => (
              <th key={c.doc.id} scope="col">
                <span className="th-inner">
                  {c.doc.label} <InfoTip doc={c.doc} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.index}>
              <th scope="row">
                {s.name}
                {s.suspiciousGold && (
                  <span className="flag" title="LiveSplit's stored gold looks like a mis-split and was ignored">
                    gold ignored
                  </span>
                )}
                {s.samples < ANALYSIS_DEFAULTS.minSamples && <span className="flag muted">few attempts</span>}
              </th>
              {COLUMNS.map((c) => (
                <td key={c.doc.id}>{c.cell(s)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
