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

The logbook is written in the runner's own handwriting, which here is LiveSplit's. Times are set in tabular mono and right-aligned, the way a splits panel shows them, and gold always means gold. Pages are light by default and quiet. Cool grey paper, white panels and hairline rules carry the structure. Colour appears only where it encodes a meaning. In the default palette that colour is blue: time a good attempt would save. Gold is always a best segment, and red is always an error. A palette can change the accent hue. It does not change what gold and red mean. A dark "Night Shell" header frames the logbook like a timer window. Dark mode is a separately tuned palette, not an inversion.

The density is moderate. Comfortable reading measures (56–78ch) sit alongside compact data views (tables, the route strip, the bar chart) that stay readable without zooming.

**Key Characteristics:**
- Explanation sits next to every number. Notes, tips and worked examples are first-class content.
- Times are tabular mono and right-aligned. Labels are sans and left-aligned.
- Colour carries meaning: the accent is reachable saves and actions, gold is golds, red is an error. Everything else is neutral. The accent hue depends on the palette.
- Flat, ruled surfaces. A shadow appears only on content that floats.
- One sticky dark header and one narrow column (1080px max).
- Light and dark themes are each tuned on their own.

## Colors

The colours at the top of this file are the default palette, Speedrunner, in light mode. A cool, near-neutral logbook with two meaningful inks: the accent (Split Blue, in that palette) and Gold Split. Other palettes keep every role and change the accent hue. They are specified under Palettes.

