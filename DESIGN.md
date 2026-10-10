---
name: Speedrunner
description: A calm practice logbook that shows runners where their splits lose time and explains every number.
colors:
  split-blue: "#2a78d6"
  split-blue-ink: "#1c5cab"
  split-blue-wash: "#e8f1fc"
  split-blue-fill: "#256abf"
  split-blue-fill-hover: "#1c5cab"
  on-split-blue: "#ffffff"
  gold-split: "#b8860b"
  gold-split-ink: "#7a5600"
  gold-split-wash: "#fbf3dd"
  night-shell: "#0e1726"
  night-shell-ink: "#e8edf5"
  night-shell-ink-muted: "#a3b0c2"
  page-ground: "#f1f3f6"
  page-surface: "#ffffff"
  page-sunk: "#f6f7f9"
  hover-tint: "#eef1f5"
  rule-line: "#e1e5eb"
  rule-line-strong: "#c9cfd8"
  ink: "#0d1420"
  ink-secondary: "#47505e"
  ink-muted: "#5d6573"
  error-red: "#b42323"
  error-wash: "#fdecec"
  route-track: "#e7ebf0"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 4vw, 2.6rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 3.2vw, 2.1rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  title-lead:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
  lede:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  note:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  micro:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  time-lead:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "2rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  time:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.375rem"
    fontWeight: 500
    fontFeature: "\"tnum\""
  time-compact:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 500
    fontFeature: "\"tnum\""
  time-cell:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"tnum\""
rounded:
  xxs: "2px"
  xs: "3px"
  sm: "4px"
  row: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button:
    backgroundColor: "{colors.page-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.hover-tint}"
  button-primary:
    backgroundColor: "{colors.split-blue-fill}"
    textColor: "{colors.on-split-blue}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.split-blue-fill-hover}"
  toggle-pressed:
    backgroundColor: "{colors.split-blue-fill}"
    textColor: "{colors.on-split-blue}"
  shell-button:
    textColor: "{colors.night-shell-ink}"
    rounded: "{rounded.md}"
    height: "32px"
  panel:
    backgroundColor: "{colors.page-surface}"
    rounded: "{rounded.lg}"
    padding: "16px 24px 24px"
  comparison-lead:
    backgroundColor: "{colors.split-blue-wash}"
    typography: "{typography.time-lead}"
    padding: "12px 24px"
  tag:
    backgroundColor: "{colors.page-sunk}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  flag-gold:
    backgroundColor: "{colors.gold-split-wash}"
    textColor: "{colors.gold-split-ink}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  infotip-panel:
    backgroundColor: "{colors.page-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  example-callout:
    backgroundColor: "{colors.split-blue-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  dropzone:
    backgroundColor: "{colors.page-surface}"
    rounded: "{rounded.xl}"
    padding: "32px 24px"
---

# Design System: Speedrunner

## Overview

**Creative North Star: "The Practice Logbook"**

Speedrunner reads like the notebook a runner keeps between sessions: a calm, well-ruled page where the numbers sit next to the reasons behind them. The page doesn't hype the run. It lays the run out, says what the figures mean, and ends with what to practise next. Explanations are part of the layout, not hidden away. Info tips, section notes, the "How it's calculated" entries and worked examples taken from the runner's own file all count as primary content.

The logbook is written in the runner's own handwriting, which here is LiveSplit's. Times are set in tabular mono and right-aligned, the way a splits panel shows them, and gold always means gold. Pages are light by default and quiet. Cool grey paper, white panels and hairline rules carry the structure. Colour appears only where it encodes a meaning: blue for time a good attempt would save, gold for best segments. A dark "Night Shell" header frames the logbook like a timer window. Dark mode is a separately tuned palette, not an inversion.

The density is moderate. Comfortable reading measures (56–78ch) sit alongside compact data views (tables, the route strip, the bar chart) that stay readable without zooming.

