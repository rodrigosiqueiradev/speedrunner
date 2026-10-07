import { formatTime, type SegmentStats } from "@speedrunner/core";
import { formatSave } from "../format";

/**
 * The PB drawn as its route: one block per segment, as wide as the segment took.
 * Blocks darken with how much a good attempt would save there, so the places to
 * practise stand out along the run itself.
 */
export function RouteStrip({ segments, onSelect }: { segments: SegmentStats[]; onSelect: (index: number) => void }) {
  const total = segments.reduce((t, s) => t + (s.pbTime ?? 0), 0);
  if (total <= 0) return null;
  const maxSave = Math.max(0, ...segments.map((s) => s.realisticTimeSave ?? 0));

  return (
    <figure className="route">
      <div className="route-strip">
        {segments.map((s) => {
          const save = s.realisticTimeSave ?? 0;
          const level = saveLevel(save, maxSave);
          const width = ((s.pbTime ?? 0) / total) * 100;
          return (
            <button
              key={s.index}
              className={`route-seg l${level}`}
              style={{ flexGrow: width, flexBasis: 0 }}
              onClick={() => onSelect(s.index)}
              aria-label={`${s.name}: ${formatTime(s.pbTime)} in PB, good-day save ${formatSave(save)}`}
              title={`${s.name}\n${formatTime(s.pbTime)} in PB · good-day save ${formatSave(save)}`}
            >
              {width > 7 && <span>{s.name}</span>}
            </button>
          );
        })}
      </div>
      <div className="route-axis" aria-hidden>
        <span>0:00</span>
        <span>PB {formatTime(total)}</span>
      </div>
      <figcaption className="route-caption">
        <span>
          Your PB from start to finish. Each block is one segment, and its width is the time it took. Darker blue
          means a good attempt would save more there.
        </span>
        {maxSave > 0 && (
          <span className="route-scale" aria-hidden>
            <span>No save</span>
            <i className="l0" />
            <i className="l1" />
            <i className="l2" />
            <i className="l3" />
            <i className="l4" />
            <span>{formatSave(maxSave)}</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Steps 1–4 split the range up to the biggest save into quarters; 0 is no save at all. */
export function saveLevel(save: number, maxSave: number): number {
  if (save <= 0 || maxSave <= 0) return 0;
  return Math.min(4, 1 + Math.floor((save / maxSave) * 4));
}
