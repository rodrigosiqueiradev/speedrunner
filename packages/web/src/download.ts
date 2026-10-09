/** Hands the viewer a file to save. In the desktop app the webview saves it to the Downloads folder. */
export function saveFile(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the webview a moment to start reading the file before it goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveTextFile(fileName: string, text: string, type = "application/xml") {
  saveFile(fileName, new Blob([text], { type }));
}

/** "My Run.lss" → "My Run (with comparisons).lss", without characters file systems refuse. */
export function copyName(fileName: string, suffix: string): string {
  const base = fileName.replace(/\.lss$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "splits";
  return `${base} (${suffix}).lss`;
}
