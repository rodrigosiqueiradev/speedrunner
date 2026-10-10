import { isDesktop } from "./platform";

/** The desktop app's overlay window, opened next to the main one. */
const OVERLAY_LABEL = "overlay";

// The Tauri API is only loaded in the desktop app, so the web build never runs it.
const tauriWindow = () => import("@tauri-apps/api/webviewWindow");

/** True in the desktop app's borderless overlay window. */
export const isOverlayWindow =
  isDesktop &&
  (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } }).__TAURI_INTERNALS__
    ?.metadata?.currentWindow?.label === OVERLAY_LABEL;

/**
 * Opens the live card in its own borderless window, or brings it forward if it's already open. It
 * has no title bar, so it sits next to LiveSplit or under a stream capture without a frame.
 */
export async function openOverlayWindow(): Promise<void> {
  const { WebviewWindow } = await tauriWindow();
  const open = await WebviewWindow.getByLabel(OVERLAY_LABEL);
  if (open) return open.setFocus();
  new WebviewWindow(OVERLAY_LABEL, {
    url: `${window.location.pathname}${window.location.search}#live-overlay`,
    title: "Speedrunner live stats",
    width: 360,
    height: 560,
    minWidth: 220,
    minHeight: 160,
    decorations: false,
  });
}

/** Moves the borderless window with the mouse, as its missing title bar would. */
export async function dragThisWindow(): Promise<void> {
  const { getCurrentWebviewWindow } = await tauriWindow();
  await getCurrentWebviewWindow().startDragging();
}

export async function closeThisWindow(): Promise<void> {
  const { getCurrentWebviewWindow } = await tauriWindow();
  await getCurrentWebviewWindow().close();
}
