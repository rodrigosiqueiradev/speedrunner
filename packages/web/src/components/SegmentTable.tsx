import { formatTime, type SegmentStats } from "@speedrunner/core";
import { formatSave } from "../format";

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);

export function SegmentTable({ segments }: { segments: SegmentStats[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>PB</th>
            <th>Gold</th>
            <th>Typical</th>
            <th>Save to gold</th>
            <th>Good-day save</th>
            <th title="Spread between good and bad attempts, relative to the typical time">Variability</th>
            <th>Reset rate</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.index}>
              <td>
                {s.name}
                {s.suspiciousGold && (
                  <span className="flag" title="LiveSplit's stored gold looks like a mis-split and was ignored">
                    {" "}⚠ gold ignored
                  </span>
                )}
              </td>
              <td>{formatTime(s.pbTime)}</td>
              <td>{formatTime(s.gold)}</td>
              <td>{formatTime(s.median)}</td>
              <td>{formatSave(s.timeSaveVsGold)}</td>
              <td>{formatSave(s.realisticTimeSave)}</td>
              <td>{pct(s.variability)}</td>
              <td>{pct(s.resetRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
