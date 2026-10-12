import {
  analyzeRun,
  analyzeSessions,
  hasGameTime,
  markLuck,
  parseLss,
  pbOdds,
  scoreRun,
  suggestLuckSegments,
  type CategoryScore,
  type TimingMethod,
} from "@speedrunner/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AdviceList } from "./components/AdviceList";
import { FilePicker, type FilePickerHandle } from "./components/FilePicker";
import { GoalPlanner } from "./components/GoalPlanner";
import { HowItWorks } from "./components/HowItWorks";
import { PbOddsSummary, ResetCoach } from "./components/PbCoach";
import { PracticePlan } from "./components/PracticePlan";
import { Profile } from "./components/Profile";
import { ProfileRuns } from "./components/ProfileRuns";
import { YearInRuns } from "./components/YearInRuns";
import { LiveOverlay } from "./components/LiveOverlay";
import { LivePage } from "./components/LivePage";
import { UploadIcon } from "./components/Icons";
import { Appearance } from "./components/Appearance";
import { UpdateBanner, useUpdates, VersionNote } from "./components/UpdateBanner";
import { SHOW_PANEL } from "./components/InfoTip";
import { ActionLink, ExplainLink, Toggle } from "./components/Controls";
import { ErrorMessage, Landing, PageHead, Section } from "./components/Layout";
import { RouteStrip } from "./components/RouteStrip";
import { panelId, RunTabs, TabPanel, TABS, tabFromHash, type Tab } from "./components/RunTabs";
import { SavingsChart } from "./components/SavingsChart";
import { ScoreBreakdown } from "./components/ScoreBreakdown";
import { SegmentTable } from "./components/SegmentTable";
import { SessionInsights } from "./components/SessionInsights";
import { Summary } from "./components/Summary";
import { categoryName, notSplitsAdded } from "./format";
import { PB_ODDS_METRICS } from "./pbExplain";
import { closeThisWindow, isOverlayWindow } from "./desktopWindows";
import { isDesktop } from "./platform";
import { categoryKey, loadProfile, saveProfile, upsertEntry, type ProfileEntry } from "./profile";
import { deleteSplitFile, loadSplitFiles, putSplitFile, type StoredSplit } from "./splitFiles";
import { loadLuckMarks, saveLuckMarks, toggleLuck, type LuckMarks } from "./luckMarks";
import { NO_RECAP_CHOICES, type RecapChoices } from "./components/YearInRuns";

interface Loaded {
  fileName: string;
  xml: string;
}

