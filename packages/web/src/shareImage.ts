export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error("The image couldn't be made."))), "image/png"),
  );
}

export const canCopyImage = () => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

export async function copyPng(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
