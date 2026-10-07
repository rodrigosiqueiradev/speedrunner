// Hide the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// The desktop app is the web app in a native window. It has no backend commands:
// split files are read and analysed in the page, exactly as in the browser.
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Speedrunner");
}