**Key Characteristics:**
- Explanation sits next to every number. Notes, tips and worked examples are first-class content.
- Times are tabular mono and right-aligned. Labels are sans and left-aligned.
- Colour carries meaning: blue is reachable saves, gold is golds. Everything else is neutral.
- Flat, ruled surfaces. A shadow appears only on content that floats.
- One sticky dark header and one narrow column (1080px max).
- Light and dark themes are each tuned on their own.

## Colors

A cool, near-neutral logbook palette with two meaningful inks: Split Blue and Gold Split.

### Primary
- **Split Blue** (`split-blue`): the colour of time a good attempt would save. It's used for primary actions, the pressed toggle, realistic-save bars, the focus ring, text selection and the save bars on the route strip. **Split Blue Ink** (`split-blue-ink`) is its text-safe partner for links, save values and deltas. **Split Blue Fill** (`split-blue-fill`, hover `split-blue-fill-hover`) is the slightly deeper step used behind white text on filled controls (the primary button and the pressed toggle), because white on Split Blue only reaches 4.4:1. **Split Blue Wash** (`split-blue-wash`) tints the lead comparison row, selected table rows, info tip hover and worked-example callouts.

### Secondary
- **Gold Split** (`gold-split`): LiveSplit's gold, used only for gold segments (the gold portion of savings bars and its legend swatch). **Gold Split Ink** and **Gold Split Wash** pair as the small flag that marks gold-related notes in the segment table.

### Tertiary
- **Night Shell** (`night-shell`): the sticky top bar, the only dark surface in light mode. Its text uses **Night Shell Ink**, and nav links use **Night Shell Ink Muted** until hovered.

### Neutral
- **Page Ground** (`page-ground`): the cool grey page behind everything.
- **Page Surface** (`page-surface`): white panels for the comparisons, chart, tables, dropzone and popovers.
- **Page Sunk** (`page-sunk`): table header rows, tags and muted flags.
- **Hover Tint** (`hover-tint`): row, button and summary hover backgrounds.
- **Rule Line / Rule Line Strong**: hairline dividers and panel borders. The strong rule is for button borders, the dropzone dash, popover borders and the rule above "How it's calculated" on the profile and Year in runs pages.
- **Ink / Ink Secondary / Ink Muted**: primary text, then notes and explanations, then meta, captions, ranks and secondary values.
- **Error Red / Error Wash**: file-read errors only.

### Route track
- **Route Track** (`route-track`): the neutral band the route strip draws the PB on, one step darker than the page ground. Dark mode uses `#1f2733`.

### Named Rules
**The Meaning-Only Colour Rule.** Blue means time a good attempt would save. Gold means a gold segment. No other hues appear, and neither is ever used decoratively.

**The Separate Night Rule.** Dark mode is its own tuned set of steps (see the sidecar), never `filter: invert` or computed opposites. Every new token needs a light value and a dark value.

## Typography

**Body Font:** IBM Plex Sans (with system-ui)
**Numeric Font:** IBM Plex Mono (with ui-monospace)

**Character:** Plex Sans gives the logbook a plain, engineered voice that stays warm at reading sizes. Plex Mono sets every time and numeric value so columns line up like a timer readout. One family in two cuts keeps the page calm.

### Hierarchy
- **Display** (600, clamp(1.9rem, 4vw, 2.6rem), 1.15): only the landing headline.
- **Headline** (600, clamp(1.6rem, 3.2vw, 2.1rem), 1.2): the run title (the game, followed by the category in Ink Muted at 500).
- **Title** (600, 1.25rem): section headings such as "What to practise first" and "Where the time is", and the dropzone title. "How it's calculated" steps up to **Title Lead** (1.5rem) because it is its own reading section (a tab on the run page, the closing section elsewhere). Its group headings (Run totals, Per segment, Practice advice) are h3s at body size and weight 600.
- **Lede** (400, 1.0625rem): the landing introduction only.
- **Body** (400, 16px, 1.55): base text.
- **Note** (400, 0.9375rem): section notes, advice reasons and explanation bodies in Ink Secondary, capped at 70–78ch.
- **Label** (500, 0.8125rem): table headers, captions and the route strip's biggest-saves list. Sentence case, never uppercase.
- **Micro** (500, 0.75rem): tags, table flags, route strip section names, its axis and its rank numbers.
- **Time Lead / Time / Time Compact / Time Cell** (Plex Mono, tabular numerals): 2rem/600 for the lead comparison, 1.375rem/500 for the other comparisons, 1.125rem/500 for times in option lists and secondary panels (LiveSplit comparisons, Year in runs stats), 0.875rem for table cells, bar values and save amounts.

