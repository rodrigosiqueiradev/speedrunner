import { hasGameTime, parseLss, recapYears, undatedAttempts, yearRecap, type Run, type TimingMethod } from "@speedrunner/core";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { localPlace } from "../platform";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardHighlights,
  cardStats,
  categoriesLine,
  drawRecapCard,
  loadCardFonts,
} from "../recapCard";
import { RECAP_DOCS } from "../recap-explain";
import { APPEARANCE_EVENT } from "../theme";
import { RECAP_FILES_DOC } from "../saved-files-explain";
import { saveFile } from "../download";
import { categoryName, notSplitsAdded } from "../format";
import { canCopyImage, canvasToPng, copyPng } from "../shareImage";
import { FilePicker, type FilePickerHandle } from "./FilePicker";
import { Entry } from "./HowItWorks";
import { TextButton, Toggle } from "./Controls";
import { InfoTip } from "./InfoTip";
import { ErrorMessage, HowSection, Landing, PageHead } from "./Layout";
import { StatRow } from "./Metric";

type Source = "profile" | "open" | "added";

interface RecapFile {
  fileName: string;
  run: Run;
  source: Source;
}

/** What the runner changed on this page: files added here, and categories taken out of the recap. */
export interface RecapChoices {
  added: Array<{ fileName: string; run: Run }>;
  removed: string[];
}

export const NO_RECAP_CHOICES: RecapChoices = { added: [], removed: [] };

interface Props {
  /** The split files kept with the profile, by category key. */
  profileFiles: Array<{ key: string; fileName: string; xml: string; timingMethod?: TimingMethod }>;
  /** The split file open on the run page, if any, read with the timing method chosen there. */
  open?: { fileName: string; xml: string; timingMethod?: TimingMethod } | null;
  choices: RecapChoices;
  onChoicesChange: (next: RecapChoices) => void;
}

const keyOf = (run: Run) => `${run.game.trim().toLowerCase()}|${run.category.trim().toLowerCase()}`;

const tryParse = (xml: string, timingMethod?: TimingMethod): Run | null => {
  try {
    return parseLss(xml, timingMethod && hasGameTime(xml) ? { timingMethod } : {});
  } catch {
    return null;
  }
};

// Profile files are the usual case, so only the others are flagged.
const SOURCE_NOTE: Record<Source, string | null> = {
  profile: null,
  open: "open in Analyse a run",
  added: "added here",
};

