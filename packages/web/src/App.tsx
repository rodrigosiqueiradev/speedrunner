import { analyzeRun, analyzeSessions, parseLss, pbOdds, scoreRun, type Run, type TimingMethod } from "@speedrunner/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AdviceList } from "./components/AdviceList";
import { FilePicker, type FilePickerHandle } from "./components/FilePicker";
import { GoalPlanner } from "./components/GoalPlanner";
import { HowItWorks } from "./components/HowItWorks";
import { PbOddsSummary, ResetCoach } from "./components/PbCoach";
import { PracticePlan } from "./components/PracticePlan";
import { Profile } from "./components/Profile";
import { YearInRuns } from "./components/YearInRuns";
import { UploadIcon } from "./components/Icons";
import { InfoTip, revealExplanation, SHOW_PANEL } from "./components/InfoTip";
import { RouteStrip } from "./components/RouteStrip";
import { panelId, RunTabs, TABS, tabFromHash, type Tab } from "./components/RunTabs";
import { SavingsChart } from "./components/SavingsChart";
import { ScoreBreakdown } from "./components/ScoreBreakdown";
import { SegmentTable } from "./components/SegmentTable";
import { SessionInsights } from "./components/SessionInsights";
import { Summary } from "./components/Summary";
import { PB_ODDS_METRICS } from "./pbExplain";
import { isDesktop } from "./platform";
import { categoryKey, loadProfile, saveProfile, upsertEntry, type ProfileEntry } from "./profile";

interface Loaded {
  fileName: string;
  xml: string;
}

