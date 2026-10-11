import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { InfoTip, type TipDoc } from "./InfoTip";

/** A page's intro before anything is loaded: a big title and one lede paragraph. */
export function Landing({ title, titleId = "landing-title", children }: { title: string; titleId?: string; children: ReactNode }) {
  return (
    <section className="landing" aria-labelledby={titleId}>
      <h1 id={titleId}>{title}</h1>
      <p className="lede">{children}</p>
    </section>
  );
}

/** A loaded page's title and the line under it, with optional controls on the right. */
export function PageHead({
  title,
  meta,
  metaTitle,
  children,
}: {
  title: ReactNode;
  meta: ReactNode;
  /** Hover text for the meta line, when it's shortened. */
  metaTitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="run-head">
      <div>
        <h1 className="run-title">{title}</h1>
        <p className="run-meta" title={metaTitle}>
          {meta}
        </p>
      </div>
      {children}
    </div>
  );
}

/** A titled block on a page: the heading with its tooltip, a one-line note, then the content. */
export function Section({
  titleId,
  title,
  tip,
  note,
  actions,
  id,
  children,
}: {
  titleId: string;
  title: ReactNode;
  tip?: TipDoc;
  note?: ReactNode;
  /** Buttons under the note, still part of the heading. */
  actions?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="block" aria-labelledby={titleId}>
      <div className="block-head">
        <h2 id={titleId} className={tip ? "title-with-tip" : undefined}>
          {title}
          {tip && (
            <>
              {" "}
              <InfoTip doc={tip} />
            </>
          )}
        </h2>
        {note && <p className="section-note">{note}</p>}
        {actions}
      </div>
      {children}
    </section>
  );
}

/** The "How it's calculated" section at the end of a page, which the tooltips' links open entries in. */
export function HowSection({
  title = "How it's calculated",
  note,
  className,
  children,
}: {
  title?: string;
  note: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id="how-it-works" className={className ? `how ${className}` : "how"} aria-labelledby="how-title">
      <h2 id="how-title">{title}</h2>
      <p className="section-note">{note}</p>
      {children}
    </section>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p className="error" role="alert">
      {children}
    </p>
  );
}

/**
 * The box around a table. Its header row sticks to the top of the window while the page scrolls, which
 * needs a box that doesn't scroll. When the window is too narrow for the table, the box scrolls sideways
 * instead, so no column is cut off. The header then only sticks inside the box, so it scrolls away with a
 * long table; the styles make the segments table fit down to 800px wide windows so that is rare.
 */
export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const wrap = ref.current;
    const table = wrap?.querySelector("table");
    if (!wrap || !table || typeof ResizeObserver === "undefined") return;
    const check = () => setOverflowing(wrap.scrollWidth > wrap.clientWidth);
    const observer = new ResizeObserver(check);
    observer.observe(wrap);
    observer.observe(table);
    check();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={["table-wrap", overflowing && "overflowing", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
