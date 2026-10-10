import { ANALYSIS_DEFAULTS, describeChance, formatTime, oneIn, pbChanceFrom, resetAdvice, type PbOdds } from "@speedrunner/core";
import { useId, useState } from "react";
import { formatSave, parseBehind } from "../format";
import { describeResetAfter, PB_ODDS_METRICS as M, type PbOddsDoc } from "../pbExplain";
import { InfoTip } from "./InfoTip";

/** PB odds per attempt and a forecast of how many attempts a PB takes. */
export function PbOddsSummary({ odds }: { odds: PbOdds }) {
  const f = odds.forecast;
  const unreachable = odds.perAttempt === 0;
  const sims = odds.simulations.toLocaleString("en-US");
  return (
    <>
      <div className="comparisons" role="table" aria-label="PB odds">
        <Row
          doc={M.perAttempt}
          value={unreachable ? "< 0.01%" : oneIn(odds.perAttempt)}
          note={
            unreachable
              ? `None of ${sims} simulated runs beat your PB at your current form`
              : `${describeChance(odds.perAttempt)} of attempts, counting the ones you reset`
          }
          lead
        />
        <Row
          doc={M.ifFinished}
          value={describeChance(odds.ifFinished)}
          note={`Typical finish ${formatTime(odds.medianFinish)}, good finish ${formatTime(odds.goodFinish)}`}
        />
        {f && (
          <Row
            doc={M.forecast}
            value={`${f.attemptsFor50.toLocaleString("en-US")} attempts`}
            note={
              f.attemptsPerDay != null && f.date50 && f.date90
                ? `For an even chance. At about ${roundRate(f.attemptsPerDay)} a day, around ${shortDate(f.date50)} (90% by ${shortDate(f.date90)})`
                : `For an even chance, ${f.attemptsFor90.toLocaleString("en-US")} for 90%. Your file has no attempt dates for a grind rate`
            }
          />
        )}
      </div>
      {unreachable && (
        <p className="section-foot">
          Your PB is {formatSave(odds.medianFinish - odds.personalBest)} faster than your typical finish today. The
          odds at each split, under Practise, still show where a run can turn into a PB.
        </p>
      )}
      {odds.thinSegments.length > 0 && (
        <p className="section-foot muted">
          Fewer than {ANALYSIS_DEFAULTS.minSamples} recent clean times on {odds.thinSegments.length === 1 ? "1 segment" : `${odds.thinSegments.length} segments`}{" "}
          ({odds.thinSegments.slice(0, 3).join(", ")}
          {odds.thinSegments.length > 3 ? ", …" : ""}), so treat these odds as rough.
        </p>
      )}
    </>
  );
}

type Mode = "hunting" | "practising";

/**
 * A "should I reset?" calculator, and the odds and reset point at every split behind a button.
 * Practising mode drops the reset advice for runners who play runs out whatever happens.
 */
export function ResetCoach({ odds }: { odds: PbOdds }) {
  const [showSplits, setShowSplits] = useState(false);
  const [mode, setMode] = useState<Mode>("hunting");
  const hunting = mode === "hunting";
  return (
    <>
      <div className="plan-controls">
        <span className="plan-controls-label">
          <span id="reset-mode">I'm</span> <InfoTip doc={M.mode} />
        </span>
        <div className="toggle small" role="group" aria-labelledby="reset-mode">
          <button aria-pressed={hunting} onClick={() => setMode("hunting")}>
            PB hunting
          </button>
          <button aria-pressed={!hunting} onClick={() => setMode("practising")}>
            Practising
          </button>
        </div>
      </div>
      <ResetCalculator odds={odds} mode={mode} />
      <p className="section-foot">
        <button className="link-button text-link" aria-expanded={showSplits} onClick={() => setShowSplits((v) => !v)}>
          {showSplits ? "Hide the odds at each split" : `Show the odds at each of the ${odds.splits.length} splits`}
        </button>
      </p>
      {showSplits && (
        <div className="table-wrap">
          <table className="segments pb-splits">
            <thead>
              <tr>
                <th scope="col">Split</th>
                <ColumnHead doc={M.fromSplit} label="PB chance on pace" />
                {hunting && <ColumnHead doc={M.resetAfter} />}
              </tr>
            </thead>
            <tbody>
              {odds.splits.map((s) => (
                <tr key={s.index}>
                  <th scope="row">{s.name}</th>
                  <td>{s.onPace == null ? "-" : describeChance(s.onPace)}</td>
                  {hunting && (
                    <td>
                      {s.rule === "behind"
                        ? describeResetAfter(s.resetAfter!, s.resetAfterShare!)
                        : s.rule === "never"
                          ? "Never"
                          : s.rule === "always"
                            ? "Always"
                            : "-"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Pick a split and how far off PB pace you are; get the odds and, when PB hunting, what to do. */
function ResetCalculator({ odds, mode }: { odds: PbOdds; mode: Mode }) {
  const splits = odds.splits.filter((s) => s.pbSplit != null);
  const [split, setSplit] = useState(splits[Math.floor(splits.length / 2)]?.index ?? 0);
  const [behind, setBehind] = useState("0");
  const id = useId();
  if (splits.length === 0) return null;
  const s = odds.splits[split];
  const offset = parseBehind(behind);
  const valid = offset != null;
  const time = s.pbSplit! + (offset ?? 0);
  const advice = valid && mode === "hunting" ? resetAdvice(odds, split, time) : null;
  const message = !valid
    ? "Type how far behind PB pace you are, in seconds or minutes and seconds."
    : advice
      ? advice.message
      : `${describeChance(pbChanceFrom(odds, split, time))} of runs like this one still PB.`;
  return (
    <div className="reset-coach">
      <div className="reset-inputs">
        <label htmlFor={`${id}-split`}>
          At split
          <select id={`${id}-split`} value={split} onChange={(e) => setSplit(Number(e.target.value))}>
            {splits.map((x) => (
              <option key={x.index} value={x.index}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-behind`}>
          Time behind PB
          <input
            id={`${id}-behind`}
            inputMode="decimal"
            value={behind}
            onChange={(e) => setBehind(e.target.value)}
            aria-describedby={`${id}-hint`}
          />
        </label>
      </div>
      <p id={`${id}-hint`} className="reset-hint">
        Seconds, or minutes and seconds like 2:30 for a long run. Use a minus sign if you're ahead, for example −3.5.
      </p>
      <p className={`reset-verdict ${advice?.verdict ?? ""}`} role="status">
        {message}
      </p>
    </div>
  );
}

function Row({ doc, value, note, lead }: { doc: PbOddsDoc; value: string; note: string; lead?: boolean }) {
  return (
    <div className={`comparison${lead ? " lead" : ""}`} role="row">
      <div className="comparison-name" role="rowheader">
        <span className="comparison-label">
          {doc.label} <InfoTip doc={doc} />
        </span>
        <span className="comparison-note">{note}</span>
      </div>
      <div className="comparison-delta" role="cell" />
      <div className="comparison-time" role="cell">
        {value}
      </div>
    </div>
  );
}

function ColumnHead({ doc, label }: { doc: PbOddsDoc; label?: string }) {
  return (
    <th scope="col">
      <span className="th-inner">
        {label ?? doc.label} <InfoTip doc={doc} />
      </span>
    </th>
  );
}

function roundRate(perDay: number): string {
  return perDay >= 10 ? String(Math.round(perDay)) : perDay.toFixed(1).replace(/\.0$/, "");
}

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