type View = "run" | "profile" | "recap" | "live" | "overlay";
const VIEW_LINKS: Record<Exclude<View, "overlay">, string> = {
  run: "Analyse a run",
  profile: "Profile",
  recap: "Year in runs",
  live: "Live stats",
};
const HASH_VIEWS: Record<string, View> = { "#profile": "profile", "#recap": "recap", "#live": "live", "#live-overlay": "overlay" };
const viewFromHash = (): View => HASH_VIEWS[window.location.hash] ?? "run";
const TIMING_OPTIONS: Array<{ value: TimingMethod; label: string }> = [
  { value: "RealTime", label: "Real time" },
  { value: "GameTime", label: "Game time" },
];
const PRACTISE_NOTE = "Ranked by the time each segment's advice is estimated to be worth.";

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [timing, setTiming] = useState<TimingMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [profile, setProfile] = useState<ProfileEntry[]>(loadProfile);
  // Segments the runner marked as luck-based, per category.
  const [luckMarks, setLuckMarks] = useState<LuckMarks>(loadLuckMarks);
  // The split file behind each profile category, so other pages can open it without choosing it again.
  const [profileFiles, setProfileFiles] = useState<Record<string, StoredSplit>>({});
  // Files added or removed on Year in runs, kept while the app is open.
  const [recapChoices, setRecapChoices] = useState<RecapChoices>(NO_RECAP_CHOICES);
  const picker = useRef<FilePickerHandle>(null);
  const profilePicker = useRef<FilePickerHandle>(null);
  const recapPicker = useRef<FilePickerHandle>(null);
  const tabsTop = useRef<HTMLDivElement>(null);

  // Only the desktop app's main window checks for new versions; the overlay and the web app don't.
  const updates = useUpdates(isDesktop && view !== "overlay");

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveLuckMarks(luckMarks), [luckMarks]);
  useEffect(() => {
    let live = true;
    void loadSplitFiles().then((stored) => {
      // Anything added while the store was loading is newer, so it wins.
      if (live) setProfileFiles((now) => ({ ...stored, ...now }));
    });
    return () => {
      live = false;
    };
  }, []);
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
      const parsed = parseLss(loaded.xml, timing ? { timingMethod: timing } : {});
      const run = markLuck(parsed, luckMarks[categoryKey(parsed)] ?? []);
      const analysis = analyzeRun(run);
      return {
        run,
        analysis,
        luckSuggestions: suggestLuckSegments(parsed),
        score: scoreRun(run, analysis),
        odds: pbOdds(run),
        sessions: analyzeSessions(run),
        hasGameTime: hasGameTime(loaded.xml),
      };
    } catch {
      return { error: true as const };
    }
  }, [loaded, timing, luckMarks]);

  const backFromOverlay = useCallback(() => {
    // A pop-up or desktop overlay window closes; a main window showing the overlay goes back to the live page.
    if (isOverlayWindow()) void closeThisWindow();
    else if (window.opener) window.close();
    else {
      setView("live");
      history.replaceState(null, "", "#live");
    }
  }, []);

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

  const keepInProfile = (score: CategoryScore, fileName: string, xml: string) => {
    const key = categoryKey(score);
    setProfile((p) => upsertEntry(p, score, fileName));
    setProfileFiles((f) => ({ ...f, [key]: { fileName, xml } }));
    void putSplitFile(key, { fileName, xml });
    // A category put back in the profile comes back to Year in runs too.
    setRecapChoices((c) => ({ ...c, removed: c.removed.filter((k) => k !== key) }));
  };

  const removeFromProfile = (key: string) => {
    setProfile((p) => p.filter((e) => e.key !== key));
    setProfileFiles(({ [key]: _gone, ...rest }) => rest);
    void deleteSplitFile(key);
  };

  /** Scores a split file with the luck marks saved for its category. */
  const scoreWithLuck = (xml: string, method: TimingMethod | null, marks: LuckMarks = luckMarks) => {
    const run = parseLss(xml, method ? { timingMethod: method } : {});
    return scoreRun(markLuck(run, marks[categoryKey(run)] ?? []));
  };

  const markSegmentLuck = (category: string, segmentName: string, on: boolean) => {
    const next = toggleLuck(luckMarks, category, segmentName, on);
    setLuckMarks(next);
    // A profile category's saved score follows its marks.
    const entry = profile.find((e) => e.key === category);
    const file = profileFiles[category];
    if (entry && file) {
      try {
        const score = scoreWithLuck(file.xml, hasGameTime(file.xml) ? entry.score.timingMethod : null, next);
        setProfile((p) => p.map((e) => (e.key === category ? { ...e, score } : e)));
      } catch {
        // The stored file no longer parses; its old score stays.
      }
    }
  };

  const addToProfile = (fileName: string, xml: string) => {
    try {
      // A file replacing one in the profile keeps the timing method chosen for that category.
      const run = parseLss(xml);
      const before = profile.find((e) => e.key === categoryKey(run))?.score.timingMethod;
      const method = before && before !== run.timingMethod && hasGameTime(xml) ? before : null;
      keepInProfile(scoreWithLuck(xml, method), fileName, xml);
    } catch {
      setError(notSplitsAdded(fileName));
    }
  };

  const load = (fileName: string, xml: string) => {
    setError(null);
    setTiming(null);
    setSelected(null);
    setLoaded({ fileName, xml });
  };

  const openFromProfile = (key: string) => {
    const file = profileFiles[key];
    if (!file) return;
    load(file.fileName, file.xml);
    // Open it with the timing method it was scored with.
    const method = profile.find((e) => e.key === key)?.score.timingMethod;
    if (method && hasGameTime(file.xml)) setTiming(method);
    go("run");
  };

  // Profile categories whose split file is kept, so they can be opened or recapped.
  const savedRuns = profile.filter((e) => profileFiles[e.key]);
  const recapProfileFiles = useMemo(
    () =>
      profile.flatMap((e) =>
        profileFiles[e.key] ? [{ key: e.key, ...profileFiles[e.key], timingMethod: e.score.timingMethod }] : [],
      ),
    [profile, profileFiles],
  );
  const recapOpen = useMemo(() => loaded && { ...loaded, timingMethod: timing ?? undefined }, [loaded, timing]);

  const selectSegment = (index: number) => {
    showTab("segments", { scroll: false });
    setSelected(index);
    document.getElementById(`segment-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const ok = result && "analysis" in result && result.analysis ? result : null;
  const a = ok?.analysis;

  if (view === "overlay") return <LiveOverlay onBack={backFromOverlay} />;

  return (
    <>
      <header className="shell">
        <div className="shell-inner">
          <span className="brand">Speedrunner</span>
          <nav className="shell-nav" aria-label="Page">
            {(["run", "profile", "recap", "live"] as const)
              .filter((v) => v !== view)
              .map((v) => (
                <ActionLink key={v} href={v === "run" ? "#" : `#${v}`} className="keep" onClick={() => go(v)}>
                  {VIEW_LINKS[v]}
                </ActionLink>
              ))}
            {view === "profile" && profile.length > 0 && (
              <>
                <ActionLink
                  href="#how-it-works"
                  onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                >
                  How it's calculated
                </ActionLink>
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
        {updates.update && updates.version && (
          <UpdateBanner update={updates.update} current={updates.version} onDismiss={updates.dismiss} />
        )}
        {view === "profile" && (
          <>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Profile
              ref={profilePicker}
              entries={profile}
              onAdd={(name, xml) => {
                setError(null);
                addToProfile(name, xml);
              }}
              onError={setError}
              onRemove={removeFromProfile}
              canOpen={(key) => !!profileFiles[key]}
              onOpen={openFromProfile}
              onSetReference={(key, time) =>
                setProfile((p) => p.map((e) => (e.key === key ? { ...e, typedReference: time } : e)))
              }
            />
          </>
        )}

        {view === "recap" && (
          <YearInRuns
            ref={recapPicker}
            profileFiles={recapProfileFiles}
            open={recapOpen}
            choices={recapChoices}
            onChoicesChange={setRecapChoices}
          />
        )}

        {view === "live" && (
          <LivePage
            loaded={loaded}
            runs={savedRuns.map((e) => ({
              key: e.key,
              label: categoryName(e.score),
              file: profileFiles[e.key],
            }))}
          />
        )}

        {view === "run" && (
          <>
        {!ok && (
          <Landing title="Find where your run loses time">
            Load your LiveSplit splits to see a realistic target time, which segments to practise first, and how every
            number is worked out.
          </Landing>
        )}

        <FilePicker ref={picker} onLoad={load} onError={setError} compact={!!ok} sampleFromUrl />

        {!ok && savedRuns.length > 0 && <ProfileRuns entries={savedRuns} onOpen={openFromProfile} />}

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {result && "error" in result && (
          <ErrorMessage>
            We couldn't read that file as LiveSplit splits. Make sure it's an .lss file saved from LiveSplit, not a
            layout (.lsl) or a renamed file.
          </ErrorMessage>
        )}

        {ok && a && (
          <main className="results">
            <PageHead
              title={
                <>
                  {a.game || "Unknown game"} <span>{a.category}</span>
                </>
              }
              meta={
                <>
                  {loaded?.fileName} · {a.attemptCount.toLocaleString("en-US")} attempts ·{" "}
                  {a.finishedAttempts.toLocaleString("en-US")} finished
                </>
              }
            >
              {ok.hasGameTime && (
                <Toggle label="Timing method" options={TIMING_OPTIONS} value={ok.run.timingMethod} onChange={setTiming} />
              )}
            </PageHead>

            <div ref={tabsTop} />
            <RunTabs value={tab} onChange={(t) => showTab(t)} />

            <TabPanel tab="overview" current={tab}>
              <Summary analysis={a} />
              <RouteStrip segments={a.segments} onSelect={selectSegment} />

              <Section titleId="top-practise-title" title="What to practise first" note={PRACTISE_NOTE}>
                <AdviceList advice={a.advice} onSelect={selectSegment} limit={3} onMore={() => showTab("practise")} />
              </Section>

              {ok.odds && (
                <Section titleId="odds-title" title="Your PB odds" note="How often an attempt beats your PB at your current form.">
                  <PbOddsSummary odds={ok.odds} />
                </Section>
              )}

              <Section
                titleId="score-title"
                title="How well you run this category"
                note="From 0 to 100, worked out from this file alone so it compares across games."
              >
                <ScoreBreakdown score={ok.score} />
                <ProfileAction
                  inProfile={profile.find((e) => e.key === categoryKey(ok.score))}
                  stored={profileFiles[categoryKey(ok.score)]}
                  timingMethod={ok.run.timingMethod}
                  fileName={loaded!.fileName}
                  xml={loaded!.xml}
                  onAdd={() => keepInProfile(ok.score, loaded!.fileName, loaded!.xml)}
                  onView={() => go("profile")}
                />
              </Section>
            </TabPanel>

            <TabPanel tab="practise" current={tab}>
              <Section titleId="practise-title" title="What to practise first" note={PRACTISE_NOTE}>
                <AdviceList advice={a.advice} onSelect={selectSegment} />
              </Section>

              <Section titleId="plan-title" title="Practice plan" note="Where an hour of practice takes the most time off a typical run.">
                <PracticePlan run={ok.run} analysis={a} onSelect={selectSegment} />
              </Section>

              {ok.odds && (
                <Section
                  titleId="reset-title"
                  title={PB_ODDS_METRICS.reset.label}
                  tip={PB_ODDS_METRICS.reset}
                  note="Whether a run that's behind PB pace is still worth playing on."
                >
                  <ResetCoach odds={ok.odds} />
                </Section>
              )}

              <GoalPlanner
                key={`${loaded!.fileName}:${ok.run.timingMethod}`}
                run={ok.run}
                analysis={a}
                xml={loaded!.xml}
                fileName={loaded!.fileName}
                odds={ok.odds}
              />
            </TabPanel>

            <TabPanel tab="segments" current={tab}>
              <Section titleId="time-title" title="Where the time is" note="How much each segment could give back against your PB.">
                <SavingsChart segments={a.segments} />
              </Section>

              <Section
                titleId="segments-title"
                title="All segments"
                note={
                  <>
                    Stats use only <ExplainLink id="clean-time">clean segment times</ExplainLink>.
                  </>
                }
              >
                <SegmentTable
                  segments={a.segments}
                  selected={selected}
                  luck={{
                    suggestions: ok.luckSuggestions,
                    onToggle: (name, on) => markSegmentLuck(categoryKey(ok.run), name, on),
                  }}
                />
              </Section>
            </TabPanel>

            <TabPanel tab="sessions" current={tab}>
              <Section
                titleId="sessions-title"
                title="How your sessions go"
                note="Warm-up, fatigue and tilt, stated only when enough sessions back them."
              >
                <SessionInsights insights={ok.sessions} />
              </Section>
            </TabPanel>

            <TabPanel tab="how" current={tab}>
              <HowItWorks analysis={a} score={ok.score} odds={ok.odds} />
            </TabPanel>
          </main>
        )}
          </>
        )}

        <footer className="footer">
          Your splits never leave {isDesktop ? "your computer" : "your browser"}.
          {updates.version && <VersionNote version={updates.version} checking={updates.checking} onChange={updates.setChecking} />}
          <Appearance />
        </footer>
      </div>
    </>
  );
}

