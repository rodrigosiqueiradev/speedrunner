import { formatTime } from "@speedrunner/core";
import { useState } from "react";
import type { ProfileEntry } from "../profile";
import { SAVED_FILES_DOC } from "../saved-files-explain";
import { InfoTip } from "./InfoTip";

const SHOWN = 5;
const title = (e: ProfileEntry) => `${e.score.game || "Unknown game"} ${e.score.category}`.trim();

/** The profile's saved runs on the run page's landing, newest first, so one opens without choosing a file. */
export function ProfileRuns({ entries, onOpen }: { entries: ProfileEntry[]; onOpen: (key: string) => void }) {
  const [all, setAll] = useState(false);
  const sorted = [...entries].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const shown = all ? sorted : sorted.slice(0, SHOWN);

  return (
    <section className="profile-runs" aria-labelledby="profile-runs-title">
      <h2 id="profile-runs-title" className="title-with-tip">
        Or open a run from your profile <InfoTip doc={SAVED_FILES_DOC} />
      </h2>
      <ul className="run-list">
        {shown.map((e) => (
          <li key={e.key}>
            <span className="run-list-name" title={`${title(e)} (${e.fileName})`}>
              {title(e)}
            </span>
            <span className={e.score.personalBest == null ? "run-list-pb none" : "run-list-pb"}>
              {e.score.personalBest == null ? (
                "No finished runs"
              ) : (
                <>
                  <span className="run-list-label">PB</span> {formatTime(e.score.personalBest)}
                </>
              )}
            </span>
            <button onClick={() => onOpen(e.key)} aria-label={`Open ${title(e)}`}>
              Open
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > SHOWN && (
        <p className="section-foot">
          <button className="link-button text-link" onClick={() => setAll((x) => !x)}>
            {all ? "Show fewer" : `Show all ${sorted.length} runs`}
          </button>
        </p>
      )}
    </section>
  );
}