/** A yearly recap across the runner's split files, drawn as an image they can save and share. */
export const YearInRuns = forwardRef<FilePickerHandle, Props>(function YearInRuns(
  { profileFiles, open, choices, onChoicesChange },
  ref,
) {
  const picker = useRef<FilePickerHandle>(null);
  useImperativeHandle(ref, () => ({ open: () => picker.current?.open() }));

  // Parsed profile files, kept while they're unchanged: a profile score changing (a luck mark, say)
  // rebuilds the list but shouldn't read every split file again.
  const parsedProfile = useRef(new Map<string, ReturnType<typeof tryParse>>());
  const profileRuns = useMemo(() => {
    const before = parsedProfile.current;
    const now = new Map<string, ReturnType<typeof tryParse>>();
    const runs = profileFiles.flatMap((f) => {
      const key = `${f.timingMethod ?? ""}\n${f.xml}`;
      if (!now.has(key)) now.set(key, before.has(key) ? (before.get(key) ?? null) : tryParse(f.xml, f.timingMethod));
      const run = now.get(key) ?? null;
      return run ? [{ fileName: f.fileName, run, source: "profile" as const }] : [];
    });
    parsedProfile.current = now;
    return runs;
  }, [profileFiles]);
  const openRun = useMemo(() => (open ? tryParse(open.xml, open.timingMethod) : null), [open]);

  // One file per game and category, so attempts aren't counted twice: a file added here wins, then the
  // profile's, then the one open on the run page.
  const candidates = useMemo(() => {
    const byKey = new Map<string, RecapFile>();
    if (open && openRun) byKey.set(keyOf(openRun), { fileName: open.fileName, run: openRun, source: "open" });
    for (const f of profileRuns) byKey.set(keyOf(f.run), f);
    for (const f of choices.added) byKey.set(keyOf(f.run), { ...f, source: "added" });
    return [...byKey.values()];
  }, [open, openRun, profileRuns, choices.added]);
  const files = useMemo(() => candidates.filter((f) => !choices.removed.includes(keyOf(f.run))), [candidates, choices.removed]);
  const leftOut = useMemo(() => candidates.filter((f) => choices.removed.includes(keyOf(f.run))), [candidates, choices.removed]);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const runs = useMemo(() => files.map((f) => f.run), [files]);
  const yearsOf = useMemo(() => new Map(files.map((f) => [f, recapYears([f.run])])), [files]);
  const years = useMemo(() => recapYears(runs), [runs]);
  const shown = year != null && years.includes(year) ? year : (years[0] ?? null);
  const recap = useMemo(() => (shown == null ? null : yearRecap(runs, shown)), [runs, shown]);
  const undated = useMemo(() => undatedAttempts(runs), [runs]);

  useEffect(() => {
    if (!recap) return;
    let live = true;
    const draw = () => {
      const ctx = live ? canvas.current?.getContext("2d") : null;
      if (ctx) drawRecapCard(ctx, recap);
    };
    void loadCardFonts().then(draw);
    // The card follows the app's theme, so a change of mode or palette draws it again.
    window.addEventListener(APPEARANCE_EVENT, draw);
    return () => {
      live = false;
      window.removeEventListener(APPEARANCE_EVENT, draw);
    };
  }, [recap]);

  const add = (fileName: string, xml: string) => {
    setError(null);
    setStatus(null);
    try {
      const run = parseLss(xml);
      const key = keyOf(run);
      // A newer file for the same game and category replaces the older one, so attempts aren't counted twice.
      onChoicesChange({
        added: [...choices.added.filter((f) => keyOf(f.run) !== key), { fileName, run }],
        removed: choices.removed.filter((k) => k !== key),
      });
    } catch {
      setError(notSplitsAdded(fileName));
    }
  };

  const fileName = `year-in-runs-${shown}.png`;
  const save = async () => {
    try {
      saveFile(fileName, await canvasToPng(canvas.current!));
      setStatus(`Saved as ${fileName} in your downloads.`);
    } catch {
      setStatus("The image couldn't be saved. Try copying it instead.");
    }
  };
  const copy = async () => {
    try {
      await copyPng(await canvasToPng(canvas.current!));
      setStatus("Copied. Paste it wherever you want to share it.");
    } catch {
      setStatus("The image couldn't be copied. Save it instead.");
    }
  };

  const errorLine = error && <ErrorMessage>{error}</ErrorMessage>;

  if (!recap) {
    return (
      <>
        <Landing title="Your year in runs">
          Add the split files for every game and category you ran. You get your attempts, hours played, PBs, best gold,
          most improved segment and longest streak for the year, as an image you can share if you want to.
        </Landing>
        <FilePicker ref={picker} onLoad={add} onError={setError} multiple noSample title="Drop your split files here" />
        {errorLine}
        {leftOut.length > 0 && (
          <p className="section-foot recap-left-out">
            You left out {leftOut.map((f) => categoryName(f.run)).join(", ")}.{" "}
            <TextButton onClick={() => onChoicesChange({ ...choices, removed: [] })}>
              Put {leftOut.length === 1 ? "it" : "them"} back
            </TextButton>
          </p>
        )}
        {files.length > 0 && (
          <ErrorMessage>
            {files.length === 1 ? "This file has" : "These files have"} no dated attempts, so there's no year to recap.
            LiveSplit saves a start time with each attempt from version 1.6 onwards.
          </ErrorMessage>
        )}
      </>
    );
  }

  const stats = cardStats(recap);
  const highlights = cardHighlights(recap);
  const summary = `${recap.year}: ${stats.map((s) => `${s.label} ${s.value}`).join(", ")}. ${highlights
    .map((h) => `${h.label}: ${h.title}, ${h.detail}`)
    .join(". ")}`;

  return (
    <main className="results">
      <FilePicker ref={picker} onLoad={add} onError={setError} multiple compact />
      <PageHead
        title={
          <>
            Year in runs <span>{recap.year}</span>
          </>
        }
        meta={`${categoriesLine(recap)} · made ${localPlace}, nothing is uploaded`}
        metaTitle={recap.categories.map(categoryName).join(", ")}
      >
        {years.length > 1 && (
          <Toggle
            label="Year"
            options={years.slice(0, 6).map((y) => ({ value: y, label: y }))}
            value={recap.year}
            onChange={setYear}
          />
        )}
      </PageHead>
      {errorLine}

      <div className="recap">
        <canvas
          ref={canvas}
          className="recap-card"
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          role="img"
          aria-label={summary}
        />
        <div className="recap-side">
          <div className="recap-actions">
            <button className="primary" onClick={save}>
              Save as PNG
            </button>
            {canCopyImage() && <button onClick={copy}>Copy image</button>}
          </div>
          {status && (
            <p className="section-foot" role="status">
              {status}
            </p>
          )}
          <p className="section-note">
            The image is made {localPlace} and only leaves it if you share it yourself.
          </p>

          <h2 className="recap-subhead">On the card</h2>
          <div className="comparisons recap-stats" role="table" aria-label="On the card">
            {stats.map((st) => (
              <StatRow key={st.key} doc={RECAP_DOCS[st.key]} label={st.label} value={st.value} />
            ))}
            {highlights.map((h) => (
              <StatRow
                key={h.key}
                className="recap-highlight"
                doc={RECAP_DOCS[h.key]}
                label={h.label}
                note={`${h.title}: ${h.detail}`}
              />
            ))}
          </div>
          {undated > 0 && (
            <p className="section-note">
              {undated.toLocaleString("en-US")} {undated === 1 ? "attempt has" : "attempts have"} no start time in the file, so{" "}
              {undated === 1 ? "it isn't" : "they aren't"} in any year.
            </p>
          )}

          <h2 className="recap-subhead title-with-tip">
            {RECAP_FILES_DOC.label} <InfoTip doc={RECAP_FILES_DOC} />
          </h2>
          <ul className="recap-files">
            {files.map((f) => (
              <li key={keyOf(f.run)}>
                <span>
                  {categoryName(f.run)} <span className="recap-file">{f.fileName}</span>
                  {SOURCE_NOTE[f.source] && <span className="flag muted">{SOURCE_NOTE[f.source]}</span>}
                  {!yearsOf.get(f)?.includes(recap.year) && <span className="flag muted">none in {recap.year}</span>}
                </span>
                <button
                  className="link-button remove"
                  onClick={() =>
                    onChoicesChange({
                      added: choices.added.filter((x) => keyOf(x.run) !== keyOf(f.run)),
                      removed: [...choices.removed, keyOf(f.run)],
                    })
                  }
                  aria-label={
                    f.source === "added" ? `Remove ${categoryName(f.run)}` : `Leave ${categoryName(f.run)} out of this recap`
                  }
                >
                  {f.source === "added" ? "Remove" : "Leave out"}
                </button>
              </li>
            ))}
            {leftOut.map((f) => (
              <li key={keyOf(f.run)} className="left-out">
                <span>
                  {categoryName(f.run)} <span className="flag muted">left out</span>
                </span>
                <TextButton
                  onClick={() => onChoicesChange({ ...choices, removed: choices.removed.filter((k) => k !== keyOf(f.run)) })}
                  aria-label={`Put ${categoryName(f.run)} back in this recap`}
                >
                  Put back
                </TextButton>
              </li>
            ))}
          </ul>
          <p className="section-foot">
            <button onClick={() => picker.current?.open()}>Add split files</button>
          </p>
        </div>
      </div>

      <HowSection note={`Everything is worked out from your split files ${localPlace}.`}>
        {Object.values(RECAP_DOCS).map((doc) => (
          <Entry key={doc.id} doc={doc} />
        ))}
        <Entry doc={RECAP_FILES_DOC} />
      </HowSection>
    </main>
  );
});
