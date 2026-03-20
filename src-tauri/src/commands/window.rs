use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};

/// Prevents two concurrent calls from both creating a "mini" window before
/// either has finished registering it (TOCTOU race condition).
static MINI_CREATION_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub async fn show_mini_window(app: AppHandle) {
    // Fast path: window already exists — just show it.
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.show();
        let _ = mini.set_always_on_top(true);
        return;
    }

    // Serialize creation. If another call is already creating the window, bail
    // out; the first call will complete and subsequent minimize events will hit
    // the fast path above.
    let Ok(_guard) = MINI_CREATION_LOCK.try_lock() else { return; };

    // Re-check inside the lock: another task may have finished creating it.
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.show();
        let _ = mini.set_always_on_top(true);
        return;
    }

    let (x, y) = mini_position(&app, 320.0, 160.0);
    let _ = WebviewWindowBuilder::new(
        &app,
        "mini",
        WebviewUrl::App("index.html".into()),
    )
    .title("MMO Sinal Mini")
    .inner_size(320.0, 160.0)
    .position(x, y)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build();
    // _guard drops here, releasing the lock
}

#[tauri::command]
pub async fn hide_mini_window(app: AppHandle) {
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.hide();
    }
}

#[tauri::command]
pub async fn restore_main_window(app: AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.hide();
    }
}

/// Returns the bottom-right logical position for the mini window, above the taskbar.
fn mini_position(app: &AppHandle, width: f64, height: f64) -> (f64, f64) {
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let size = monitor.size();
        let sf = monitor.scale_factor();
        let logical_w = size.width as f64 / sf;
        let logical_h = size.height as f64 / sf;
        (logical_w - width - 20.0, logical_h - height - 60.0)
    } else {
        (20.0, 20.0)
    }
}