### Primary
- **Split Blue** (`split-blue`, the `--accent` role): the colour of time a good attempt would save. It's used for primary actions, the pressed toggle, realistic-save bars, text selection, the save bars on the route strip, and the focus ring wherever the ring sits on the page itself. On a dark chrome surface, the ring instead takes that surface's ink — Night Shell Ink on the header — because the page accent doesn't clear 3:1 there. **Split Blue Ink** (`split-blue-ink`, `--accent-ink`) is its text-safe partner for links, save values and deltas. **Split Blue Fill** (`split-blue-fill`, hover `split-blue-fill-hover`; `--accent-fill` and `--accent-fill-hover`) is the slightly deeper step used behind white text on filled controls (the primary button and the pressed toggle), because white on Split Blue only reaches 4.4:1. **Split Blue Wash** (`split-blue-wash`, `--accent-wash`) tints the lead comparison row, selected table rows, info tip hover and worked-example callouts. In any palette other than Speedrunner, these roles use that palette's accent, not this blue.

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
**The Meaning-Only Colour Rule.** The accent means time a good attempt would save, and it is also the colour of primary actions, links, and focus on the page. Gold means a gold segment. Red means an error. No other hues appear, and none of these is used decoratively. The accent hue depends on the palette. Gold and error do not take on that hue. Time behind stays neutral ink. There is no separate ahead or behind colour. The focus ring itself always takes the ink of the surface it sits on — the accent on the page, Night Shell Ink on the header — so on a dark chrome surface it is not the accent, without breaking the rule: ink is already that surface's own text colour, not a new hue.

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
- **Pop** (`0 6px 24px rgb(13 20 32 / 0.14), 0 1px 3px rgb(13 20 32 / 0.08)`; dark: `0 8px 28px rgb(0 0 0 / 0.5)`): info tip panels, the chart tooltip and the Appearance panel. That pair is Speedrunner. A tinted palette uses the same alphas on its own ink. High contrast light uses the stronger shadow in its palette table. Dark mode keeps the black shadow above.

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
The live stats card that sits next to LiveSplit or on stream. It's a Night Shell surface in both themes, like the header and like LiveSplit, with a 1px `#22304a` rule border and no shadow. Rows are ruled: the label on the left in Night Shell Ink Muted, the value right-aligned in Time mono (sans for words such as "Reset"), with a muted micro detail line under it. Colour keeps the system's meanings on the dark ground: Split Blue Ink (`#86b6ef`) for time ahead and "Keep going", Gold Split Ink (`#f0c25a`) for golds, plain ink for everything else, including time behind and "Reset". The one exception is the PB chance trend: a small filled arrow before "from 4.9%", blue when the chance went up and error red (`#ff8a8a`, the dark theme's error ink) when it went down, so the direction reads at a glance mid-run. These are the standard look: under "Card style" on the live page a runner can pick their own colours for the background, values, labels, ahead, golds and a falling PB chance, and the value and label sizes. The page warns when a colour drops under 4.5:1 on the background, and "Reset to standard" brings these values back. The status dot is an outline, filled blue only while LiveSplit is connected. In the overlay window the card fills the window and its values grow with the window width. In the desktop app that window is borderless: dragging the card moves it, and a close button appears in its top right corner on hover. The overlay's keyboard focus ring uses the card's value colour, the same colour the page checks at 4.5:1 against the card background, including on the empty-state link and that close button.

The live page puts the card's stats first, numbered and in card order with up and down buttons from the icon family, then "More stats" with checkboxes only. Moves are announced to screen readers.

### Navigation
A Night Shell bar, sticky, 56px tall. The wordmark is "Speedrunner" in 600 sans. The right side links to the other views (Analyse a run, Profile, Year in runs). Once a run is loaded it shows the shell "Open file" button; "How it's calculated" for a run is its last tab.

## Palettes

The colours in the front matter of this file are Speedrunner in light mode. Where the component notes above say Split Blue, they mean that palette's accent. Grove, Violet, Amber and High contrast keep every role and change the accent hue. Each theme has its own light version and its own dark version, so System mode still works. The choice is saved on this computer. Nothing is uploaded.

Mode stays System, Light or Dark. Theme is the colour set. They are two choices.

The five presets are hand-tuned. They are not the output of the custom rules further down. Speedrunner is today's `:root` exactly, and its attribute may be omitted.

### What keeps its hue

Gold and error keep their hue family in every theme. A theme may only change their lightness, and only High contrast does.

- Gold stays gold. Speedrunner, Grove, Violet and Amber use the current gold tokens unchanged. High contrast light uses a darker gold ink, `#6d4c00`, still in the same gold family, so the flag clears 7:1 on white. Dark gold is unchanged.
- Error stays red. The same four themes use the current error tokens. High contrast light uses `#9e2322`, still red. Dark error is unchanged.
- There is no ahead colour and no behind colour in `:root`. Time behind stays `--ink` (neutral). Do not add a green or a red for it. Time saved, links and deltas stay `--accent-ink`, so that hue follows the theme. That is the accent, not a fixed status green.
- The Live card's ahead blue and its falling-chance red are out of scope. They do not follow the palette.

Amber is a deep burnt orange, about hue 62°, so it does not become the gold (about hue 82°) or the error red (about hue 27°). On the savings chart the accent bar and the gold bar stay distinguishable. Do not shift Amber toward gold to make the theme "more amber".

### Preset tokens

Speedrunner is the current `:root` exactly. Do not regenerate it. The other four are hand-tuned. They are not the output of the custom algorithm.

Light and dark are each tuned. Dark is not an inversion. In dark mode the button fill is sometimes lighter than the light-mode fill, so the button still clears the dark page.

`--on-accent` is `#ffffff` everywhere except High contrast dark, where it is `#000000`. A light blue button with black text is what keeps the button visible on black and the text at 7:1.

#### Speedrunner

`data-palette="speedrunner"` (the default; the attribute may be omitted)

##### Speedrunner, light

| Token | Value |
| --- | --- |
| `--ground` | `#f1f3f6` |
| `--surface` | `#ffffff` |
| `--surface-sunk` | `#f6f7f9` |
| `--hover` | `#eef1f5` |
| `--line` | `#e1e5eb` |
| `--line-strong` | `#c9cfd8` |
| `--ink` | `#0d1420` |
| `--ink-2` | `#47505e` |
| `--ink-3` | `#5d6573` |
| `--shell` | `#0e1726` |
| `--shell-ink` | `#e8edf5` |
| `--shell-ink-2` | `#a3b0c2` |
| `--accent` | `#2a78d6` |
| `--accent-ink` | `#1c5cab` |
| `--accent-wash` | `#e8f1fc` |
| `--accent-fill` | `#256abf` |
| `--accent-fill-hover` | `#1c5cab` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#b8860b` |
| `--gold-wash` | `#fbf3dd` |
| `--gold-ink` | `#7a5600` |
| `--error` | `#b42323` |
| `--error-wash` | `#fdecec` |
| `--r0` | `#e7ebf0` |
| `--shadow-pop` | `0 6px 24px rgb(13 20 32 / 0.14), 0 1px 3px rgb(13 20 32 / 0.08)` |

##### Speedrunner, dark

| Token | Value |
| --- | --- |
| `--ground` | `#0d1117` |
| `--surface` | `#151a22` |
| `--surface-sunk` | `#11161d` |
| `--hover` | `#1c2330` |
| `--line` | `#252d39` |
| `--line-strong` | `#343e4d` |
| `--ink` | `#f2f5f9` |
| `--ink-2` | `#b9c2cf` |
| `--ink-3` | `#8b95a4` |
| `--shell` | `#080c12` |
| `--shell-ink` | `#e8edf5` |
| `--shell-ink-2` | `#8b97a8` |
| `--accent` | `#3987e5` |
| `--accent-ink` | `#86b6ef` |
| `--accent-wash` | `#14233a` |
| `--accent-fill` | `#256abf` |
| `--accent-fill-hover` | `#1c5cab` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#c98500` |
| `--gold-wash` | `#2a2210` |
| `--gold-ink` | `#f0c25a` |
| `--error` | `#ff8a8a` |
| `--error-wash` | `#2d1515` |
| `--r0` | `#1f2733` |
| `--shadow-pop` | `0 8px 28px rgb(0 0 0 / 0.5)` |

#### Grove

`data-palette="grove"`

##### Grove, light

| Token | Value |
| --- | --- |
| `--ground` | `#edf5f0` |
| `--surface` | `#ffffff` |
| `--surface-sunk` | `#f3f9f6` |
| `--hover` | `#e9f3ed` |
| `--line` | `#dce7e0` |
| `--line-strong` | `#c3d2c8` |
| `--ink` | `#0d1710` |
| `--ink-2` | `#46534b` |
| `--ink-3` | `#5b675f` |
| `--shell` | `#0a1a10` |
| `--shell-ink` | `#e7efea` |
| `--shell-ink-2` | `#a0b3a6` |
| `--accent` | `#1f7a47` |
| `--accent-ink` | `#0e703e` |
| `--accent-wash` | `#e3f5ea` |
| `--accent-fill` | `#1b7342` |
| `--accent-fill-hover` | `#036b3b` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#b8860b` |
| `--gold-wash` | `#fbf3dd` |
| `--gold-ink` | `#7a5600` |
| `--error` | `#b42323` |
| `--error-wash` | `#fdecec` |
| `--r0` | `#e3ede7` |
| `--shadow-pop` | `0 6px 24px rgb(13 23 16 / 0.14), 0 1px 3px rgb(13 23 16 / 0.08)` |

##### Grove, dark

| Token | Value |
| --- | --- |
| `--ground` | `#0b130e` |
| `--surface` | `#121c16` |
| `--surface-sunk` | `#0f1812` |
| `--hover` | `#18271d` |
| `--line` | `#213127` |
| `--line-strong` | `#304336` |
| `--ink` | `#f1f6f3` |
| `--ink-2` | `#b8c5bc` |
| `--ink-3` | `#89998e` |
| `--shell` | `#050e08` |
| `--shell-ink` | `#e8efeb` |
| `--shell-ink-2` | `#899b8f` |
| `--accent` | `#3d9a62` |
| `--accent-ink` | `#7dcea0` |
| `--accent-wash` | `#15281b` |
| `--accent-fill` | `#2c7e4e` |
| `--accent-fill-hover` | `#318252` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#c98500` |
| `--gold-wash` | `#2a2210` |
| `--gold-ink` | `#f0c25a` |
| `--error` | `#ff8a8a` |
| `--error-wash` | `#2d1515` |
| `--r0` | `#1d2b21` |
| `--shadow-pop` | `0 8px 28px rgb(0 0 0 / 0.5)` |

#### Violet

`data-palette="violet"`

##### Violet, light

| Token | Value |
| --- | --- |
| `--ground` | `#f3f1fb` |
| `--surface` | `#ffffff` |
| `--surface-sunk` | `#f7f6fd` |
| `--hover` | `#f0effa` |
| `--line` | `#e4e2ef` |
| `--line-strong` | `#cdcbdb` |
| `--ink` | `#14121c` |
| `--ink-2` | `#4f4e5b` |
| `--ink-3` | `#63616e` |
| `--shell` | `#161323` |
| `--shell-ink` | `#edebf5` |
| `--shell-ink-2` | `#adaabf` |
| `--accent` | `#684db6` |
| `--accent-ink` | `#5a3ea6` |
| `--accent-wash` | `#f0eeff` |
| `--accent-fill` | `#5e44ae` |
| `--accent-fill-hover` | `#4e359c` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#b8860b` |
| `--gold-wash` | `#fbf3dd` |
| `--gold-ink` | `#7a5600` |
| `--error` | `#b42323` |
| `--error-wash` | `#fdecec` |
| `--r0` | `#eae8f4` |
| `--shadow-pop` | `0 6px 24px rgb(20 18 28 / 0.14), 0 1px 3px rgb(20 18 28 / 0.08)` |

##### Violet, dark

| Token | Value |
| --- | --- |
| `--ground` | `#110f17` |
| `--surface` | `#1a1822` |
| `--surface-sunk` | `#16141d` |
| `--hover` | `#23202f` |
| `--line` | `#2d2a3a` |
| `--line-strong` | `#3d3a4d` |
| `--ink` | `#f5f4fb` |
| `--ink-2` | `#c1bfce` |
| `--ink-3` | `#9492a3` |
| `--shell` | `#0b0a13` |
| `--shell-ink` | `#edecf4` |
| `--shell-ink-2` | `#9693a7` |
| `--accent` | `#7e64d0` |
| `--accent-ink` | `#c4b6f5` |
| `--accent-wash` | `#241e38` |
| `--accent-fill` | `#7461b7` |
| `--accent-fill-hover` | `#7965bb` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#c98500` |
| `--gold-wash` | `#2a2210` |
| `--gold-ink` | `#f0c25a` |
| `--error` | `#ff8a8a` |
| `--error-wash` | `#2d1515` |
| `--r0` | `#272433` |
| `--shadow-pop` | `0 8px 28px rgb(0 0 0 / 0.5)` |

#### Amber

`data-palette="amber"`

##### Amber, light

| Token | Value |
| --- | --- |
| `--ground` | `#f9f1ec` |
| `--surface` | `#ffffff` |
| `--surface-sunk` | `#fbf6f3` |
| `--hover` | `#f7eee8` |
| `--line` | `#ece2da` |
| `--line-strong` | `#d8cac0` |
| `--ink` | `#1b120b` |
| `--ink-2` | `#594d44` |
| `--ink-3` | `#6c6158` |
| `--shell` | `#201308` |
| `--shell-ink` | `#f3ebe6` |
| `--shell-ink-2` | `#bbaa9d` |
| `--accent` | `#995600` |
| `--accent-ink` | `#814800` |
| `--accent-wash` | `#fbf1e6` |
| `--accent-fill` | `#8e5100` |
| `--accent-fill-hover` | `#7a4500` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#b8860b` |
| `--gold-wash` | `#fbf3dd` |
| `--gold-ink` | `#7a5600` |
| `--error` | `#b42323` |
| `--error-wash` | `#fdecec` |
| `--r0` | `#f1e8e2` |
| `--shadow-pop` | `0 6px 24px rgb(27 18 11 / 0.14), 0 1px 3px rgb(27 18 11 / 0.08)` |

##### Amber, dark

| Token | Value |
| --- | --- |
| `--ground` | `#160f0a` |
| `--surface` | `#211810` |
| `--surface-sunk` | `#1c140d` |
| `--hover` | `#2d2015` |
| `--line` | `#37291e` |
| `--line-strong` | `#4a3a2d` |
| `--ink` | `#f9f4f0` |
| `--ink-2` | `#cbbfb5` |
| `--ink-3` | `#a09186` |
| `--shell` | `#110904` |
| `--shell-ink` | `#f2ebe7` |
| `--shell-ink-2` | `#a39285` |
| `--accent` | `#e0a15a` |
| `--accent-ink` | `#f0c48a` |
| `--accent-wash` | `#2c1d10` |
| `--accent-fill` | `#a25f16` |
| `--accent-fill-hover` | `#a5621a` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#c98500` |
| `--gold-wash` | `#2a2210` |
| `--gold-ink` | `#f0c25a` |
| `--error` | `#ff8a8a` |
| `--error-wash` | `#2d1515` |
| `--r0` | `#30241a` |
| `--shadow-pop` | `0 8px 28px rgb(0 0 0 / 0.5)` |

#### High contrast

`data-palette="contrast"`

##### High contrast, light

| Token | Value |
| --- | --- |
| `--ground` | `#ffffff` |
| `--surface` | `#ffffff` |
| `--surface-sunk` | `#f2f2f2` |
| `--hover` | `#e5e5e5` |
| `--line` | `#5c5c5c` |
| `--line-strong` | `#1f1f1f` |
| `--ink` | `#000000` |
| `--ink-2` | `#1a1a1a` |
| `--ink-3` | `#3f3f3f` |
| `--shell` | `#000000` |
| `--shell-ink` | `#ffffff` |
| `--shell-ink-2` | `#c8c8c8` |
| `--accent` | `#1656a4` |
| `--accent-ink` | `#0f4e98` |
| `--accent-wash` | `#e5f0fb` |
| `--accent-fill` | `#0b56a9` |
| `--accent-fill-hover` | `#084888` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#b8860b` |
| `--gold-wash` | `#fbf3dd` |
| `--gold-ink` | `#6d4c00` |
| `--error` | `#9e2322` |
| `--error-wash` | `#fdecec` |
| `--r0` | `#767676` |
| `--shadow-pop` | `0 6px 24px rgb(0 0 0 / 0.22), 0 1px 3px rgb(0 0 0 / 0.14)` |

##### High contrast, dark

| Token | Value |
| --- | --- |
| `--ground` | `#000000` |
| `--surface` | `#0a0a0a` |
| `--surface-sunk` | `#000000` |
| `--hover` | `#1a1a1a` |
| `--line` | `#a6a6a6` |
| `--line-strong` | `#ffffff` |
| `--ink` | `#ffffff` |
| `--ink-2` | `#f0f0f0` |
| `--ink-3` | `#d0d0d0` |
| `--shell` | `#000000` |
| `--shell-ink` | `#ffffff` |
| `--shell-ink-2` | `#d0d0d0` |
| `--accent` | `#8eb7ee` |
| `--accent-ink` | `#d4e4ff` |
| `--accent-wash` | `#0c2244` |
| `--accent-fill` | `#8eb7ee` |
| `--accent-fill-hover` | `#a9cdff` |
| `--on-accent` | `#000000` |
| `--gold` | `#c98500` |
| `--gold-wash` | `#2a2210` |
| `--gold-ink` | `#f0c25a` |
| `--error` | `#ff8a8a` |
| `--error-wash` | `#2d1515` |
| `--r0` | `#8a8a8a` |
| `--shadow-pop` | `0 8px 28px rgb(0 0 0 / 0.5)` |


### Contrast

Ratios use the WCAG 2.1 relative luminance formula. Text must clear **4.5:1**. The accent, used as a focus ring on the page and as a button against the page, must clear **3:1**. On a dark chrome surface the ring is not the accent — it takes that surface's ink instead, already checked below as a text pair. The pass line for every pair below is 4.5 except where a pair is a non-text boundary, and those boundaries were checked at 3:1 as well (accent on ground and on surface, accent-fill on surface). All of them pass.

High contrast also clears **7:1** for ink, ink-2, ink-3, accent-ink, on-accent on the fill, shell ink and shell ink muted, and for gold ink and error on the surface.

| Theme | Mode | Ink on ground | Ink on surface | Ink-2 on surface | Ink-3 on ground | Accent-ink on surface | On-accent on fill | Gold-ink on surface | Error on surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Speedrunner | light | 16.60 | 18.45 | 8.15 | 5.29 | 6.63 | 5.39 | 6.65 | 6.55 |
| Speedrunner | dark | 17.31 | 15.97 | 9.71 | 6.25 | 8.27 | 5.39 | 10.45 | 7.69 |
| Grove | light | 16.49 | 18.31 | 8.08 | 5.33 | 6.17 | 5.87 | 6.65 | 6.55 |
| Grove | dark | 17.25 | 15.97 | 9.76 | 6.29 | 9.31 | 5.00 | 10.44 | 7.69 |
| Violet | light | 16.58 | 18.53 | 8.16 | 5.42 | 7.85 | 7.21 | 6.65 | 6.55 |
| Violet | dark | 17.40 | 16.04 | 9.69 | 6.25 | 9.48 | 5.08 | 10.49 | 7.73 |
| Amber | light | 16.54 | 18.45 | 8.17 | 5.40 | 7.34 | 6.31 | 6.65 | 6.55 |
| Amber | dark | 17.37 | 15.98 | 9.69 | 6.22 | 10.78 | 5.02 | 10.45 | 7.69 |
| High contrast | light | 21.00 | 21.00 | 17.40 | 10.53 | 8.19 | 7.20 | 7.82 | 7.73 |
| High contrast | dark | 21.00 | 19.80 | 17.37 | 13.62 | 15.41 | 10.16 | 11.85 | 8.72 |

Also checked, all at or above 4.5: ink on accent-wash, accent-ink on ground and on accent-wash, on-accent on accent-fill-hover, gold-ink on gold-wash, error on error-wash, shell-ink and shell-ink-2 on shell. Shell-ink on shell is also the header focus ring's ratio, since the ring takes that colour there. The Live overlay's ring still uses the accent on card-bg and is below 3:1 in some palettes; once that moves to card-ink, its ratio joins this table alongside the header's. Hairline `--line` is structure, not text, and is not required to hit 3:1. High contrast uses stronger lines so the edges of panels stay obvious.

White on the raw Speedrunner accent `#2a78d6` is 4.42:1, which is why the fill is the deeper `#256abf` (5.39:1). Keep that. Do not put white text on `--accent`.

### Custom theme

The person picks an **accent**, and may pick a **background tint**. The app makes every other colour token from those two, in the active mode. The pickers keep the hex the person chose. The page uses the derived tokens. Nothing is baked back into the pickers.

#### What they pick

- **Accent.** A colour input and a 7-character hex field, each updating the other. Empty or invalid hex on blur reverts to the last good value.
- **Tint the page.** A checkbox, off by default. Off means `tint` is null and the neutrals are the Speedrunner neutrals exactly. On shows a second colour input, starting at the accent colour. The tint contributes its hue only. Lightness and chroma of the page come from the ladder below, so a saturated pick cannot turn the page into a solid block of that colour.

Entering Custom copies the current preset's light accent into the picker (`#2a78d6`, `#1f7a47`, `#684db6`, `#995600`, or `#1656a4`) and sets tint off. It does not clone the preset token for token. From Speedrunner, the accent stays `#2a78d6` and the button fill moves to the derived `#2675d2`. That is expected.

#### Rules

Work in OKLCH (Björn Ottosson). Round each sRGB channel to the nearest integer, halves to even. If a colour falls outside sRGB, reduce chroma until it fits, and keep lightness and hue. Targets: text **4.6:1** (so the rounded hex still clears 4.5), non-text accent and button edge **3.1:1**.

1. Read the accent. If its chroma is under 0.02, it is grey: use hue 255.5, chroma 0.14, lightness 0.575 in light mode and 0.622 in dark mode. Show the line.
2. If chroma is over 0.20, cap it at 0.16. Show the line.
3. Neutrals. No tint, or a tint whose chroma is under 0.02: copy the Speedrunner neutrals for that mode, including the shadow. A tint that was given but has no hue still shows the line ("that tint has no hue"). Otherwise take the tint's hue and build the ladder. Light mode surface is always `#ffffff`.

Light ladder (lightness, chroma), hue from the tint:

| Token | Lightness | Chroma |
| --- | --- | --- |
| ground | 0.963 | 0.012 |
| surface-sunk | 0.976 | 0.008 |
| hover | 0.955 | 0.014 |
| line | 0.918 | 0.016 |
| line-strong | 0.848 | 0.022 |
| ink | 0.191 | 0.020 |
| ink-2 | 0.429 | 0.022 |
| ink-3 | 0.500 | 0.020 |
| r0 | 0.936 | 0.014 |
| shell | 0.200 | 0.030 |
| shell-ink | 0.945 | 0.012 |
| shell-ink-2 | 0.748 | 0.028 |

Dark ladder:

| Token | Lightness | Chroma |
| --- | --- | --- |
| ground | 0.176 | 0.016 |
| surface | 0.216 | 0.020 |
| surface-sunk | 0.198 | 0.018 |
| hover | 0.255 | 0.028 |
| line | 0.295 | 0.028 |
| line-strong | 0.361 | 0.032 |
| ink | 0.969 | 0.008 |
| ink-2 | 0.811 | 0.020 |
| ink-3 | 0.667 | 0.024 |
| r0 | 0.271 | 0.026 |
| shell | 0.150 | 0.020 |
| shell-ink | 0.945 | 0.010 |
| shell-ink-2 | 0.672 | 0.028 |

Light shadow is the Speedrunner shadow with the theme ink's red, green and blue. Dark shadow is always `0 8px 28px rgb(0 0 0 / 0.5)`.

4. Wash. Light: lightness 0.955, chroma clamped between 0.012 and 0.028 at 0.18 times the accent chroma. Dark: lightness 0.255, chroma clamped between 0.03 and 0.055 at 0.30 times the accent chroma. Hue is the accent hue.
5. Accent (bars, focus ring, tab underline). Light mode: darken until it clears 3.1 on both surface and ground. Dark mode: lighten until it clears 3.1 on the surface. Show the line if the lightness moved.
6. Fill and the text on it. Prefer white `#ffffff`. In light mode, darken the pick until white clears 4.6. Use that fill with white text when the lightness drop is 0.18 or less and the fill also clears 3.1 on the surface. Otherwise use dark text `#0d1420` (this exact ink, in both modes, because it sits on the fill) and darken the fill until it clears 3.1 on the surface while the dark text still clears 4.6. Show the line when the text is dark or the fill moved. In dark mode, a pick of lightness 0.70 or more uses dark text on a light fill. A darker pick uses white text on a fill that clears both 4.6 for white and 3.1 on the surface. If that pair is impossible, use dark text on a light fill.
7. Hover. Try one step darker (about 0.045 lightness). Keep it only if the same text colour still clears 4.6 and the fill still clears 3.0 on the surface. Otherwise try one step lighter. If neither passes, hover equals fill. Grove dark and a pale yellow in light mode are cases where hover equals fill.
8. Accent-ink. Light mode: start at lightness at most 0.48 and chroma at most 0.15, then darken until it clears 4.6 on surface, ground and wash. Dark mode: start at lightness at least 0.74 and chroma at most 0.12, then lighten until the same three pass.
9. Gold and error. Copy the fixed tokens for that mode. Speedrunner's gold and error, not the High contrast variants. Never take them from the accent.
10. If ink, ink-2, ink-3, shell-ink or shell-ink-2 has fallen under 4.6 on the surface it is read on, move that colour's lightness until it passes. Show the line.

#### When a pick fails contrast

Do not reject the colour. Do not reset the picker. Adjust the derived tokens and say so, in one line under the pickers, in `--ink-2` at 0.8125rem:

> Adjusted so text stays readable.

The line uses the secondary ink, not the error colour. It is information, not a failure. Show it when any step above flagged an adjustment. Hide it when the pick derives cleanly. The line is one sentence, not a list of reasons.

What the person sees in the cases that matter:

- A normal blue or green already clears, so there is no line. The accent they picked is the accent on the page (a one-channel round from the hex maths is not an adjustment).
- A pale yellow cannot be a button on white paper. The accent and the fill deepen, the button text turns dark, and the line shows. In dark mode the yellow can stay light, with dark text on the button, and the line still shows.
- A neon green is toned down, then treated the same way as a colour that fails the button edge.
- A grey accent becomes Speedrunner blue, and the line shows.
- A white, black or grey tint has no hue. The page stays the Speedrunner neutrals, and the line shows.
- A real tint only shifts the neutrals toward that hue. It does not recolour gold or error.

#### Worked examples

These are the check for the rules above. Match the accent tokens. Match whether the line shows. With no tint, every neutral matches Speedrunner for that mode. Gold and error match the Speedrunner pair for that mode, in every example.

| Accent pick | Tint | Mode | Line | accent | accent-ink | wash | fill | fill-hover | on-accent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `#2a78d6` | none | light | no | `#2a78d6` | `#115cb0` | `#e7f1ff` | `#2675d2` | `#1166c1` | `#ffffff` |
| `#2a78d6` | none | dark | no | `#2a78d6` | `#76adf6` | `#12233a` | `#2675d2` | `#1467c3` | `#ffffff` |
| `#1f7a47` | none | light | no | `#1f7a48` | `#0e703f` | `#e6f5eb` | `#1f7a48` | `#036b3b` | `#ffffff` |
| `#1f7a47` | none | dark | no | `#1f7a48` | `#6bc08a` | `#15281b` | `#1f7a48` | `#1f7a48` | `#ffffff` |
| `#ffe14a` | none | light | yes | `#a08900` | `#6e5d00` | `#f5f1dd` | `#a99100` | `#a99100` | `#0d1420` |
| `#ffe14a` | none | dark | yes | `#ffe14e` | `#f7e283` | `#292303` | `#ead15d` | `#dbc24f` | `#0d1420` |
| `#c8c8c8` | none | light | yes | `#3a79ca` | `#1c5cab` | `#e7f1ff` | `#3676c6` | `#2667b6` | `#ffffff` |
| `#c8c8c8` | none | dark | yes | `#4888d9` | `#76adf6` | `#152337` | `#3676c6` | `#2868b7` | `#ffffff` |
| `#00ff66` | none | light | yes | `#2b9e49` | `#00722b` | `#e4f6e7` | `#37a651` | `#37a651` | `#0d1420` |
| `#00ff66` | none | dark | yes | `#85f197` | `#9deba8` | `#112915` | `#8eea9c` | `#7fdb8f` | `#0d1420` |
| `#6a45c4` | `#916cba` | light | no | `#6a45c4` | `#6148aa` | `#f0eeff` | `#6a45c4` | `#5d35b3` | `#ffffff` |
| `#6a45c4` | `#916cba` | dark | yes | `#724fce` | `#ac9df1` | `#231d3b` | `#724fce` | `#7d5cdc` | `#ffffff` |
| `#1f7a47` | `#ffffff` | light | yes | `#1f7a48` | `#0e703f` | `#e6f5eb` | `#1f7a48` | `#036b3b` | `#ffffff` |
| `#1f7a47` | `#ffffff` | dark | yes | `#1f7a48` | `#6bc08a` | `#15281b` | `#1f7a48` | `#1f7a48` | `#ffffff` |


The tinted violet pick is the check for the ladder. Full tokens:

##### Violet tint, light (accent `#6a45c4`, tint `#916cba`)

| Token | Value |
| --- | --- |
| `--ground` | `#f4f1fa` |
| `--surface` | `#ffffff` |
| `--surface-sunk` | `#f8f6fc` |
| `--hover` | `#f2eef9` |
| `--line` | `#e6e1ee` |
| `--line-strong` | `#d0cada` |
| `--ink` | `#16121b` |
| `--ink-2` | `#524d5a` |
| `--ink-3` | `#66616d` |
| `--shell` | `#191221` |
| `--shell-ink` | `#eeebf4` |
| `--shell-ink-2` | `#b1a9bd` |
| `--accent` | `#6a45c4` |
| `--accent-ink` | `#6148aa` |
| `--accent-wash` | `#f0eeff` |
| `--accent-fill` | `#6a45c4` |
| `--accent-fill-hover` | `#5d35b3` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#b8860b` |
| `--gold-wash` | `#fbf3dd` |
| `--gold-ink` | `#7a5600` |
| `--error` | `#b42323` |
| `--error-wash` | `#fdecec` |
| `--r0` | `#ece8f2` |
| `--shadow-pop` | `0 6px 24px rgb(22 18 27 / 0.14), 0 1px 3px rgb(22 18 27 / 0.08)` |

##### Violet tint, dark (accent `#6a45c4`, tint `#916cba`)

| Token | Value |
| --- | --- |
| `--ground` | `#120f17` |
| `--surface` | `#1c1721` |
| `--surface-sunk` | `#17141c` |
| `--hover` | `#261f2e` |
| `--line` | `#302938` |
| `--line-strong` | `#41394b` |
| `--ink` | `#f6f3fa` |
| `--ink-2` | `#c4becd` |
| `--ink-3` | `#9891a1` |
| `--shell` | `#0d0912` |
| `--shell-ink` | `#eeebf3` |
| `--shell-ink-2` | `#9a92a5` |
| `--accent` | `#724fce` |
| `--accent-ink` | `#ac9df1` |
| `--accent-wash` | `#231d3b` |
| `--accent-fill` | `#724fce` |
| `--accent-fill-hover` | `#7d5cdc` |
| `--on-accent` | `#ffffff` |
| `--gold` | `#c98500` |
| `--gold-wash` | `#2a2210` |
| `--gold-ink` | `#f0c25a` |
| `--error` | `#ff8a8a` |
| `--error-wash` | `#2d1515` |
| `--r0` | `#2a2431` |
| `--shadow-pop` | `0 8px 28px rgb(0 0 0 / 0.5)` |


### Appearance

The footer Theme switch is replaced by one control, **Appearance**. The privacy sentence and the version note stay. The footer stays centred, 0.875rem, `--ink-3`.

The mode toggle is the control people already use, and five swatches do not fit beside the privacy line without crowding it (Hick's Law, Choice Overload). So the footer shows one quiet button, and the choices sit in a small panel. Mode is the first thing inside the panel, still the existing small `Toggle`, so the segmented control itself does not change (Jakob's Law).

#### Closed

A text button, `--ink-3`, 0.875rem, with a 14px swatch before the word "Appearance". Gap `--s2`. The swatch is `aria-hidden`. The button's accessible name is "Appearance". `aria-expanded` and `aria-haspopup="dialog"`. The swatch is the current theme's light `--accent-fill`, including while the page is in dark mode, so the chip does not flip when the mode flips. Custom uses the derived fill. High contrast is the exception, below.

#### Open

A dialog, anchored above the button with an 8px gap, centred on the button. Width 280px, or `100vw - 32px` when that is narrower. Page surface, 1px `--line-strong`, radius 8px, the Pop shadow. Padding 12px 16px 16px. If the panel would leave the viewport, pin it 8px inside the viewport. It is not a bottom sheet. The info-tip sheet is for long text. This panel is short.

Focus moves to the pressed mode segment. Tab stays inside the dialog. Escape, or a click outside, closes it and returns focus to the Appearance button. Fade 160ms on the existing curve. Under `prefers-reduced-motion`, show it at once.

```
Appearance
Mode
[ System | Light | Dark ]
Theme
[ swatches ]
        Grove
Custom…
```

- **Appearance.** The panel title, 0.8125rem, weight 600, `--ink`. `aria-labelledby` points at it.
- **Mode.** Label in `--ink-2`, 0.8125rem. Then the existing small `Toggle` with System, Light and Dark, full width of the panel. Choosing one saves and applies immediately, as it does today.
- **Theme.** Label in `--ink-2`. Then five swatches in one row, gap 12px, as a `radiogroup` labelled "Theme". Each is a 36px button, radius 8px, `role="radio"`, accessible name the theme name. Order: Speedrunner, Grove, Violet, Amber, High contrast. Arrow keys move. The selected swatch has a 2px `--ink` outline, offset 2px. The others have a 1px `--line-strong` border. A caption under the row, centred, `--ink-2`, 0.8125rem, is the selected name. One caption, not five labels.
- **High contrast swatch.** Not a blue square. A 36px rounded square, split vertically `#000000` and `#ffffff`, with a 4px `#1656a4` bar along the split. The other four swatches are blue, green, violet and burnt orange. A second blue square would be mistaken for Speedrunner (Von Restorff). The 14px footer chip uses the same split.
- **Custom…** A text button in `--accent-ink`, the text-link style, under the caption. It is not a sixth swatch. `aria-pressed` when custom is active. Activating it selects custom and shows the pickers under the button. The swatches stay, so a preset is one click away. Choosing a swatch leaves custom and hides the pickers. The stored custom colours are kept.

Pickers, only while custom is selected:

```
Accent   [####]  #1f7a47
[ ] Tint the page
Adjusted so text stays readable.
```

The colour input is 36 by 28, radius 6px, the same quiet chrome as a native colour well with a `--line-strong` border. The hex field is mono, 7 characters. Changes apply as the person edits, with no Apply button. The page behind the panel is the preview.

#### Narrow screens

The footer already wraps. The Appearance button may sit on its own line. The panel stays a popover at the width above. Swatches do not wrap.

## Do's and Don'ts

### Do:
- **Do** put an explanation next to every number: an info tip, a note, or a link into "How it's calculated".
- **Do** set every time, delta and save in Plex Mono with tabular numerals, right-aligned.
- **Do** keep the palette's accent for good-day saves and actions, and Gold Split for golds only.
- **Do** separate sections with 48px of space and hairline rules, inside the single 1080px column.
- **Do** define every new colour token for light and dark under the existing `:root` / `[data-theme]` structure.
- **Do** keep motion short (140–160ms, `cubic-bezier(0.16, 1, 0.3, 1)`) and honour `prefers-reduced-motion`.
- **Do** reuse the 16px, 1.5px-stroke icon family.

### Don't:
- **Don't** nest cards inside cards or add shadows to content that sits on the page.
- **Don't** add a hue beyond the palette's accent, gold and the error red, or use the accent and gold decoratively. Don't recolour gold or error to match the accent.
- **Don't** use all-caps labels, letter-spaced eyebrows or display type outside the landing headline.
- **Don't** set times in proportional type or centre numeric columns.
- **Don't** invert the light palette to get dark mode.
