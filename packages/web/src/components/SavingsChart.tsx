import { formatTime, type SegmentStats } from "@speedrunner/core";
import { useState } from "react";
import { formatSave } from "../format";

/**
 * One horizontal bar per segment. The full bar is PB minus gold; the darker inner part is
 * PB minus good-day time, which is always the smaller of the two.
 */
export function SavingsChart({ segments }: { segments: SegmentStats[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = segments.filter((s) => s.timeSaveVsGold != null);
  const max = Math.max(1, ...rows.map((s) => s.timeSaveVsGold!));

  if (rows.length === 0) return <p className="muted">Not enough data for this chart.</p>;

  return (
    <figure className="chart">
      <div className="legend" aria-hidden>
        <span><i className="swatch realistic" /> Good-day save</span>
        <span><i className="swatch gold" /> Down to gold</span>
      </div>
      <div className="bars" role="table" aria-label="Time save per segment">
        {rows.map((s) => {
          const full = s.timeSaveVsGold!;
          const realistic = Math.min(s.realisticTimeSave ?? 0, full);
          return (
            <div
              key={s.index}
              className={`bar-row${hover === s.index ? " hovered" : ""}`}
              role="row"
              onMouseEnter={() => setHover(s.index)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="bar-label" role="rowheader" title={s.name}>
                {s.name}
              </span>
              <span className="bar-track" role="cell">
                <span className="bar gold" style={{ width: `${(full / max) * 100}%` }}>
                  {realistic > 0 && (
                    <span className="bar realistic" style={{ width: `${(realistic / full) * 100}%` }} />
                  )}
                </span>
                <span className="bar-value">{full > 0 ? formatSave(full) : "at gold"}</span>
              </span>
              {hover === s.index && (
                <span className="tooltip" role="tooltip">
                  <strong>{s.name}</strong>
                  <span>PB segment: {formatTime(s.pbTime)}</span>
                  <span>Gold: {formatTime(s.gold)}</span>
                  <span>Typical: {formatTime(s.median)}</span>
                  <span>Good-day save: {formatSave(realistic)}</span>
                  <span>Save to gold: {formatSave(full)}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </figure>
  );
}
