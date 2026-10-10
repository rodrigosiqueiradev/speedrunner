import type { TimingMethod } from "@speedrunner/core";
import { useEffect, useRef, useState } from "react";
import { LIVE_RUN_KEY, loadLiveConfig, saveLiveConfig, saveLiveRun, type LiveConfig } from "../live/config";
import { useSplitsSync, type SplitsSync } from "../live/useSplitsSync";
import { DEFAULT_LIVESPLIT_URL, DEMO_SPEEDS, type DemoSpeed } from "../live/feeds";
import { DEFAULT_CHOICES, LIVE_STATS, STAT_BY_ID, type StatChoice } from "../live/stats";
import {
  DEFAULT_STYLE,
  LABEL_SIZES,
  STYLE_COLOURS,
  VALUE_SIZES,
  isDefaultStyle,
  lowContrast,
  type CardStyle,
} from "../live/style";
import { useLive } from "../live/useLive";
import { openOverlayWindow } from "../desktopWindows";
import { isDesktop } from "../platform";
import { loadSplitFiles, type StoredSplit } from "../splitFiles";
import { TextButton, Toggle } from "./Controls";
import { FilePicker, type FilePickerHandle } from "./FilePicker";
import { ArrowDownIcon, ArrowUpIcon } from "./Icons";
import { Entry } from "./HowItWorks";
import { InfoTip } from "./InfoTip";
import { ErrorMessage, HowSection, Landing, PageHead } from "./Layout";
import { LiveCard, liveTitle } from "./LiveCard";

export interface LiveRunOption {
  key: string;
  label: string;
  file: StoredSplit;
}

const SOURCE_DOC = {
  id: "live-source",
  label: "Timer source",
  short: "Where the live stats read the timer from: LiveSplit on this computer, or a replay of your own attempts.",
  how: [
    "LiveSplit: Speedrunner connects to LiveSplit's built-in server on this computer and asks for the timer a few times a second. In LiveSplit, right-click › Control › Start WebSocket Server. The port is in LiveSplit's Settings (16834 unless you changed it). It only reads the timer: it never splits or resets for you, and nothing leaves your computer.",
    "Demo: replays your recent attempts from the split file, resets included, sped up so a whole run takes the time you pick. Use it to choose your stats without running.",
    "Timing: when the split file has game times, the stats use the same clock as LiveSplit, real time or game time, since LiveSplit sends its times in the clock it compares against. Newer LiveSplit versions say which one that is and the page follows it. With older ones, pick the same one as LiveSplit (right-click › Compare Against).",
  ],
};

const SOURCES: Array<{ value: LiveConfig["source"]; label: string }> = [
  { value: "livesplit", label: "LiveSplit" },
  { value: "demo", label: "Demo" },
];
const TIMINGS: Array<{ value: TimingMethod; label: string }> = [
  { value: "RealTime", label: "Real time" },
  { value: "GameTime", label: "Game time" },
];
const SPEEDS = (Object.keys(DEMO_SPEEDS) as DemoSpeed[]).map((s) => ({ value: s, label: DEMO_SPEEDS[s].label }));

