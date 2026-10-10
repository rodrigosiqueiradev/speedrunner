import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { checksForUpdates, dismissVersion, dismissedVersion, findUpdate, setChecksForUpdates, type Update } from "../updates";
import { TextButton } from "./Controls";

/** Reads the desktop app's version, or null where it can't be read. */
async function appVersion(): Promise<string | null> {
  try {
    return await getVersion();
  } catch {
    return null;
  }
}

/**
 * The desktop app's version and its update check, for the window given `enabled`. When the check is on, the app asks the releases
 * repo for the latest version once when it starts, and shows a banner if a newer one is out.
 */
export function useUpdates(enabled: boolean) {
  const [version, setVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(checksForUpdates);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void appVersion().then((v) => live && setVersion(v));
    return () => {
      live = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!checking || !version) return;
    let live = true;
    void findUpdate(version).then((u) => live && u && u.version !== dismissedVersion() && setUpdate(u));
    return () => {
      live = false;
    };
  }, [checking, version]);

  return {
    version,
    update,
    checking,
    setChecking: (on: boolean) => {
      setChecksForUpdates(on);
      setChecking(on);
      if (!on) setUpdate(null);
    },
    dismiss: () => {
      if (update) dismissVersion(update.version);
      setUpdate(null);
    },
  };
}

/** Says a newer version is out, with a button to its download page. */
export function UpdateBanner({ update, current, onDismiss }: { update: Update; current: string; onDismiss: () => void }) {
  return (
    <div className="update-banner" role="status">
      <span>
        <strong>Speedrunner {update.version} is out.</strong> You have {current}.
      </span>
      <span className="update-actions">
        <button className="primary" onClick={() => void openUrl(update.url)}>
          Download
        </button>
        <TextButton onClick={onDismiss}>Not now</TextButton>
      </span>
    </div>
  );
}

/** The app's version in the footer, with the switch for the update check. */
export function VersionNote({ version, checking, onChange }: { version: string; checking: boolean; onChange: (on: boolean) => void }) {
  return (
    <span className="version-note">
      Version {version}
      <label>
        <input type="checkbox" checked={checking} onChange={(e) => onChange(e.target.checked)} /> Check for new versions
      </label>
    </span>
  );
}
