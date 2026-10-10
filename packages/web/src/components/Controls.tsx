import type { ButtonHTMLAttributes, ReactNode } from "react";
import { revealExplanation } from "./InfoTip";

/** A row of buttons where exactly one is pressed, like a segmented control. Give it a label or labelledBy. */
export function Toggle<T extends string | number>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  small,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  labelledBy?: string;
  small?: boolean;
}) {
  return (
    <div className={small ? "toggle small" : "toggle"} role="group" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A link that runs an action in the app instead of loading its href, which stays for copying and screen readers. */
export function ActionLink({
  href,
  onClick,
  className,
  children,
}: {
  href: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  );
}

/** A link to an entry in the How it's calculated section, opening the entry's tab if it's hidden. */
export function ExplainLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ActionLink href={`#how-${id}`} onClick={() => revealExplanation(id)}>
      {children}
    </ActionLink>
  );
}

/** A button that looks like a link, for "Show all" and similar actions inside a section. */
export function TextButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={className ? `link-button text-link ${className}` : "link-button text-link"} {...props} />;
}