/** The live stats page: pick a run, a timer and which stats to show, and preview the card. */
export function LivePage({ runs, loaded }: { runs: LiveRunOption[]; loaded: StoredSplit | null }) {
  const [config, setConfig] = useState<LiveConfig>(loadLiveConfig);
  const [file, setFile] = useState<StoredSplit | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(config.url);
  const [announcement, setAnnouncement] = useState("");
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfter.current) return;
    document.querySelector<HTMLButtonElement>(focusAfter.current)?.focus();
    focusAfter.current = null;
  });
  const picker = useRef<FilePickerHandle>(null);

  useEffect(() => {
    let live = true;
    void loadSplitFiles().then((files) => {
      if (!live) return;
      setFile((f) => f ?? files[LIVE_RUN_KEY] ?? loaded ?? null);
      setReady(true);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<LiveConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveLiveConfig(next);
  };

  const choose = (next: StoredSplit) => {
    setError(null);
    setFile(next);
    void saveLiveRun(next);
  };

  const view = useLive(file?.xml ?? null, config);
  const sync = useSplitsSync(config.source === "livesplit" ? view.status : null, file, choose);
  const run = view.ctx?.run;
  const title = run ? liveTitle(run) : "";

  const shown = config.stats.filter((c) => c.shown);
  const hidden = config.stats.filter((c) => !c.shown);
  const label = (id: string) => STAT_BY_ID.get(id)!.doc.label;
  // Shown stats come first, in card order; the rest keep their place in the list below.
  const setLists = (nextShown: StatChoice[], nextHidden: StatChoice[]) => update({ stats: [...nextShown, ...nextHidden] });

  const move = (index: number, by: -1 | 1) => {
    const next = [...shown];
    const [item] = next.splice(index, 1);
    const to = index + by;
    next.splice(to, 0, item);
    setLists(next, hidden);
    setAnnouncement(`${label(item.id)} moved to ${to + 1} of ${next.length}.`);
    // At either end the pressed button turns off, so keep focus on the row's other arrow.
    const atEnd = by < 0 ? to === 0 : to === next.length - 1;
    focusAfter.current = `[data-move="${item.id}-${atEnd ? (by < 0 ? "down" : "up") : by < 0 ? "up" : "down"}"]`;
  };
  const show = (id: string) => {
    setLists([...shown, { id, shown: true }], hidden.filter((c) => c.id !== id));
    setAnnouncement(`${label(id)} added to the card, at ${shown.length + 1} of ${shown.length + 1}.`);
  };
  const hide = (id: string) => {
    setLists(shown.filter((c) => c.id !== id), [{ id, shown: false }, ...hidden]);
    setAnnouncement(`${label(id)} taken off the card.`);
  };

  const openOverlay = () => {
    const url = `${window.location.pathname}${window.location.search}#live-overlay`;
    // The desktop app opens its own borderless window; a browser opens a pop-up.
    if (isDesktop) openOverlayWindow().catch(() => setError("The overlay window didn't open. Try again, or restart the app."));
    else window.open(url, "speedrunner-live", "popup,width=360,height=560");
  };

  const fileMenu = (
    <FilePicker ref={picker} compact onLoad={(fileName, xml) => choose({ fileName, xml })} onError={setError} />
  );

  if (!ready) return null;

  if (!file || view.error) {
    return (
      <>
        <Landing title="Live stats" titleId="live-title">
          Pick the split file you're running, then follow LiveSplit's timer with the stats you choose, in a small window
          or a stream overlay.
        </Landing>
        {view.error && (
          <ErrorMessage>
            We couldn't read "{file?.fileName}" as LiveSplit splits. Choose the .lss file you saved from LiveSplit.
          </ErrorMessage>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <FilePicker onLoad={(fileName, xml) => choose({ fileName, xml })} onError={setError} />
        {runs.length > 0 && (
          <section className="profile-runs" aria-labelledby="live-runs-title">
            <h2 id="live-runs-title">Or use a run from your profile</h2>
            <ul className="run-list">
              {runs.map((r) => (
                <li key={r.key}>
                  <span className="run-list-name">{r.label}</span>
                  <button onClick={() => choose(r.file)}>Use</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <main className="live-page">
      <PageHead
        title="Live stats"
        meta={
          <>
            {title}
            {/\.lss$/i.test(file.fileName) && <> · {file.fileName}</>}
          </>
        }
      >
        <div className="live-run-switch">
          {runs.length > 0 && (
            <select
              aria-label="Split file"
              value={runs.find((r) => r.file.xml === file.xml)?.key ?? ""}
              onChange={(e) => {
                const r = runs.find((x) => x.key === e.target.value);
                if (r) choose(r.file);
              }}
            >
              <option value="" disabled>
                Another profile run…
              </option>
              {runs.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => picker.current?.open()}>Choose file</button>
          {fileMenu}
        </div>
      </PageHead>
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="live-layout">
        <div className="live-settings">
          <section className="block live-block" aria-labelledby="live-source-title">
            <h2 id="live-source-title" className="title-with-tip">
              Timer source <InfoTip doc={SOURCE_DOC} />
            </h2>
            <Toggle label="Timer source" options={SOURCES} value={config.source} onChange={(source) => update({ source })} />
            {config.source === "livesplit" ? (
              <form
                className="live-url"
                onSubmit={(e) => {
                  e.preventDefault();
                  update({ url: urlDraft.trim() || DEFAULT_LIVESPLIT_URL });
                }}
              >
                <label htmlFor="live-url">LiveSplit server</label>
                <input id="live-url" value={urlDraft} spellCheck={false} onChange={(e) => setUrlDraft(e.target.value)} />
                <button type="submit" disabled={urlDraft.trim() === config.url}>
                  Connect
                </button>
              </form>
            ) : (
              <div className="live-speed">
                <span className="live-speed-label">Replay speed</span>
                <Toggle small label="Replay speed" options={SPEEDS} value={config.speed} onChange={(speed) => update({ speed })} />
              </div>
            )}
            {view.timing.choice && (
              <div className="live-speed">
                <span className="live-speed-label">Timing</span>
                {view.timing.fromLiveSplit ? (
                  <span className="live-timing-note">
                    {view.timing.method === "GameTime" ? "Game time" : "Real time"}, following LiveSplit
                  </span>
                ) : (
                  <Toggle small label="Timing method" options={TIMINGS} value={config.timing} onChange={(timing) => update({ timing })} />
                )}
              </div>
            )}
          </section>

          <section className="block live-block" aria-labelledby="live-stats-title">
            <div className="live-stats-head">
              <h2 id="live-stats-title">On the card</h2>
              <TextButton
                onClick={() => {
                  update({ stats: DEFAULT_CHOICES });
                  setAnnouncement("Stats reset to the standard set.");
                }}
              >
                Reset to standard
              </TextButton>
            </div>
            {shown.length === 0 ? (
              <p className="section-note">No stats yet. Add some from the list below.</p>
            ) : (
              <ol className="live-choices" aria-label="Stats on the card, in order">
                {shown.map((c, i) => {
                  const def = STAT_BY_ID.get(c.id)!;
                  return (
                    <li key={c.id}>
                      <span className="live-rank">{i + 1}</span>
                      <label>
                        <input type="checkbox" checked onChange={() => hide(c.id)} />
                        {def.doc.label}
                      </label>
                      <InfoTip doc={def.doc} />
                      <span className="live-move">
                        <button
                          data-move={`${c.id}-up`}
                          aria-label={`Move ${def.doc.label} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          data-move={`${c.id}-down`}
                          aria-label={`Move ${def.doc.label} down`}
                          disabled={i === shown.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDownIcon />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {hidden.length > 0 && (
              <>
                <h3 className="live-more-title">More stats</h3>
                <ul className="live-choices live-available" aria-label="Stats not on the card">
                  {hidden.map((c) => {
                    const def = STAT_BY_ID.get(c.id)!;
                    return (
                      <li key={c.id}>
                        <label>
                          <input type="checkbox" checked={false} onChange={() => show(c.id)} />
                          {def.doc.label}
                        </label>
                        <InfoTip doc={def.doc} />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <p className="visually-hidden" role="status" aria-live="polite">
              {announcement}
            </p>
          </section>
          <StyleSettings
            look={config.style}
            onChange={(style) => update({ style })}
            onReset={() => {
              update({ style: DEFAULT_STYLE });
              setAnnouncement("Card style reset to the standard look.");
            }}
          />
        </div>

        <div className="live-preview">
          <SyncNote sync={sync} onChoose={() => picker.current?.open()} onUse={choose} />
          {view.session.pbs > 0 && (
            <p className="live-sync" data-state="missing" role="status">
              <span>
                PB this session. The stats still compare with the PB in this file: save your splits in LiveSplit, then
                choose the file again.
              </span>
              <button onClick={() => picker.current?.open()}>Choose file</button>
            </p>
          )}
          {view.stats && (
            <LiveCard
              title={title}
              stats={view.stats}
              session={view.session}
              status={view.status}
              choices={config.stats}
              look={config.style}
            />
          )}
          <p className="live-preview-foot">
            <button onClick={openOverlay}>Open as overlay</button>
            <span>
              {isDesktop
                ? "A borderless window to keep next to LiveSplit or capture in OBS. Drag it anywhere to move it, and press Esc in it to close it."
                : "A small window to keep next to LiveSplit or capture in OBS. Press Esc in it to close it."}
            </span>
          </p>
        </div>
      </div>

      <HowSection className="live-how" note="Every stat compares the run with your own history in the split file.">
        <Entry doc={SOURCE_DOC} />
        {LIVE_STATS.map((s) => (
          <Entry key={s.id} doc={s.doc} />
        ))}
      </HowSection>
    </main>
  );
}

/** Colours and text sizes for the card, used by the preview and the overlay alike. */
function StyleSettings({ look, onChange, onReset }: { look: CardStyle; onChange: (s: CardStyle) => void; onReset: () => void }) {
  const hard = lowContrast(look);
  return (
    <section className="block live-block" aria-labelledby="live-style-title">
      <div className="live-stats-head">
        <h2 id="live-style-title">Card style</h2>
        <TextButton disabled={isDefaultStyle(look)} onClick={onReset}>
          Reset to standard
        </TextButton>
      </div>
      <ul className="live-style-colours" aria-label="Colours">
        {STYLE_COLOURS.map(({ key, label }) => (
          <li key={key}>
            <label>
              <input type="color" value={look[key] as string} onChange={(e) => onChange({ ...look, [key]: e.target.value })} />
              {label}
            </label>
          </li>
        ))}
      </ul>
      <div className="live-style-sizes">
        <label htmlFor="live-value-size">Value size</label>
        <input
          id="live-value-size"
          type="range"
          min={VALUE_SIZES.min}
          max={VALUE_SIZES.max}
          value={look.valueSize}
          onChange={(e) => onChange({ ...look, valueSize: Number(e.target.value) })}
        />
        <output htmlFor="live-value-size">{look.valueSize}px</output>
        <label htmlFor="live-label-size">Label size</label>
        <input
          id="live-label-size"
          type="range"
          min={LABEL_SIZES.min}
          max={LABEL_SIZES.max}
          value={look.labelSize}
          onChange={(e) => onChange({ ...look, labelSize: Number(e.target.value) })}
        />
        <output htmlFor="live-label-size">{look.labelSize}px</output>
      </div>
      {hard.length > 0 && (
        <p className="live-style-warning" role="status">
          Hard to read on this background: {hard.join(", ").toLowerCase()}.
        </p>
      )}
    </section>
  );
}

/** Says whether the split file follows the one LiveSplit has open. */
function SyncNote({ sync, onChoose, onUse }: { sync: SplitsSync; onChoose: () => void; onUse: (file: StoredSplit) => void }) {
  if (sync.state === "unknown") return null;
  if (sync.state === "different") {
    const { file } = sync;
    return (
      <p className="live-sync" data-state="missing" role="status">
        <span>
          LiveSplit has <strong>{sync.name}</strong> open, not this file.
        </span>
        <button onClick={() => onUse(file)}>Switch to it</button>
      </p>
    );
  }
  if (sync.state === "missing") {
    return (
      <p className="live-sync" data-state="missing" role="status">
        <span>
          LiveSplit has <strong>{sync.name}</strong> open, which isn't in your profile.
        </span>
        <button onClick={onChoose}>Choose file</button>
      </p>
    );
  }
  return (
    <p className="live-sync" role="status">
      {sync.state === "switched" ? "Switched to" : "Matches"} <strong>{sync.name}</strong>, the splits open in LiveSplit.
    </p>
  );
}
