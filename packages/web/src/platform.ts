/** True inside the Tauri desktop shell, where "your browser" would be the wrong word. */
export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Where split files are read: the user's browser on the web, their computer in the desktop app. */
export const localPlace = isDesktop ? "on your computer" : "in your browser";