### Named Rules
**The Tabular Time Rule.** Every time, delta, save and percentage is set in Plex Mono with tabular numerals and right-aligned in its column. Prose never sets numbers in mono, except inside a worked example.

**The Sentence-Case Rule.** Headings, labels and buttons use sentence case and plain words ("Open file", "How it's calculated"). No all-caps eyebrows or letter-spaced labels.

## Layout

There's a single centred column of 1080px max with 16px side gutters, under a 56px sticky Night Shell header that uses the same inner width. The landing view narrows to 640px and is centred. The results view opens with the run heading and timing toggle, then the run tabs (Overview, Practise, Segments, Sessions, How it's calculated), so no tab is longer than its own content. Overview holds what a runner decides on: the comparisons panel, route strip, the top three practice priorities, PB odds and the category score. Inside a tab, sections are separated by 48px (`s7`) of space. Sections aren't nested in cards. Each has a title and a one-line note above it, then its content. Lists that would run to every segment show the top 10 with a "Show all" text link, and session checks with no clear effect fold under one line. The profile and Year in runs pages still close with "How it's calculated" after a strong rule and 32px of padding.

Spacing follows a 4px-based scale (4, 8, 12, 16, 24, 32, 48). The interior rhythm is 12–16px between rows, 24px for panel side padding and 48px between sections.

The only breakpoint is 640px. Below it the shell hides its text links, comparison deltas drop under the time, the route strip's bars shorten to 36px and section names too narrow to read are hidden, the chart's label column narrows to 92px, and info tip panels become a fixed sheet pinned across the bottom gutter. Tables scroll horizontally with the segment name column kept sticky.

## Elevation & Depth

The system is flat. Depth comes from tone (ground, then surface, then sunk) and hairline rules, not shadows. Panels sit on the grey ground with a 1px Rule Line border. Exactly one shadow exists, and only content that floats above the page uses it.

### Shadow Vocabulary
- **Pop** (`0 6px 24px rgb(13 20 32 / 0.14), 0 1px 3px rgb(13 20 32 / 0.08)`; dark: `0 8px 28px rgb(0 0 0 / 0.5)`): info tip panels and the chart tooltip only.

### Named Rules
**The Ruled Page Rule.** Separate content with space and hairline rules, not nested cards or shadows. If something casts a shadow, it must be floating above the page.

## Shapes

Corners are gently rounded and stay small. Panels use 10px, buttons, popovers and callouts 8px, the dropzone 14px, row and summary hovers 6px (`row`), flags and focus rings 4px, the route track's outer ends 4px and the tops of route save bars 2px (`xxs`). Tags are the only pill shape. Borders are 1px hairlines, except the dropzone's 1.5px dash. The lead comparison row and the selected table row are marked by a wash, and the selected row also gets a 3px Split Blue inset bar on its left.

Icons are a single family of 16px stroke icons with a 1.5px stroke and round caps and joins, drawn in `currentColor`.

## Components

