import { useEffect, useRef, useState } from "react";
import { LIVE_RUN_KEY, loadLiveConfig, saveLiveConfig, type LiveConfig } from "../live/config";
import { DEFAULT_LIVESPLIT_URL, DEMO_SPEEDS, type DemoSpeed } from "../live/feeds";
import { DEFAULT_CHOICES, LIVE_STATS, STAT_BY_ID, type StatChoice } from "../live/stats";
import { useLive } from "../live/useLive";
import { isDesktop } from "../platform";
import { loadSplitFiles, putSplitFile, type StoredSplit } from "../splitFiles";
import { FilePicker, type FilePickerHandle } from "./FilePicker";
import { ArrowDownIcon, ArrowUpIcon, GripIcon } from "./Icons";
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
  label: "Timer source",
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
    void putSplitFile(LIVE_RUN_KEY, next);
  };

  const view = useLive(file?.xml ?? null, config);
  const run = view.ctx?.run;
  const title = run ? `${run.game || "Unknown game"} · ${run.category}` : "";

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
  // Dragging a row by its handle reorders the card as the pointer crosses the middle of another row.
  const [dragging, setDragging] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const dragTo = (id: string, y: number) => {
    const rows = Array.from(list.current?.querySelectorAll<HTMLElement>("[data-stat-row]") ?? []);
    const others = rows.filter((r) => r.dataset.statRow !== id);
    const to = others.filter((r) => {
      const box = r.getBoundingClientRect();
      return box.top + box.height / 2 < y;
    }).length;
    const from = shown.findIndex((c) => c.id === id);
    if (from < 0 || to === from) return;
    const next = [...shown];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setLists(next, hidden);
  };
  const endDrag = () => {
    if (!dragging) return;
    const at = shown.findIndex((c) => c.id === dragging);
    setAnnouncement(`${label(dragging)} moved to ${at + 1} of ${shown.length}.`);
    setDragging(null);
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
            {title}
            {/\.lss$/i.test(file.fileName) && <> · {file.fileName}</>}
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
              Timer source <InfoTip doc={SOURCE_DOC} />
            </h2>
            <div className="toggle" role="group" aria-label="Timer source">
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
            <div className="live-stats-head">
              <h2 id="live-stats-title">On the card</h2>
              <button
                className="link-button text-link"
                onClick={() => {
                  update({ stats: DEFAULT_CHOICES });
                  setAnnouncement("Stats reset to the standard set.");
                }}
              >
                Reset to standard
              </button>
            </div>
            {shown.length === 0 ? (
              <p className="section-note">No stats yet. Add some from the list below.</p>
            ) : (
              <ol ref={list} className="live-choices" aria-label="Stats on the card, in order">
                {shown.map((c, i) => {
                  const def = STAT_BY_ID.get(c.id)!;
                  return (
                    <li key={c.id} data-stat-row={c.id} data-dragging={dragging === c.id || undefined}>
                      <span
                        className="live-grip"
                        aria-hidden="true"
                        title="Drag to reorder"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDragging(c.id);
                        }}
                        onPointerMove={(e) => dragging === c.id && dragTo(c.id, e.clientY)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      >
                        <GripIcon />
                      </span>
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
                : "A small window to keep next to LiveSplit or capture in OBS. Press Esc in it to close it."}
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
