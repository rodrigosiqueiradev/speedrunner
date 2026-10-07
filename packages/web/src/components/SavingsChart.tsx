import { formatTime, type SegmentStats } from "@speedrunner/core";
import { useState } from "react";
import { METRICS } from "../explain";
import { formatSave } from "../format";
import { InfoTip } from "./InfoTip";

type Order = "route" | "biggest";

/**
 * One horizontal bar per segment. The full bar is PB minus gold; the stronger inner part is
 * PB minus good-day time, which is always the smaller of the two.
 */
export function SavingsChart({ segments }: { segments: SegmentStats[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [order, setOrder] = useState<Order>("route");
  const rows = segments.filter((s) => s.timeSaveVsGold != null);
  const max = Math.max(1, ...rows.map((s) => s.timeSaveVsGold!));
  const sorted =
    order === "route" ? rows : [...rows].sort((a, b) => b.timeSaveVsGold! - a.timeSaveVsGold!);

  if (rows.length === 0) return <p className="muted">Not enough data for this chart yet.</p>;

  return (
    <figure className="chart">
      <div className="chart-controls">
        <div className="legend">
          <span>
            <i className="swatch realistic" /> Good-day save <InfoTip doc={METRICS.realisticTimeSave} />
          </span>
          <span>
            <i className="swatch gold" /> Down to gold <InfoTip doc={METRICS.timeSaveVsGold} />
          </span>
        </div>
        <div className="toggle small" role="group" aria-label="Order">
          <button aria-pressed={order === "route"} onClick={() => setOrder("route")}>Route order</button>
          <button aria-pressed={order === "biggest"} onClick={() => setOrder("biggest")}>Biggest first</button>
        </div>
      </div>
      <div className="bars" role="table" aria-label="Time save per segment">
        {sorted.map((s) => {
          const full = s.timeSaveVsGold!;
          const realistic = Math.min(s.realisticTimeSave ?? 0, full);
          return (
            <div
              key={s.index}
              className={`bar-row${hover === s.index ? " hovered" : ""}`}
              role="row"
              tabIndex={0}
              onMouseEnter={() => setHover(s.index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.index)}
              onBlur={() => setHover(null)}
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
                <span className="bar-value">
                  {full > 0 ? (
                    <>
                      {realistic > 0 && <strong>{formatSave(realistic)}</strong>}
                      {realistic > 0 ? " / " : ""}
                      {formatSave(full)}
                    </>
                  ) : (
                    "at gold"
                  )}
                </span>
              </span>
              {hover === s.index && (
                <span className="tooltip" role="tooltip">
                  <strong>{s.name}</strong>
                  <span>PB segment <b>{formatTime(s.pbTime)}</b></span>
                  <span>Typical <b>{formatTime(s.median)}</b></span>
                  <span>Gold <b>{formatTime(s.gold)}</b></span>
                  <span>Good-day save <b>{formatSave(realistic)}</b></span>
                  <span>Save to gold <b>{formatSave(full)}</b></span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </figure>
  );
}