type View = "run" | "profile" | "recap";
const VIEW_LINKS: Record<View, string> = { run: "Analyse a run", profile: "Profile", recap: "Year in runs" };
const viewFromHash = (): View =>
  window.location.hash === "#profile" ? "profile" : window.location.hash === "#recap" ? "recap" : "run";

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [timing, setTiming] = useState<TimingMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [profile, setProfile] = useState<ProfileEntry[]>(loadProfile);
  const picker = useRef<FilePickerHandle>(null);
  const profilePicker = useRef<FilePickerHandle>(null);
  const recapPicker = useRef<FilePickerHandle>(null);
  const tabsTop = useRef<HTMLDivElement>(null);

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => {
    const onHash = () => {
      setView(viewFromHash());
      setTab(tabFromHash());
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);
  useEffect(() => {
    // A link to an explanation or a segment in another tab opens that tab first.
    const onShow = (e: Event) => {
      const t = TABS.find((x) => panelId(x.id) === (e as CustomEvent<string>).detail);
      if (t) showTab(t.id, { scroll: false });
    };
    window.addEventListener(SHOW_PANEL, onShow);
    return () => window.removeEventListener(SHOW_PANEL, onShow);
  });

  const result = useMemo(() => {
    if (!loaded) return null;
    try {
      const run = parseLss(loaded.xml, timing ? { timingMethod: timing } : {});
      const analysis = analyzeRun(run);
      return {
        run,
        analysis,
        score: scoreRun(run, analysis),
        odds: pbOdds(run),
        sessions: analyzeSessions(run),
        hasGameTime: hasGameTime(loaded.xml),
      };
    } catch {
      return { error: true as const };
    }
  }, [loaded, timing]);

  const go = (next: View) => {
    setError(null);
    setView(next);
    setTab("overview");
    history.pushState(null, "", next === "run" ? window.location.pathname + window.location.search : `#${next}`);
    window.scrollTo({ top: 0 });
  };

  /** Switches the run page's tab, rendering it at once so whatever asked can scroll inside it. */
  const showTab = (next: Tab, { scroll = true } = {}) => {
    if (next !== tab) {
      flushSync(() => setTab(next));
      const hash = TABS.find((t) => t.id === next)!.hash;
      history.pushState(null, "", hash || window.location.pathname + window.location.search);
    }
    // Keep the run title in view unless the reader had already scrolled past the tabs.
    const top = tabsTop.current ? tabsTop.current.getBoundingClientRect().top + window.scrollY - 56 : 0;
    if (scroll && window.scrollY > Math.max(0, top)) window.scrollTo({ top });
  };

  const addToProfile = (fileName: string, xml: string) => {
    try {
      const run = parseLss(xml);
      const score = scoreRun(run);
      setProfile((p) => upsertEntry(p, score, fileName));
    } catch {
      setError(`We couldn't read "${fileName}" as LiveSplit splits, so it wasn't added.`);
    }
  };

  const load = (fileName: string, xml: string) => {
    setError(null);
    setTiming(null);
    setSelected(null);
    setLoaded({ fileName, xml });
  };

  const selectSegment = (index: number) => {
    showTab("segments", { scroll: false });
    setSelected(index);
    document.getElementById(`segment-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const ok = result && "analysis" in result && result.analysis ? result : null;
  const a = ok?.analysis;

  return (
    <>
      <header className="shell">
        <div className="shell-inner">
          <span className="brand">Speedrunner</span>
          <nav className="shell-nav" aria-label="Page">
            {(["run", "profile", "recap"] as const)
              .filter((v) => v !== view)
              .map((v) => (
                <a
                  key={v}
                  href={v === "run" ? "#" : `#${v}`}
                  className="keep"
                  onClick={(e) => {
                    e.preventDefault();
                    go(v);
                  }}
                >
                  {VIEW_LINKS[v]}
                </a>
              ))}
            {view === "profile" && profile.length > 0 && (
              <>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  How it's calculated
                </a>
                <button className="shell-button" onClick={() => profilePicker.current?.open()}>
                  <UploadIcon /> Add files
                </button>
              </>
            )}
            {view === "recap" && (
              <button className="shell-button recap-add" onClick={() => recapPicker.current?.open()}>
                <UploadIcon /> Add files
              </button>
            )}
            {view === "run" && ok && (
              <button className="shell-button" onClick={() => picker.current?.open()}>
                <UploadIcon /> Open file
              </button>
            )}
          </nav>
        </div>
      </header>

      <div className="app">
        {view === "profile" && (
          <>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Profile
              ref={profilePicker}
              entries={profile}
              onAdd={(name, xml) => {
                setError(null);
                addToProfile(name, xml);
              }}
              onError={setError}
              onRemove={(key) => setProfile((p) => p.filter((e) => e.key !== key))}
              onSetReference={(key, time) =>
                setProfile((p) => p.map((e) => (e.key === key ? { ...e, typedReference: time } : e)))
              }
            />
          </>
        )}

        {view === "recap" && <YearInRuns ref={recapPicker} initial={loaded} />}

        {view === "run" && (
          <>
        {!ok && (
          <section className="landing" aria-labelledby="landing-title">
            <h1 id="landing-title">Find where your run loses time</h1>
            <p className="lede">
              Load your LiveSplit splits to see a realistic target time, which segments to practise first, and how
              every number is worked out.
            </p>
          </section>
        )}

        <FilePicker ref={picker} onLoad={load} onError={setError} compact={!!ok} />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result && "error" in result && (
          <p className="error" role="alert">
            We couldn't read that file as LiveSplit splits. Make sure it's an .lss file saved from LiveSplit, not a
            layout (.lsl) or a renamed file.
          </p>
        )}

        {ok && a && (
          <main className="results">
            <div className="run-head">
              <div>
                <h1 className="run-title">
                  {a.game || "Unknown game"} <span>{a.category}</span>
                </h1>
                <p className="run-meta">
                  {loaded?.fileName} · {a.attemptCount.toLocaleString()} attempts ·{" "}
                  {a.finishedAttempts.toLocaleString()} finished
                </p>
              </div>
              {ok.hasGameTime && <TimingToggle value={ok.run.timingMethod} onChange={setTiming} />}
            </div>

            <div ref={tabsTop} />
            <RunTabs value={tab} onChange={(t) => showTab(t)} />

            <div className="tab-panel" role="tabpanel" id={panelId("overview")} aria-labelledby="tab-overview" hidden={tab !== "overview"}>
              <Summary analysis={a} />
              <RouteStrip segments={a.segments} onSelect={selectSegment} />

              <section className="block" aria-labelledby="top-practise-title">
                <div className="block-head">
                  <h2 id="top-practise-title">What to practise first</h2>
                  <p className="section-note">Ranked by the time each segment's advice is estimated to be worth.</p>
                </div>
                <AdviceList advice={a.advice} onSelect={selectSegment} limit={3} onMore={() => showTab("practise")} />
              </section>

              {ok.odds && (
                <section className="block" aria-labelledby="odds-title">
                  <div className="block-head">
                    <h2 id="odds-title">Your PB odds</h2>
                    <p className="section-note">How often an attempt beats your PB at your current form.</p>
                  </div>
                  <PbOddsSummary odds={ok.odds} />
                </section>
              )}

              <section className="block" aria-labelledby="score-title">
                <div className="block-head">
                  <h2 id="score-title">How well you run this category</h2>
                  <p className="section-note">From 0 to 100, worked out from this file alone so it compares across games.</p>
                </div>
                <ScoreBreakdown score={ok.score} />
                <ProfileAction
                  inProfile={profile.find((e) => e.key === categoryKey(ok.score))}
                  fileName={loaded!.fileName}
                  onAdd={() => setProfile((p) => upsertEntry(p, ok.score, loaded!.fileName))}
                  onView={() => go("profile")}
                />
              </section>
            </div>

            <div className="tab-panel" role="tabpanel" id={panelId("practise")} aria-labelledby="tab-practise" hidden={tab !== "practise"}>
              <section className="block" aria-labelledby="practise-title">
                <div className="block-head">
                  <h2 id="practise-title">What to practise first</h2>
                  <p className="section-note">Ranked by the time each segment's advice is estimated to be worth.</p>
                </div>
                <AdviceList advice={a.advice} onSelect={selectSegment} />
              </section>

              <section className="block" aria-labelledby="plan-title">
                <div className="block-head">
                  <h2 id="plan-title">Practice plan</h2>
                  <p className="section-note">Where an hour of practice takes the most time off a typical run.</p>
                </div>
                <PracticePlan run={ok.run} analysis={a} onSelect={selectSegment} />
              </section>

              {ok.odds && (
                <section className="block" aria-labelledby="reset-title">
                  <div className="block-head">
                    <h2 id="reset-title" className="title-with-tip">
                      {PB_ODDS_METRICS.reset.label} <InfoTip doc={PB_ODDS_METRICS.reset} />
                    </h2>
                    <p className="section-note">Whether a run that's behind PB pace is still worth playing on.</p>
                  </div>
                  <ResetCoach odds={ok.odds} />
                </section>
              )}

              <GoalPlanner
                key={`${loaded!.fileName}:${ok.run.timingMethod}`}
                run={ok.run}
                analysis={a}
                xml={loaded!.xml}
                fileName={loaded!.fileName}
                odds={ok.odds}
              />
            </div>

            <div className="tab-panel" role="tabpanel" id={panelId("segments")} aria-labelledby="tab-segments" hidden={tab !== "segments"}>
              <section className="block" aria-labelledby="time-title">
                <div className="block-head">
                  <h2 id="time-title">Where the time is</h2>
                  <p className="section-note">How much each segment could give back against your PB.</p>
                </div>
                <SavingsChart segments={a.segments} />
              </section>

              <section className="block" aria-labelledby="segments-title">
                <div className="block-head">
                  <h2 id="segments-title">All segments</h2>
                  <p className="section-note">
                    Stats use only{" "}
                    <a
                      href="#how-clean-time"
                      onClick={(e) => {
                        e.preventDefault();
                        revealExplanation("clean-time");
                      }}
                    >
                      clean segment times
                    </a>
                    .
                  </p>
                </div>
                <SegmentTable segments={a.segments} selected={selected} />
              </section>
            </div>

            <div className="tab-panel" role="tabpanel" id={panelId("sessions")} aria-labelledby="tab-sessions" hidden={tab !== "sessions"}>
              <section className="block" aria-labelledby="sessions-title">
                <div className="block-head">
                  <h2 id="sessions-title">How your sessions go</h2>
                  <p className="section-note">Warm-up, fatigue and tilt, stated only when enough sessions back them.</p>
                </div>
                <SessionInsights insights={ok.sessions} />
              </section>
            </div>

            <div className="tab-panel" role="tabpanel" id={panelId("how")} aria-labelledby="tab-how" hidden={tab !== "how"}>
              <HowItWorks analysis={a} score={ok.score} odds={ok.odds} />
            </div>
          </main>
        )}
          </>
        )}

        <footer className="footer">Your splits never leave {isDesktop ? "your computer" : "your browser"}.</footer>
      </div>
    </>
  );
}

