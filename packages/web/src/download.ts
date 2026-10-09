/** Hands the viewer a file to save. In the desktop app the webview saves it to the Downloads folder. */
export function saveTextFile(fileName: string, text: string, type = "application/xml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "My Run.lss" → "My Run (with comparisons).lss", without characters file systems refuse. */
export function copyName(fileName: string, suffix: string): string {
  const base = fileName.replace(/\.lss$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "splits";
  return `${base} (${suffix}).lss`;
}
