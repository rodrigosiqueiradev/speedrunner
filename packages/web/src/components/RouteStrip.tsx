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
  const maxSave = Math.max(1, ...segments.map((s) => s.realisticTimeSave ?? 0));

  return (
    <figure className="route">
      <div className="route-strip">
        {segments.map((s) => {
          const save = s.realisticTimeSave ?? 0;
          const level = save > 0 ? 1 + Math.ceil((save / maxSave) * 3) : 0;
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
      <figcaption className="route-caption">
        <span>Your PB, segment by segment, each as wide as it took. The stronger the colour, the more a good attempt would save there.</span>
        <span className="route-scale" aria-hidden>
          <i className="l0" />
          <i className="l1" />
          <i className="l2" />
          <i className="l3" />
          <i className="l4" />
          <span>more to gain</span>
        </span>
      </figcaption>
    </figure>
  );
}
