import { formatTime, overallScore, referencePace, type ComponentKey } from "@speedrunner/core";
import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { SCORE_METRICS, type ScoreDoc } from "../explain";
import { categoryName, formatScore, parseTypedTime } from "../format";
import { localPlace } from "../platform";
import { referenceOf, type ProfileEntry } from "../profile";
import { SAVED_FILES_DOC } from "../saved-files-explain";
import { FilePicker, type FilePickerHandle } from "./FilePicker";
import { Entry, ScoreEntries } from "./HowItWorks";
import { InfoTip } from "./InfoTip";
import { HowSection, Landing, PageHead, Section } from "./Layout";
import { MetricHeader, MetricLabel, StatRow } from "./Metric";
import { ScoreBreakdown } from "./ScoreBreakdown";

interface Props {
  entries: ProfileEntry[];
  onAdd: (fileName: string, xml: string) => void;
  onError: (message: string) => void;
  onRemove: (key: string) => void;
  /** Whether the category's split file is kept, so it can be opened on the run page. */
  canOpen: (key: string) => boolean;
  onOpen: (key: string) => void;
  onSetReference: (key: string, time: number | null) => void;
}

const pace1 = (x: number | null) => (x == null ? "-" : `${(x * 100).toFixed(1)}%`);

const COLUMNS: Array<{ doc: ScoreDoc; cell: (e: ProfileEntry) => string }> = [
  { doc: SCORE_METRICS.category, cell: (e) => formatScore(e.score.score) },
  ...(["efficiency", "consistency", "completion", "improvement"] as ComponentKey[]).map((k) => ({
    doc: SCORE_METRICS[k],
    cell: (e: ProfileEntry) => formatScore(e.score[k].score),
  })),
  {
    doc: SCORE_METRICS.pace,
    cell: (e) => {
      const ref = referenceOf(e);
      return ref ? pace1(referencePace(e.score, ref.time).pbPace) : "-";
    },
  },
];

/** The runner profile: one score per game and category, and an overall score from the best of them. */
export const Profile = forwardRef<FilePickerHandle, Props>(function Profile(
  { entries, onAdd, onError, onRemove, canOpen, onOpen, onSetReference },
  picker,
) {
  const filePicker = useRef<FilePickerHandle>(null);
  useImperativeHandle(picker, () => ({ open: () => filePicker.current?.open() }));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Firm scores first, best first; provisional ones after them.
  const rank = (e: ProfileEntry) => (e.score.score ?? -1) - (e.score.provisional ? 1000 : 0);
  const sorted = [...entries].sort((a, b) => rank(b) - rank(a));
  const selected = sorted.find((e) => e.key === selectedKey) ?? sorted[0] ?? null;

  if (!selected) {
    return (
      <>
        <Landing title="Your runner profile">
          Add a split file for each game and category you run. Each gets a score from 0 to 100 for how well you run it,
          so different games sit on one scale, and your best five make your overall score.
        </Landing>
        <FilePicker ref={filePicker} onLoad={onAdd} onError={onError} multiple noSample title="Drop your split files here" />
      </>
    );
  }

  const overall = overallScore(entries.map((e) => e.score));
  const firm = sorted.filter((e) => !e.score.provisional && e.score.score != null);
  const strongest = firm[0];
  const weakest = firm.length > 1 ? firm.at(-1) : undefined;
  const select = (key: string) => {
    setSelectedKey(key);
    document.getElementById("category-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="results">
      <FilePicker ref={filePicker} onLoad={onAdd} onError={onError} multiple compact />
      <PageHead
        title="Runner profile"
        meta={
          <>
            {entries.length} {entries.length === 1 ? "category" : "categories"} · saved {localPlace}
          </>
        }
      />

      <div className="comparisons" role="table" aria-label="Profile scores">
        <StatRow
          doc={SCORE_METRICS.overall}
          value={formatScore(overall.score)}
          note={
            overall.score == null
              ? "Needs a category that isn't provisional"
              : overall.counted.length === 1
                ? "From your one scored category. Add more to average your best 5"
                : `Average of your ${overall.counted.length} best categories`
          }
          lead
        />
        {strongest && <ScoreRow label="Strongest" entry={strongest} onSelect={select} />}
        {weakest && <ScoreRow label="Weakest" entry={weakest} onSelect={select} />}
      </div>

      <Section
        titleId="categories-title"
        title="Categories"
        note="Each score only uses that category's split file. Pick a category to see how its score is made up."
      >
        <div className="table-wrap">
          <table className="segments profile-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                {COLUMNS.map((c) => (
                  <MetricHeader key={c.doc.id} doc={c.doc} label={c.doc.id === "category-score" ? "Score" : undefined} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.key} className={e.key === selected.key ? "selected" : undefined}>
                  <th scope="row">
                    <button className="link-button" onClick={() => select(e.key)}>
                      {categoryName(e.score)}
                    </button>
                    {e.score.provisional && <span className="flag muted">provisional</span>}
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.doc.id}>{c.cell(e)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="category-detail"
        titleId="detail-title"
        title={categoryName(selected.score)}
        note={
          <>
            From {selected.fileName}, {selected.score.timingMethod === "GameTime" ? "game time" : "real time"},{" "}
            {selected.score.finishedAttempts.toLocaleString("en-US")} finished runs.
          </>
        }
        actions={
          <p className="detail-actions">
            {canOpen(selected.key) ? (
              <button className="primary" onClick={() => onOpen(selected.key)}>
                Analyse this run
              </button>
            ) : (
              <>
                <button onClick={() => filePicker.current?.open()}>Add {selected.fileName} again</button>
                <span>Its split file isn't saved yet.</span>
              </>
            )}
            <InfoTip doc={SAVED_FILES_DOC} />
          </p>
        }
      >
        <ScoreBreakdown score={selected.score} />
        <Reference key={selected.key} entry={selected} onSet={(t) => onSetReference(selected.key, t)} />
        <p className="section-foot">
          <button className="link-button remove" onClick={() => onRemove(selected.key)}>
            Remove {categoryName(selected.score)} from your profile
          </button>
        </p>
      </Section>

      <HowSection
        title="How the score is calculated"
        note={
          <>
            Everything is worked out from your split files {localPlace}. Examples use {categoryName(selected.score)}.
          </>
        }
      >
        <ScoreEntries score={selected.score} />
        <Entry doc={SAVED_FILES_DOC} />
      </HowSection>
    </main>
  );
});

