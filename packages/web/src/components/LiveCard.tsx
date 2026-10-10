import type { LiveSession, LiveStats } from "@speedrunner/core";
import type { FeedStatus } from "../live/feeds";
import { STAT_BY_ID, type StatChoice } from "../live/stats";
import { cardStyleVars, DEFAULT_STYLE, type CardStyle } from "../live/style";
import { TrendDownIcon, TrendUpIcon } from "./Icons";

/** The card's title: "Dishonored · Any%". */
export const liveTitle = (run: { game: string; category: string }) => `${run.game || "Unknown game"} · ${run.category}`;

/** The live stats card: the runner's chosen stats, in their order. Also the whole overlay window. */
export function LiveCard({
  title,
  stats,
  session,
  status,
  choices,
  look = DEFAULT_STYLE,
  note,
}: {
  title: string;
  stats: LiveStats;
  session: LiveSession;
  status: FeedStatus | null;
  choices: StatChoice[];
  look?: CardStyle;
  /** A short line under the stats, such as which file to choose. It replaces the split name mismatch line, which says the same. */
  note?: string | null;
}) {
  const shown = choices.filter((c) => c.shown).map((c) => STAT_BY_ID.get(c.id)!);
  return (
    <section className="live-card" aria-label="Live stats" style={cardStyleVars(look)}>
      <header className="live-card-head">
        <span className="live-card-title">{title}</span>
        <StatusDot status={status} />
      </header>
      {shown.length === 0 ? (
        <p className="live-card-empty">No stats on the card yet. Pick them on the Live stats page.</p>
      ) : (
        <dl className="live-rows">
          {shown.map((def) => {
            const v = def.view(stats, session);
            return (
              <div key={def.id} className="live-row" data-tone={v?.tone}>
                <dt>{def.doc.label}</dt>
                <dd>
                  <span className={v?.word ? "live-value word" : "live-value"}>{v?.value ?? "–"}</span>
                  {v?.detail && (
                    <span className="live-detail" data-trend={v.trend}>
                      {v.trend === "up" && <TrendUpIcon label="Up" />}
                      {v.trend === "down" && <TrendDownIcon label="Down" />}
                      {v.detail}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {status?.kind === "offline" && (
        <p className="live-card-note">
          {status.reason} Trying again every few seconds.
        </p>
      )}
      {status?.kind === "connected" && status.mismatch && !note && <p className="live-card-note">{status.mismatch}</p>}
      {note && <p className="live-card-note">{note}</p>}
    </section>
  );
}

function StatusDot({ status }: { status: FeedStatus | null }) {
  const [label, state] =
    status == null
      ? ["", "off"]
      : status.kind === "demo"
        ? ["Demo", "demo"]
        : status.kind === "connected"
          ? ["LiveSplit", "on"]
          : status.kind === "connecting"
            ? ["Connecting", "off"]
            : ["Not connected", "error"];
  return (
    <span className="live-status" data-state={state}>
      <span className="live-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
