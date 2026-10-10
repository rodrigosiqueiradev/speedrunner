import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor } from "@tauri-apps/api/window";
import { isDesktop } from "./platform";

/** The desktop app's overlay window, opened next to the main one. */
const OVERLAY_LABEL = "overlay";
const WIDTH = 360;
const HEIGHT = 560;
const GAP = 8;

/** True in the desktop app's borderless overlay window. Read on each call, once Tauri is set up. */
export const isOverlayWindow = (): boolean => isDesktop && getCurrentWebviewWindow().label === OVERLAY_LABEL;

/** Just right of the main window, or inside its right edge when the screen has no room for it there. */
async function besideMainWindow(): Promise<{ x: number; y: number } | null> {
  try {
    const main = getCurrentWebviewWindow();
    const [scale, position, size, monitor] = await Promise.all([main.scaleFactor(), main.outerPosition(), main.outerSize(), currentMonitor()]);
    const pos = position.toLogical(scale);
    const box = size.toLogical(scale);
    let x = pos.x + box.width + GAP;
    let y = pos.y;
    if (monitor) {
      const area = monitor.workArea.position.toLogical(monitor.scaleFactor);
      const areaSize = monitor.workArea.size.toLogical(monitor.scaleFactor);
      x = Math.max(area.x, Math.min(x, area.x + areaSize.width - WIDTH));
      y = Math.max(area.y, Math.min(y, area.y + areaSize.height - HEIGHT));
    }
    return { x: Math.round(x), y: Math.round(y) };
  } catch {
    // Where the window can't say where it is, the system places the overlay.
    return null;
  }
}

/**
 * Opens the live card in its own borderless window next to the main one, or brings it forward if
 * it's already open. It has no title bar, so it sits next to LiveSplit or under a stream capture
 * without a frame. Resolves once the window exists, and rejects if it couldn't be made.
 */
export async function openOverlayWindow(): Promise<void> {
  const open = await WebviewWindow.getByLabel(OVERLAY_LABEL);
  if (open) return open.setFocus();
  const place = await besideMainWindow();
  const overlay = new WebviewWindow(OVERLAY_LABEL, {
    url: `${window.location.pathname}${window.location.search}#live-overlay`,
    title: "Speedrunner live stats",
    width: WIDTH,
    height: HEIGHT,
    minWidth: 220,
    minHeight: 160,
    decorations: false,
    ...place,
  });
  await new Promise<void>((resolve, reject) => {
    void overlay.once("tauri://created", () => resolve());
    void overlay.once<unknown>("tauri://error", (e) => reject(new Error(String(e.payload))));
  });
}

/** Moves the borderless window with the mouse, as its missing title bar would. */
export const dragThisWindow = () => getCurrentWebviewWindow().startDragging();

export const closeThisWindow = () => getCurrentWebviewWindow().close();