### Buttons
Quiet and plain. A button looks like a labelled control, not a call to action.
- **Shape:** gently rounded (8px), 36px tall, 16px side padding, 0.9375rem text, with an optional 16px icon spaced 8px from the label.
- **Default:** Page Surface with a Rule Line Strong border and Ink text. Hover shifts to Hover Tint, and pressing nudges it down 1px.
- **Primary:** Split Blue fill, white text at 500 weight. Hover deepens to Split Blue Ink. There's at most one per view (the dropzone's "Choose .lss file").
- **Toggle:** joined segmented buttons with inner corners squared. The pressed segment takes the primary fill.
- **Shell button:** transparent on Night Shell with a 30% Night Shell Ink border, 32px tall.
- **Link button:** unstyled text that underlines on hover, used for segment names in the advice list. The **text link** variant looks like a link (Split Blue Ink, underlined) and is used for in-place actions such as "Show all 56 segments".
- **Motion:** 140ms background and border transitions on `cubic-bezier(0.16, 1, 0.3, 1)`.

### Comparisons panel (signature)
The logbook's headline entry: Personal best, Realistic target and Sum of best laid out like a splits panel. Each row puts the label, an info tip and a short note on the left, then the delta against the PB, then the time on the right. The Realistic target row is the lead row, with a Split Blue Wash background and a larger time. Rows are separated by hairlines inside a bordered 10px panel.

### Route strip (signature)
The PB drawn as its route, built to stay readable from 5 splits to 100. A 10px Route Track runs the full width, split into one column per segment as wide as the segment took, with 1px gaps. Where a good attempt would save time, a Split Blue bar rises from the track, as tall as the save relative to the run's biggest (44px at most, 2px at least), so the eye goes to the peaks however many splits there are. There are no labels inside columns. The three biggest saves carry a mono rank number above their bar, and the caption lists them by name and save; each list item is a button too. When the file uses LiveSplit subsplits ("-Name", closed by "{Section}Name"), section names run under the track in 1px-ruled bands, and narrow sections stay unlabelled. A mono axis gives 0:00 and the PB time. Every column is a full-height button that scrolls to its row; hover tints the column and darkens its bar, and the tooltip gives name, PB time and save.

### Category score panel
The run page's score and the profile's per-category detail. One bordered 10px panel: on the left, the category score on Split Blue Wash (Time Lead mono with a muted "/100") with its info tip and a note naming the biggest drag or why it's provisional; then four ruled columns, one per part (efficiency, consistency, completion, improvement), each with its label and info tip, its weight in Micro mono, its 0–100 value in Time mono and a one-line note saying what it was worked out from. Below 860px the parts fold into a 2×2 grid under the score.

### Runner profile
Reuses the logbook pieces rather than adding new ones. The comparisons panel holds the overall score as its lead row, then the strongest and weakest categories. A table lists one row per category (score, the four parts and WR pace), firm scores first; its first column is a link button that selects the category, and provisional rows carry a muted flag. The selected category gets a score panel, a WR pace sentence with a mono reference-time field, and a quiet remove link. "How the score is calculated" closes the page.

### Advice list
A ranked logbook entry, one row per segment. A mono rank number in Ink Muted comes first, then the segment name as a link button and its advice tags as pills, then the reasons in Note type, with the estimated worth right-aligned in Split Blue Ink mono. Rows are divided by hairlines with no card around them.

### Run tabs
A plain tab row under the run heading: sentence-case labels in 500 Note type, Ink Secondary until hovered, 46px tall, 24px apart, on Page Ground with a Rule Line underneath. The selected tab turns Ink with a 2px Split Blue underline. The row sticks under the shell, and below 640px it runs edge to edge and scrolls sideways. Each tab is in the URL hash, so links and the back button work, and arrow keys move between tabs. Segment buttons anywhere open the Segments tab at that row; "How it's calculated" links in info tips open that tab at the entry.

### Info tips
A borderless 20px info icon in Ink Muted. Hovering or opening it gives it a Split Blue Wash circle. Its panel is a Page Surface popover (8px radius, strong border, Pop shadow, 0.875rem text) that holds the short explanation and a "How it's calculated" link. It appears with a 160ms fade and a 4px drop, and closes on outside click or Escape. On mobile it becomes a bottom sheet.

