import { useEffect, useState } from "react";
import { LIVE_CONFIG_EVENT, LIVE_RUN_KEY, isLiveConfigKey, loadLiveConfig, saveLiveRun } from "../live/config";
import { useSplitsSync } from "../live/useSplitsSync";
import { useLive } from "../live/useLive";
import { loadSplitFiles, type StoredSplit } from "../splitFiles";
import { ActionLink } from "./Controls";
import { LiveCard, liveTitle } from "./LiveCard";

/**
 * Just the live card, filling the window: for a small window next to LiveSplit or a stream overlay.
 * It follows the settings chosen on the live page, even while that page is open in another window.
 */
export function LiveOverlay({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState(loadLiveConfig);
  const [file, setFile] = useState<StoredSplit | null | undefined>(undefined);

  useEffect(() => {
    const reload = () => {
      setConfig(loadLiveConfig());
      void loadSplitFiles().then((files) => setFile(files[LIVE_RUN_KEY] ?? null));
    };
    reload();
    const onStorage = (e: StorageEvent) => isLiveConfigKey(e.key) && reload();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("storage", onStorage);
    window.addEventListener(LIVE_CONFIG_EVENT, reload);
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("overlay-mode");
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LIVE_CONFIG_EVENT, reload);
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("overlay-mode");
    };
  }, [onBack]);

  const view = useLive(file?.xml ?? null, config);
  const run = view.ctx?.run;
  // The overlay follows LiveSplit's splits too, since in the desktop app the live page isn't open.
  const sync = useSplitsSync(config.source === "livesplit" ? view.status : null, file ?? null, (next) => {
    setFile(next);
    void saveLiveRun(next);
  });

  return (
    <div className="live-overlay" style={{ background: config.style.background }}>
      {file === null && (
        <p className="live-card-empty">
          Choose a split file on the{" "}
          <ActionLink href="#live" onClick={onBack}>
            Live stats
          </ActionLink>{" "}
          page first.
        </p>
      )}
      <p className="live-overlay-hint">Esc to go back</p>
      {run && view.stats && (
        <LiveCard
          title={liveTitle(run)}
          stats={view.stats}
          session={view.session}
          status={view.status}
          choices={config.stats}
          look={config.style}
          note={
            sync.state === "missing" || sync.state === "different"
              ? `LiveSplit has ${sync.name} open. Choose it on the Live stats page.`
              : null
          }
        />
      )}
    </div>
  );
}
