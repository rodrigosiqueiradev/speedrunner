import type { MetricDoc } from "./explain";
import { localPlace } from "./platform";

type Doc = Pick<MetricDoc, "id" | "label" | "short" | "how">;

/** How the profile keeps split files, shown in a ? tooltip next to the profile's run actions. */
export const SAVED_FILES_DOC: Doc = {
  id: "saved-files",
  label: "Saved split files",
  short: `Your profile keeps a copy of each category's split file ${localPlace}, so you can open it without choosing it again.`,
  how: [
    `The copy is saved ${localPlace} when you add the file to your profile. It never leaves your device.`,
    "It's the file as it was when you added it. Add a newer file for the same game and category to replace both the copy and the score.",
    "Categories added before files were kept have a score but no copy, so add their file once more.",
  ],
};

/** Which split files Year in runs uses. */
export const RECAP_FILES_DOC: Doc = {
  id: "recap-files",
  label: "Split files",
  short: "Starts from the split files in your profile, plus the run open in Analyse a run. One file per game and category.",
  how: [
    "Every category in your profile is included, plus the run open in Analyse a run if its category isn't in your profile.",
    "A file you add here replaces the one for the same game and category, so attempts aren't counted twice.",
    "Leaving a profile file out only changes this recap while the app is open. Your profile keeps it.",
  ],
};