### Cards / containers
- **Corner style:** 10px.
- **Background:** Page Surface on Page Ground.
- **Shadow strategy:** none (see Elevation & Depth).
- **Border:** 1px Rule Line.
- **Internal padding:** 16–24px.

### Tables
These are data views. Headers sit on Page Sunk in Label type, cells are Time Cell mono and right-aligned, and the first column holds the segment name in sans and stays sticky on horizontal scroll. Rows highlight with Hover Tint, and the selected row gets the wash plus an inset bar. Inline flags mark special cases: gold-related notes in Gold Split Wash and Ink, others muted.

### Explanation entries
"How it's calculated" is built from disclosure rows. Each has a rotating chevron, a 170px label column and a one-line summary, and opens to a Note-type body capped at 78ch. Worked examples sit in a Split Blue Wash callout set in mono, with a sans lead-in.

### Dropzone
The first-run entry point: a 640px panel on Page Surface with a 1.5px dashed Rule Line Strong border and 14px corners. While dragging, it switches to a Split Blue border and wash. Inside are a title, a hint that restates the privacy promise, and a primary and a default button.

### Live card
The live stats card that sits next to LiveSplit or on stream. It's a Night Shell surface in both themes, like the header and like LiveSplit, with a 1px `#22304a` rule border and no shadow. Rows are ruled: the label on the left in Night Shell Ink Muted, the value right-aligned in Time mono (sans for words such as "Reset"), with a muted micro detail line under it. Colour keeps the system's meanings on the dark ground: Split Blue Ink (`#86b6ef`) for time ahead and "Keep going", Gold Split Ink (`#f0c25a`) for golds, plain ink for everything else, including time behind and "Reset". The one exception is the PB chance trend: a small filled arrow before "from 4.9%", blue when the chance went up and error red (`#ff8a8a`, the dark theme's error ink) when it went down, so the direction reads at a glance mid-run. These are the standard look: under "Card style" on the live page a runner can pick their own colours for the background, values, labels, ahead, golds and a falling PB chance, and the value and label sizes. The page warns when a colour drops under 4.5:1 on the background, and "Reset to standard" brings these values back. The status dot is an outline, filled blue only while LiveSplit is connected. In the overlay window the card fills the window and its values grow with the window width. In the desktop app that window is borderless: dragging the card moves it, and a close button appears in its top right corner on hover.

The live page puts the card's stats first, numbered and in card order with up and down buttons from the icon family, then "More stats" with checkboxes only. Moves are announced to screen readers.

### Navigation
A Night Shell bar, sticky, 56px tall. The wordmark is "Speedrunner" in 600 sans. The right side links to the other views (Analyse a run, Profile, Year in runs). Once a run is loaded it shows the shell "Open file" button; "How it's calculated" for a run is its last tab.

## Do's and Don'ts

### Do:
- **Do** put an explanation next to every number: an info tip, a note, or a link into "How it's calculated".
- **Do** set every time, delta and save in Plex Mono with tabular numerals, right-aligned.
- **Do** keep Split Blue for good-day saves and actions, and Gold Split for golds only.
- **Do** separate sections with 48px of space and hairline rules, inside the single 1080px column.
- **Do** define every new colour token for light and dark under the existing `:root` / `[data-theme]` structure.
- **Do** keep motion short (140–160ms, `cubic-bezier(0.16, 1, 0.3, 1)`) and honour `prefers-reduced-motion`.
- **Do** reuse the 16px, 1.5px-stroke icon family.

### Don't:
- **Don't** nest cards inside cards or add shadows to content that sits on the page.
- **Don't** add hues beyond blue, gold and the error red, or use blue and gold decoratively.
- **Don't** use all-caps labels, letter-spaced eyebrows or display type outside the landing headline.
- **Don't** set times in proportional type or centre numeric columns.
- **Don't** invert the light palette to get dark mode.
