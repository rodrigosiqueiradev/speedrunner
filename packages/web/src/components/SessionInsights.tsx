import { SESSION_INSIGHT_SETTINGS as S, type Finding, type FindingStatus, type PaceBucket, type SessionInsights as Insights } from "@speedrunner/core";
import { ChevronIcon } from "./Icons";

const STATUS: Record<FindingStatus, string> = {
  clear: "Clear effect",
  "no-effect": "No clear effect",
  "not-enough-data": "Not enough data",
};
const ORDER: FindingStatus[] = ["clear", "no-effect", "not-enough-data"];

/** Warm-up, peak window, fatigue, tilt and time effects, each stated only when the data backs it. */
export function SessionInsights({ insights: r }: { insights: Insights }) {
  if (!r.available) return <p className="empty-note">{r.reason}</p>;
  const findings = [...r.findings].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return (
    <>
      <p className="session-meta">
        {r.sessions.toLocaleString()} sessions from {r.timedAttempts.toLocaleString()} attempts
        {r.medianSessionMinutes != null && (
          <>
            {" "}
            · a typical session lasts {minutes(r.medianSessionMinutes)} with {r.medianAttemptsPerSession} attempts
          </>
        )}
      </p>
      <ul className="findings">
        {findings.map((f) => (
          <FindingRow key={f.kind} finding={f} />
        ))}
      </ul>
      <div className="pace-charts">
        <PaceChart title="Minutes into a session" note="Against each session's own average" buckets={r.byMinutesIn} />
        <PaceChart
          title="Time of day"
          note="Against your overall average. Night is 0-6h, morning 6-12h, afternoon 12-18h, evening 18-24h"
          buckets={r.byTimeOfDay}
        />
        <PaceChart title="Day of week" note="Against your overall average" buckets={r.byWeekday} />
      </div>
      <HowSessions />
    </>
  );
}

function FindingRow({ finding: f }: { finding: Finding }) {
  return (
    <li className={`finding ${f.status}`}>
      <div className="finding-head">
        <span className="finding-title">{f.title}</span>
        <span className={`tag finding-status ${f.status}`}>{STATUS[f.status]}</span>
      </div>
      <p className="finding-message">{f.message}</p>
    </li>
  );
}

/** Diverging bars: faster than usual to the left, slower to the right, with the interval as a thin line. */
function PaceChart({ title, note, buckets }: { title: string; note: string; buckets: PaceBucket[] }) {
  const span = Math.max(0.02, ...buckets.flatMap((b) => (b.pace == null ? [] : [Math.abs(b.low!), Math.abs(b.high!)])));
  const pos = (x: number) => `${50 + (Math.max(-span, Math.min(span, x)) / span) * 50}%`;
  return (
    <figure className="chart pace-chart">
      <figcaption>
        <span className="pace-chart-title">{title}</span>
        <span className="pace-chart-note">{note}</span>
      </figcaption>
      <div className="pace-axis" aria-hidden>
        <span>faster</span>
        <span>slower</span>
      </div>
      <div className="bars" role="table" aria-label={`Pace by ${title.toLowerCase()}`}>
        {buckets.map((b) => (
          <div key={b.label} className="pace-row" role="row">
            <span className="bar-label" role="rowheader">
              {b.label}
            </span>
            <span className="pace-track" role="cell">
              {b.pace == null ? (
                <span className="pace-thin">{b.sessions === 0 ? "no attempts" : `${b.sessions} of ${S.minSessions} sessions`}</span>
              ) : (
                <>
                  <span
                    className={`pace-bar ${b.pace < 0 ? "faster" : "slower"}`}
                    style={b.pace < 0 ? { left: pos(b.pace), right: "50%" } : { left: "50%", right: `calc(100% - ${pos(b.pace)})` }}
                  />
                  <span className="pace-range" style={{ left: pos(b.low!), right: `calc(100% - ${pos(b.high!)})` }} />
                </>
              )}
            </span>
            <span className="bar-value">{b.pace == null ? "" : paceText(b.pace)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function HowSessions() {
  const pct = (x: number) => `${+(x * 100).toFixed(1)}%`;
  return (
    <details id="how-sessions" className="how-entry session-how">
      <summary>
        <ChevronIcon />
        <span className="how-label">How it's worked out</span>
        <span className="how-short">Sessions, pace, and when an effect counts as clear.</span>
      </summary>
      <div className="how-body">
        <ul>
          <li>
            Sessions come from the start and end time LiveSplit saves for every attempt. A break of more than{" "}
            {S.gapMinutes} minutes starts a new session. Times of day use this computer's time zone.
          </li>
          <li>
            Pace compares each attempt's clean segment times with your usual time for those segments: the median of
            the {S.paceWindow} clean times around that attempt. Using nearby attempts means getting better over the
            months doesn't look like a time-of-day or session effect. A segment counts as at most {S.paceCap}× its
            usual time, so a pause doesn't swamp the rest.
          </li>
          <li>
            Sessions, not single attempts, are what gets compared, because attempts in one session aren't independent.
            Warm-up, peak window and fatigue compare parts of the same session with each other.
          </li>
          <li>
            Warm-up: your first {S.warmupAttempts} attempts against the rest of the session. Fatigue: reset rate and pace
            before and after {S.fatigueThresholds.map((t) => (t < 60 ? `${t} min` : `${t / 60}h`)).join(", ")} into a
            session, reporting the point where things get worse the most.
          </li>
          <li>
            Tilt: the attempt right after a reset in the last {pct(1 - S.lateResetFraction)} of the route, or after a
            finished run within {pct(S.nearPbFraction)} of the PB at the time, against every other next attempt. It
            looks at early resets (in the first {pct(S.earlyResetFraction)} of the route) and pace.
          </li>
          <li>
            An effect is stated only when it is at least {pct(S.minPaceEffect)} of pace (or {pct(S.minRateEffect)}{" "}
            points of reset rate) and its {pct(S.confidence)} interval doesn't include zero ({pct(S.searchConfidence)}{" "}
            when we pick the best of several windows or days). Each needs {S.minSessions} sessions or {S.minEvents}{" "}
            events first. Otherwise it says there's no clear effect, or not enough data yet.
          </li>
        </ul>
      </div>
    </details>
  );
}

function paceText(pace: number): string {
  const v = Math.abs(pace * 100).toFixed(1);
  return v === "0.0" ? "0.0%" : `${pace < 0 ? "−" : "+"}${v}%`;
}

function minutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
