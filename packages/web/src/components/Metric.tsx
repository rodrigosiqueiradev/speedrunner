import type { ReactNode } from "react";
import { InfoTip, type TipDoc } from "./InfoTip";

/** A metric's name with its "?" tooltip. Children replace the name, for example to wrap it in a label. */
export function MetricLabel({ doc, children }: { doc: TipDoc; children?: ReactNode }) {
  return (
    <span className="comparison-label">
      {children ?? doc.label} <InfoTip doc={doc} />
    </span>
  );
}

/**
 * One row of a comparisons panel, laid out like a splits panel: the name and a note on the left, an
 * optional delta and the value on the right. Without a value the row is just the name and note.
 */
export function StatRow({
  doc,
  label,
  note,
  delta,
  value,
  lead,
  className,
}: {
  /** The metric, for its name and tooltip. */
  doc?: TipDoc;
  /** A plain name, or one that replaces the metric's. */
  label?: string;
  note?: ReactNode;
  delta?: string | null;
  value?: ReactNode;
  lead?: boolean;
  className?: string;
}) {
  return (
    <div className={["comparison", lead && "lead", className].filter(Boolean).join(" ")} role="row">
      <div className="comparison-name" role="rowheader">
        {doc ? <MetricLabel doc={doc}>{label}</MetricLabel> : <span className="comparison-label">{label}</span>}
        {note !== undefined && <span className="comparison-note">{note}</span>}
      </div>
      {value !== undefined && (
        <>
          <div className="comparison-delta" role="cell">
            {delta ?? ""}
          </div>
          <div className="comparison-time" role="cell">
            {value}
          </div>
        </>
      )}
    </div>
  );
}

/** A table column header with the metric's tooltip. */
export function MetricHeader({ doc, label }: { doc: TipDoc; label?: string }) {
  return (
    <th scope="col">
      <span className="th-inner">
        {label ?? doc.label} <InfoTip doc={doc} />
      </span>
    </th>
  );
}
