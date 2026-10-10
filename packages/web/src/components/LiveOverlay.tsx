import { useEffect, useState } from "react";
import { LIVE_CONFIG_EVENT, LIVE_RUN_KEY, isLiveConfigKey, loadLiveConfig } from "../live/config";
import { useLive } from "../live/useLive";
import { loadSplitFiles, type StoredSplit } from "../splitFiles";
import { LiveCard } from "./LiveCard";

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

  return (
    <div className="live-overlay">
      {file === null && (
        <p className="live-card-empty">
          Choose a split file on the{" "}
          <a href="#live" onClick={(e) => (e.preventDefault(), onBack())}>
            Live stats
          </a>{" "}
          page first.
        </p>
      )}
      {run && view.stats && (
        <LiveCard
          title={`${run.game || "Unknown game"} · ${run.category}`}
          stats={view.stats}
          session={view.session}
          status={view.status}
          choices={config.stats}
        />
      )}
    </div>
  );
}