/** Adds the loaded run to the profile, or says it's already there. */
function ProfileAction({
  inProfile,
  fileName,
  onAdd,
  onView,
}: {
  inProfile: ProfileEntry | undefined;
  fileName: string;
  onAdd: () => void;
  onView: () => void;
}) {
  const viewLink = (
    <a
      href="#profile"
      onClick={(e) => {
        e.preventDefault();
        onView();
      }}
    >
      View your profile
    </a>
  );
  if (inProfile?.fileName === fileName) {
    return <p className="section-foot">This category is in your profile. {viewLink}</p>;
  }
  return (
    <p className="section-foot profile-action">
      <button onClick={onAdd}>{inProfile ? "Replace in your profile" : "Add to your profile"}</button>
      {inProfile ? (
        <span>Your profile has this category from {inProfile.fileName}.</span>
      ) : (
        <span>Saved {isDesktop ? "on this computer" : "in this browser"} only.</span>
      )}
    </p>
  );
}

function TimingToggle({ value, onChange }: { value: Run["timingMethod"]; onChange: (t: TimingMethod) => void }) {
  return (
    <div className="toggle" role="group" aria-label="Timing method">
      {(["RealTime", "GameTime"] as const).map((m) => (
        <button key={m} aria-pressed={value === m} onClick={() => onChange(m)}>
          {m === "RealTime" ? "Real time" : "Game time"}
        </button>
      ))}
    </div>
  );
}

function hasGameTime(xml: string): boolean {
  return /<GameTime>\s*[\d-]/.test(xml);
}
