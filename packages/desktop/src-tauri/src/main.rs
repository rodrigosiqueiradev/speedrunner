// Hide the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// The desktop app is the web app in a native window. It has no backend commands:
// split files are read and analysed in the page, exactly as in the browser.
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // The window is built here instead of from tauri.conf.json so files the page offers
            // to save (such as a copy of the splits with new comparisons) are allowed. Without a
            // download handler the macOS and Linux webviews drop them; with one, they go to the
            // Downloads folder, as they do on Windows.
            tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?
                .on_download(|_webview, _event| true)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Speedrunner");
}
