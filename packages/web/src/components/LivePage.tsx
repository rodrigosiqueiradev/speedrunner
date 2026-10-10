import { useEffect, useRef, useState } from "react";
import { LIVE_RUN_KEY, loadLiveConfig, saveLiveConfig, type LiveConfig } from "../live/config";
import { DEFAULT_LIVESPLIT_URL, DEMO_SPEEDS, type DemoSpeed } from "../live/feeds";
import { LIVE_STATS, STAT_BY_ID } from "../live/stats";
import { useLive } from "../live/useLive";
import { isDesktop } from "../platform";
import { loadSplitFiles, putSplitFile, type StoredSplit } from "../splitFiles";
import { FilePicker, type FilePickerHandle } from "./FilePicker";
import { Entry } from "./HowItWorks";
import { InfoTip } from "./InfoTip";
import { LiveCard } from "./LiveCard";

export interface LiveRunOption {
  key: string;
  label: string;
  file: StoredSplit;
}

const SOURCE_DOC = {
  id: "live-source",
  label: "Timer",
  short: "Where the live stats read the timer from: LiveSplit on this computer, or a replay of your own attempts.",
  how: [
    "LiveSplit: Speedrunner connects to LiveSplit's built-in server on this computer and asks for the timer a few times a second. In LiveSplit, right-click › Control › Start WebSocket Server. The port is in LiveSplit's Settings (16834 unless you changed it). It only reads the timer: it never splits or resets for you, and nothing leaves your computer.",
    "Demo: replays your recent attempts from the split file, resets included, sped up so a whole run takes the time you pick. Use it to choose your stats without running.",
  ],
};

/** The live stats page: pick a run, a timer and which stats to show, and preview the card. */
export function LivePage({ runs, loaded }: { runs: LiveRunOption[]; loaded: StoredSplit | null }) {
  const [config, setConfig] = useState<LiveConfig>(loadLiveConfig);
  const [file, setFile] = useState<StoredSplit | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(config.url);
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
    void putSplitFile(LIVE_RUN_KEY, next);
  };

  const view = useLive(file?.xml ?? null, config);
  const run = view.ctx?.run;
  const title = run ? `${run.game || "Unknown game"} · ${run.category}` : "";

  const move = (index: number, by: number) => {
    const stats = [...config.stats];
    const [item] = stats.splice(index, 1);
    stats.splice(index + by, 0, item);
    update({ stats });
  };

  const openOverlay = () => {
    const url = `${window.location.pathname}${window.location.search}#live-overlay`;
    // The desktop app has one window, so the overlay takes it over; resize it to fit next to LiveSplit.
    if (isDesktop) window.location.hash = "live-overlay";
    else window.open(url, "speedrunner-live", "popup,width=360,height=560");
  };

  const fileMenu = (
    <FilePicker ref={picker} compact onLoad={(fileName, xml) => choose({ fileName, xml })} onError={setError} />
  );

  if (!ready) return null;

  if (!file || view.error) {
    return (
      <>
        <section className="landing" aria-labelledby="live-title">
          <h1 id="live-title">Live stats</h1>
          <p className="lede">
            Pick the split file you're running, then follow LiveSplit's timer with the stats you choose, in a small
            window or a stream overlay.
          </p>
        </section>
        {view.error && (
          <p className="error" role="alert">
            We couldn't read "{file?.fileName}" as LiveSplit splits. Choose the .lss file you saved from LiveSplit.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
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
      <div className="run-head">
        <div>
          <h1 className="run-title">Live stats</h1>
          <p className="run-meta">
            {title} · {file.fileName}
          </p>
        </div>
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
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="live-layout">
        <div className="live-settings">
          <section className="block live-block" aria-labelledby="live-source-title">
            <h2 id="live-source-title" className="title-with-tip">
              Timer <InfoTip doc={SOURCE_DOC} />
            </h2>
            <div className="toggle" role="group" aria-label="Timer">
              {(["livesplit", "demo"] as const).map((s) => (
                <button key={s} aria-pressed={config.source === s} onClick={() => update({ source: s })}>
                  {s === "livesplit" ? "LiveSplit" : "Demo"}
                </button>
              ))}
            </div>
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
                <div className="toggle small" role="group" aria-label="Replay speed">
                  {(Object.keys(DEMO_SPEEDS) as DemoSpeed[]).map((s) => (
                    <button key={s} aria-pressed={config.speed === s} onClick={() => update({ speed: s })}>
                      {DEMO_SPEEDS[s].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="block live-block" aria-labelledby="live-stats-title">
            <h2 id="live-stats-title">Stats to show</h2>
            <p className="section-note">Tick the ones you want and put them in your order.</p>
            <ol className="live-choices">
              {config.stats.map((c, i) => {
                const def = STAT_BY_ID.get(c.id)!;
                return (
                  <li key={c.id} data-shown={c.shown}>
                    <label>
                      <input
                        type="checkbox"
                        checked={c.shown}
                        onChange={() =>
                          update({ stats: config.stats.map((x) => (x.id === c.id ? { ...x, shown: !x.shown } : x)) })
                        }
                      />
                      {def.doc.label}
                    </label>
                    <InfoTip doc={def.doc} />
                    <span className="live-move">
                      <button aria-label={`Move ${def.doc.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                        ↑
                      </button>
                      <button
                        aria-label={`Move ${def.doc.label} down`}
                        disabled={i === config.stats.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="live-preview">
          {view.stats && (
            <LiveCard title={title} stats={view.stats} session={view.session} status={view.status} choices={config.stats} />
          )}
          <p className="live-preview-foot">
            <button onClick={openOverlay}>Open as overlay</button>
            <span>
              {isDesktop
                ? "Fills this window with the card. Press Esc to come back."
                : "A small window to keep next to LiveSplit or capture in OBS."}
            </span>
          </p>
        </div>
      </div>

      <section className="how live-how" aria-labelledby="live-how-title">
        <h2 id="live-how-title">How it's calculated</h2>
        <p className="section-note">Every stat compares the run with your own history in the split file.</p>
        <Entry doc={SOURCE_DOC} />
        {LIVE_STATS.map((s) => (
          <Entry key={s.id} doc={s.doc} />
        ))}
      </section>
    </main>
  );
}
