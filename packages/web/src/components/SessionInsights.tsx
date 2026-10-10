import { SESSION_INSIGHT_SETTINGS as S, type Finding, type FindingStatus, type PaceBucket, type SessionInsights as Insights } from "@speedrunner/core";
import type { MetricDoc } from "../explain";
import { FINDING_DOCS, SESSION_DOCS } from "../session-explain";
import { ChevronIcon } from "./Icons";
import { InfoTip } from "./InfoTip";

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
  const clear = findings.filter((f) => f.status === "clear");
  const quiet = findings.filter((f) => f.status !== "clear");
  return (
    <>
      <p className="session-meta">
        <span className="session-meta-label">
          {r.sessions.toLocaleString("en-US")} sessions <InfoTip doc={SESSION_DOCS.sessions} />
        </span>{" "}
        from {r.timedAttempts.toLocaleString("en-US")} attempts
        {r.medianSessionMinutes != null && (
          <>
            {" "}
            · a typical session lasts {minutes(r.medianSessionMinutes)} with {r.medianAttemptsPerSession} attempts
          </>
        )}
      </p>
      {clear.length > 0 && (
        <ul className="findings">
          {clear.map((f) => (
            <FindingRow key={f.kind} finding={f} />
          ))}
        </ul>
      )}
      {quiet.length > 0 && (
        <details className="quiet-findings">
          <summary>
            <ChevronIcon />
            <span>{quietSummary(quiet, clear.length > 0)}</span>
          </summary>
          <ul className="findings">
            {quiet.map((f) => (
              <FindingRow key={f.kind} finding={f} />
            ))}
          </ul>
        </details>
      )}
      <div className="pace-charts">
        <PaceChart doc={SESSION_DOCS.playing} note="Against that session's average" buckets={r.byMinutesIn} />
        <PaceChart doc={SESSION_DOCS.timeOfDay} note="When the session started, against your average" buckets={r.byTimeOfDay} />
        <PaceChart doc={SESSION_DOCS.weekday} note="When the session started, against your average" buckets={r.byWeekday} />
      </div>
    </>
  );
}

function FindingRow({ finding: f }: { finding: Finding }) {
  return (
    <li className={`finding ${f.status}`}>
      <div className="finding-head">
        <span className="finding-title">
          {f.title} <InfoTip doc={FINDING_DOCS[f.kind]} />
        </span>
        <span className={`tag finding-status ${f.status}`}>{STATUS[f.status]}</span>
        {f.status === "clear" && <InfoTip doc={SESSION_DOCS.clear} />}
      </div>
      <p className="finding-message">{f.message}</p>
    </li>
  );
}

/** Diverging bars: faster than usual to the left, slower to the right, with the interval as a thin line. */
function PaceChart({ doc, note, buckets }: { doc: MetricDoc; note: string; buckets: PaceBucket[] }) {
  const title = doc.label;
  const span = Math.max(0.02, ...buckets.flatMap((b) => (b.pace == null ? [] : [Math.abs(b.low!), Math.abs(b.high!)])));
  const pos = (x: number) => `${50 + (Math.max(-span, Math.min(span, x)) / span) * 50}%`;
  return (
    <figure className="chart pace-chart">
      <figcaption>
        <span className="pace-chart-title">
          {title} <InfoTip doc={doc} />
        </span>
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
                <span className="pace-thin">{b.sessions === 0 ? "no sessions" : `${b.sessions} of ${S.minSessions} sessions`}</span>
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

/** "Nothing clear yet: 3 checks found no effect, 4 checks need more sessions", for the line the quiet checks fold under. */
function quietSummary(quiet: Finding[], afterClear: boolean): string {
  const none = quiet.filter((f) => f.status === "no-effect").length;
  const thin = quiet.length - none;
  const checks = (n: number) => `${n} ${n === 1 ? "check" : "checks"}`;
  const parts = [
    none > 0 && `${checks(none)} found no effect`,
    thin > 0 && `${checks(thin)} ${thin === 1 ? "needs" : "need"} more sessions`,
  ].filter(Boolean);
  return `${afterClear ? "Other checks" : "Nothing clear yet"}: ${parts.join(", ")}`;
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
