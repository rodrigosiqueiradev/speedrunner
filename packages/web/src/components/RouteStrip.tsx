import { formatTime, type SegmentStats } from "@speedrunner/core";
import { formatSave } from "../format";

const MARKED = 3;

/**
 * The PB drawn as its route: one column per segment, as wide as the segment took, on a
 * track that runs from 0:00 to the PB. A bar rises from the track where a good attempt
 * would save time, as tall as the save, so the places to practise stand out however many
 * splits the run has. The biggest saves are numbered and listed under the strip.
 */
export function RouteStrip({ segments, onSelect }: { segments: SegmentStats[]; onSelect: (index: number) => void }) {
  const total = segments.reduce((t, s) => t + (s.pbTime ?? 0), 0);
  if (total <= 0) return null;
  const maxSave = Math.max(0, ...segments.map((s) => s.realisticTimeSave ?? 0));
  const top = segments
    .filter((s) => (s.realisticTimeSave ?? 0) > 0)
    .sort((x, y) => y.realisticTimeSave! - x.realisticTimeSave!)
    .slice(0, MARKED);
  const rank = new Map(top.map((s, i) => [s.index, i + 1]));
  const sections = routeSections(segments);
  const sectionOf = (i: number) => sections?.filter((sec) => sec.start <= i).at(-1)?.name;

  return (
    <figure className="route">
      <div className="route-plot">
        {segments.map((s) => {
          const save = s.realisticTimeSave ?? 0;
          const r = rank.get(s.index);
          const name = s.name;
          return (
            <button
              key={s.index}
              className="route-seg"
              style={{ flexGrow: s.pbTime ?? 0 }}
              onClick={() => onSelect(s.index)}
              aria-label={`${name}: ${formatTime(s.pbTime)} in PB, good-day save ${formatSave(save)}`}
              title={`${name}\n${formatTime(s.pbTime)} in PB · good-day save ${formatSave(save)}`}
            >
              {save > 0 && (
                <i className="route-bar" style={{ height: `max(2px, calc(${(save / maxSave).toFixed(4)} * var(--bar-max)))` }}>
                  {r && <b className="route-mark">{r}</b>}
                </i>
              )}
            </button>
          );
        })}
      </div>
      {sections && (
        <div className="route-sections" aria-hidden>
          {sections.map((sec) => (
            <span key={sec.start} style={{ flexGrow: sec.time }} data-narrow={sec.time / total < 0.12 || undefined}>
              {sec.time / total > 0.05 && sec.name}
            </span>
          ))}
        </div>
      )}
      <div className="route-axis" aria-hidden>
        <span>0:00</span>
        <span>PB {formatTime(total)}</span>
      </div>
      <figcaption className="route-caption">
        <p>
          Your PB from start to finish, each segment as wide as it took. Bars rise where a good attempt would save
          time{maxSave > 0 ? `, the tallest ${formatSave(maxSave)}` : ""}.
        </p>
        {top.length > 0 && (
          <ol className="route-top" aria-label="Biggest good-day saves">
            {top.map((s, i) => (
              <li key={s.index}>
                <button onClick={() => onSelect(s.index)}>
                  <b>{i + 1}</b>
                  <span>
                    {sectionOf(s.index) && sectionOf(s.index) !== s.name && (
                      <span className="route-top-section">{sectionOf(s.index)} · </span>
                    )}
                    {s.name}
                  </span>
                  <span className="route-top-save">{formatSave(s.realisticTimeSave)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </figcaption>
    </figure>
  );
}

interface Section {
  name: string;
  start: number;
  time: number;
}

/**
 * Groups subsplits into their sections, or returns null when the run doesn't use subsplits.
 * LiveSplit marks a split inside a section "-Name" and the one closing it "{Section}Name".
 */
export function routeSections(segments: Array<Pick<SegmentStats, "index" | "rawName" | "pbTime">>): Section[] | null {
  if (!segments.some((s) => /^\{[^}]*\}/.test(s.rawName))) return null;
  const out: Section[] = [];
  let open: Section | null = null;
  for (const s of segments) {
    const t = s.pbTime ?? 0;
    const closes = s.rawName.match(/^\{([^}]*)\}/);
    if (!open) open = { name: "", start: s.index, time: 0 };
    open.time += t;
    if (closes) open.name = closes[1].trim();
    else if (!s.rawName.startsWith("-")) open.name = s.rawName;
    if (closes || !s.rawName.startsWith("-")) {
      out.push(open);
      open = null;
    }
  }
  if (open) out.push(open);
  return out;
}
