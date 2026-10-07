/** Small stroke icons drawn on a 16px grid with a 1.5px stroke, so they stay one family. */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const InfoIcon = () => (
  <svg {...base}>
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 7.25v4M8 4.75v.01" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

export const UploadIcon = () => (
  <svg {...base}>
    <path d="M8 10.5V2.5M4.75 5.75 8 2.5l3.25 3.25M2.5 10v2.25c0 .7.55 1.25 1.25 1.25h8.5c.7 0 1.25-.55 1.25-1.25V10" />
  </svg>
);

export const FlagIcon = () => (
  <svg {...base}>
    <path d="M3.5 14V2.75M3.5 3h8l-1.75 2.75L11.5 8.5h-8" />
  </svg>
);
