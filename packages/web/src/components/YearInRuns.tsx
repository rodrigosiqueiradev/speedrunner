import { parseLss, recapYears, undatedAttempts, yearRecap, type Run } from "@speedrunner/core";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { localPlace } from "../platform";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardHighlights,
  cardStats,
  categoriesLine,
  categoryName,
  drawRecapCard,
  loadCardFonts,
} from "../recapCard";
import { RECAP_DOCS } from "../recap-explain";
import { saveFile } from "../download";
import { canCopyImage, canvasToPng, copyPng } from "../shareImage";
import { FilePicker, type FilePickerHandle } from "./FilePicker";
import { Entry } from "./HowItWorks";
import { InfoTip } from "./InfoTip";

interface RecapFile {
  fileName: string;
  run: Run;
}

interface Props {
  /** The split file open on the run page, if any, so the recap can start from it. */
  initial?: { fileName: string; xml: string } | null;
}

const keyOf = (run: Run) => `${run.game.trim().toLowerCase()}|${run.category.trim().toLowerCase()}`;

/** A yearly recap across the runner's split files, drawn as an image they can save and share. */
export const YearInRuns = forwardRef<FilePickerHandle, Props>(function YearInRuns({ initial }, ref) {
  const picker = useRef<FilePickerHandle>(null);
  useImperativeHandle(ref, () => ({ open: () => picker.current?.open() }));
  const [files, setFiles] = useState<RecapFile[]>(() => {
    if (!initial) return [];
    try {
      return [{ fileName: initial.fileName, run: parseLss(initial.xml) }];
    } catch {
      return [];
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const runs = useMemo(() => files.map((f) => f.run), [files]);
  const years = useMemo(() => recapYears(runs), [runs]);
  const shown = year != null && years.includes(year) ? year : (years[0] ?? null);
  const recap = useMemo(() => (shown == null ? null : yearRecap(runs, shown)), [runs, shown]);
  const undated = useMemo(() => undatedAttempts(runs), [runs]);

  useEffect(() => {
    if (!recap) return;
    let live = true;
    void loadCardFonts().then(() => {
      const ctx = live ? canvas.current?.getContext("2d") : null;
      if (ctx) drawRecapCard(ctx, recap);
    });
    return () => {
      live = false;
    };
  }, [recap]);

  const add = (fileName: string, xml: string) => {
    setError(null);
    setStatus(null);
    try {
      const run = parseLss(xml);
      // A newer file for the same game and category replaces the older one, so attempts aren't counted twice.
      setFiles((fs) => [...fs.filter((f) => keyOf(f.run) !== keyOf(run)), { fileName, run }]);
    } catch {
      setError(`We couldn't read "${fileName}" as LiveSplit splits, so it wasn't added.`);
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

  const errorLine = error && (
    <p className="error" role="alert">
      {error}
    </p>
  );

  if (!recap) {
    return (
      <>
        <section className="landing" aria-labelledby="landing-title">
          <h1 id="landing-title">Your year in runs</h1>
          <p className="lede">
            Add the split files for every game and category you ran. You get your attempts, hours played, PBs, best gold,
            most improved segment and longest streak for the year, as an image you can share if you want to.
          </p>
        </section>
        <FilePicker ref={picker} onLoad={add} onError={setError} multiple noSample title="Drop your split files here" />
        {errorLine}
        {files.length > 0 && (
          <p className="error" role="alert">
            {files.length === 1 ? "This file has" : "These files have"} no dated attempts, so there's no year to recap.
            LiveSplit saves a start time with each attempt from version 1.6 onwards.
          </p>
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
      <div className="run-head">
        <div>
          <h1 className="run-title">
            Year in runs <span>{recap.year}</span>
          </h1>
          <p className="run-meta">
            {categoriesLine(recap)} · made {localPlace}, nothing is uploaded
          </p>
        </div>
        {years.length > 1 && (
          <div className="toggle" role="group" aria-label="Year">
            {years.slice(0, 6).map((y) => (
              <button key={y} aria-pressed={y === shown} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
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
              <div className="comparison" role="row" key={st.key}>
                <div className="comparison-name" role="rowheader">
                  <span className="comparison-label">
                    {st.label} <InfoTip doc={RECAP_DOCS[st.key]} />
                  </span>
                </div>
                <div className="comparison-delta" role="cell" />
                <div className="comparison-time" role="cell">
                  {st.value}
                </div>
              </div>
            ))}
            {highlights.map((h) => (
              <div className="comparison recap-highlight" role="row" key={h.key}>
                <div className="comparison-name" role="rowheader">
                  <span className="comparison-label">
                    {h.label} <InfoTip doc={RECAP_DOCS[h.key]} />
                  </span>
                  <span className="comparison-note">
                    {h.title}: {h.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {undated > 0 && (
            <p className="section-note">
              {undated.toLocaleString()} {undated === 1 ? "attempt has" : "attempts have"} no start time in the file, so{" "}
              {undated === 1 ? "it isn't" : "they aren't"} in any year.
            </p>
          )}

          <h2 className="recap-subhead">Split files</h2>
          <ul className="recap-files">
            {files.map((f) => (
              <li key={keyOf(f.run)}>
                <span>
                  {categoryName(f.run)} <span className="recap-file">{f.fileName}</span>
                </span>
                <button
                  className="link-button remove"
                  onClick={() => setFiles((fs) => fs.filter((x) => x !== f))}
                  aria-label={`Remove ${categoryName(f.run)}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="section-foot">
            <button onClick={() => picker.current?.open()}>Add split files</button>
          </p>
        </div>
      </div>

      <section id="how-it-works" className="how" aria-labelledby="how-title">
        <h2 id="how-title">How it's calculated</h2>
        <p className="section-note">Everything is worked out from your split files {localPlace}.</p>
        {Object.values(RECAP_DOCS).map((doc) => (
          <Entry key={doc.id} doc={doc} />
        ))}
      </section>
    </main>
  );
});