/** Adds the loaded run to the profile, or says it's already there. */
function ProfileAction({
  inProfile,
  stored,
  timingMethod,
  fileName,
  xml,
  onAdd,
  onView,
}: {
  inProfile: ProfileEntry | undefined;
  /** The profile's copy of this category's split file, if it's kept. */
  stored: StoredSplit | undefined;
  timingMethod: TimingMethod;
  fileName: string;
  xml: string;
  onAdd: () => void;
  onView: () => void;
}) {
  const viewLink = (
    <ActionLink href="#profile" onClick={onView}>
      View your profile
    </ActionLink>
  );
  const sameFile = inProfile?.fileName === fileName;
  // Older profiles may not have kept the file; then the name is all there is to go on.
  const sameContents = stored ? stored.xml === xml : sameFile;
  const sameTiming = inProfile?.score.timingMethod === timingMethod;
  if (sameFile && sameContents && sameTiming) {
    return <p className="section-foot">This category is in your profile. {viewLink}</p>;
  }
  const clock = (m: TimingMethod) => (m === "GameTime" ? "game time" : "real time");
  return (
    <p className="section-foot profile-action">
      <button onClick={onAdd}>{!inProfile ? "Add to your profile" : sameFile ? "Update in your profile" : "Replace in your profile"}</button>
      {inProfile ? (
        <span>
          {!sameFile
            ? `Your profile has this category from ${inProfile.fileName}.`
            : !sameContents
              ? `Your profile has an older copy of ${fileName}.`
              : `Your profile has this category in ${clock(inProfile.score.timingMethod)}.`}
        </span>
      ) : (
        <span>Saved {isDesktop ? "on this computer" : "in this browser"} only.</span>
      )}
    </p>
  );
}
