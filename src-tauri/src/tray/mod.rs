use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::core::audio_state::{PlayerState, PlayerStatus};

const TRAY_ID: &str = "main-tray";

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Abrir MMO Sinal", true, None::<&str>)?;
    let sep = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_i, &sep, &quit_i])?;

    let icon = app.default_window_icon().cloned().unwrap();

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip("MMO Sinal — Gerenciador de Sirenes")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Update the tray tooltip based on current player state and optionally the next scheduled signal.
pub fn update_tooltip(app: &AppHandle, state: &PlayerState, next_label: Option<String>) {
    let text = build_tooltip(state, next_label);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(&text));
    }
}

fn build_tooltip(state: &PlayerState, next_label: Option<String>) -> String {
    match &state.status {
        PlayerStatus::Idle => {
            let next = next_label.unwrap_or_else(|| "Sem agendamentos ativos".to_string());
            format!("MMO Sinal\n{next}")
        }
        PlayerStatus::Playing | PlayerStatus::FadingIn | PlayerStatus::FadingOut => {
            let prefix = match &state.status {
                PlayerStatus::FadingIn => "▶ Iniciando",
                PlayerStatus::FadingOut => "↓ Encerrando",
                _ => "▶ Tocando",
            };
            let file = state
                .current_file
                .as_ref()
                .map(|f| f.name.as_str())
                .unwrap_or("...");
            if let Some(sched) = &state.current_schedule {
                let label = if sched.name.trim().is_empty() {
                    &sched.time
                } else {
                    &sched.name
                };
                format!("{prefix} • {label}\n{file}")
            } else {
                format!("{prefix} • Sinal manual\n{file}")
            }
        }
        PlayerStatus::Paused => "MMO Sinal\n⏸ Pausado".to_string(),
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