function ScoreRow({ label, entry, onSelect }: { label: string; entry: ProfileEntry; onSelect: (key: string) => void }) {
  return (
    <StatRow
      label={label}
      value={formatScore(entry.score.score)}
      note={
        <button className="link-button" onClick={() => onSelect(entry.key)}>
          {categoryName(entry.score)}
        </button>
      }
    />
  );
}

/** The reference pace for one category, and the field to type a reference time in. */
function Reference({ entry, onSet }: { entry: ProfileEntry; onSet: (time: number | null) => void }) {
  const ref = referenceOf(entry);
  const [text, setText] = useState(entry.typedReference != null ? formatTime(entry.typedReference) : "");
  const [invalid, setInvalid] = useState(false);
  const s = entry.score;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() === "") return onSet(null);
    const t = parseTypedTime(text);
    setInvalid(t == null);
    if (t != null) onSet(t);
  };

  let sentence: string;
  if (!ref) {
    sentence =
      'Add the world record or a goal time to see how close your PB is to its pace. A comparison named "World Record" or "WR" in your split file is picked up on its own.';
  } else {
    const p = referencePace(s, ref.time);
    const from = ref.source === "typed" ? "typed in" : `from your "${ref.name}" comparison`;
    sentence = `Your PB of ${formatTime(s.personalBest)} is at ${pace1(p.pbPace)} of the reference pace (${formatTime(ref.time)}, ${from}).`;
    if (p.targetPace != null && s.realisticTarget !== s.personalBest)
      sentence += ` Your realistic target of ${formatTime(s.realisticTarget)} would be at ${pace1(p.targetPace)}.`;
  }

  return (
    <div className="reference">
      <p className="reference-text">
        <MetricLabel doc={SCORE_METRICS.pace} />{" "}
        {sentence}
      </p>
      <form className="reference-form" onSubmit={submit}>
        <label htmlFor={`ref-${entry.key}`}>Reference time</label>
        <input
          id={`ref-${entry.key}`}
          inputMode="decimal"
          placeholder={s.fileReference ? formatTime(s.fileReference.time) : "e.g. 36:12.5"}
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `ref-${entry.key}-error` : undefined}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Save</button>
        {entry.typedReference != null && (
          <button
            type="button"
            onClick={() => {
              setText("");
              setInvalid(false);
              onSet(null);
            }}
          >
            {s.fileReference ? "Use the file's time" : "Clear"}
          </button>
        )}
      </form>
      {invalid && (
        <p className="reference-error" id={`ref-${entry.key}-error`} role="alert">
          Type the time as hours, minutes and seconds, like 1:02:03.4 or 36:12.5.
        </p>
      )}
    </div>
  );
}

