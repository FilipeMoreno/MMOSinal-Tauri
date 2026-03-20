use std::path::PathBuf;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

use sqlx::SqlitePool;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing::info;

mod commands;
mod core;
mod db;
mod error;
mod tray;

use core::{
    audio_state::new_shared_state,
    backup::run_auto_backup,
    player_engine::PlayerEngine,
    scheduler::{run_scheduler, run_watchdog},
};
use db::{
    connection::create_pool,
    repos::settings_repo,
};

/// Global application state shared across Tauri commands
pub struct AppState {
    pub pool: SqlitePool,
    pub engine: Arc<Mutex<PlayerEngine>>,
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub audio_folder: PathBuf,
    /// Whether kiosk mode is currently active (blocks window close)
    pub kiosk_mode: Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("mmo_sinal_tauri_lib=debug,warn")
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If second instance tries to open, show existing window
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Resolve paths
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&data_dir)?;

            let db_path = data_dir.join("mmo_sinal.db");

            info!("Data dir: {}", data_dir.display());
            info!("DB path: {}", db_path.display());

            // Create DB pool + run migrations before exposing commands.
            // This avoids race conditions where the frontend invokes commands
            // before AppState has been registered.
            let pool = tauri::async_runtime::block_on(create_pool(&db_path))?;

            // Load persisted settings to resolve startup behavior and paths.
            let settings = tauri::async_runtime::block_on(settings_repo::get(&pool))
                .unwrap_or_default();

            let audio_folder = if settings.audio_storage_folder.trim().is_empty() {
                data_dir.join("audio")
            } else {
                PathBuf::from(&settings.audio_storage_folder)
            };
            std::fs::create_dir_all(&audio_folder)?;
            info!("Audio folder: {}", audio_folder.display());

            // Create player engine
            let shared_state = new_shared_state();
            let engine = PlayerEngine::new(shared_state)?;
            let engine = Arc::new(Mutex::new(engine));

            // Shared kiosk flag — used by on_window_event (sync closure) and commands
            let kiosk_arc = Arc::new(AtomicBool::new(settings.kiosk_mode));

            // Register AppState before any command invocation can happen.
            handle.manage(AppState {
                pool: pool.clone(),
                engine: engine.clone(),
                data_dir: data_dir.clone(),
                db_path: db_path.clone(),
                audio_folder: audio_folder.clone(),
                kiosk_mode: kiosk_arc.clone(),
            });

            // Setup tray
            tray::setup_tray(&handle)?;

            // Optionally hide window on startup
            if settings.start_minimized {
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            // Apply kiosk mode on startup
            if settings.kiosk_start {
                kiosk_arc.store(true, Ordering::Relaxed);
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.set_fullscreen(true);
                }
            }

            // Start background scheduler
            let pool_sched = pool.clone();
            let engine_sched = engine.clone();
            let handle_sched = handle.clone();
            tauri::async_runtime::spawn(async move {
                run_scheduler(pool_sched, engine_sched, handle_sched).await;
            });

            // Start player watchdog
            let pool_wd = pool.clone();
            let engine_wd = engine.clone();
            let handle_wd = handle.clone();
            tauri::async_runtime::spawn(async move {
                run_watchdog(pool_wd, engine_wd, handle_wd).await;
            });

            // Start auto-backup if enabled
            if settings.backup_auto_enabled && !settings.backup_folder.is_empty() {
                let backup_dest = PathBuf::from(&settings.backup_folder);
                let audio_f = audio_folder.clone();
                let db_p = db_path.clone();
                tauri::async_runtime::spawn(async move {
                    run_auto_backup(
                        db_p,
                        audio_f,
                        backup_dest,
                        settings.backup_interval_hours as u64,
                    )
                    .await;
                });
            }

            // Tray tooltip updater — refreshes every 10 seconds
            {
                let handle_tray = handle.clone();
                let pool_tray = pool.clone();
                let engine_tray = engine.clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

                        let player_state = engine_tray.lock().await.state.lock().await.clone();

                        let next_label = if matches!(player_state.status, crate::core::audio_state::PlayerStatus::Idle) {
                            crate::core::scheduler::seconds_until_next(&pool_tray).await.map(|n| {
                                let s = n.seconds_until;
                                let name = if n.schedule.name.trim().is_empty() {
                                    n.schedule.time.clone()
                                } else {
                                    n.schedule.name.clone()
                                };
                                if s < 60 {
                                    format!("Próximo: {name} (em instantes)")
                                } else if s < 3600 {
                                    format!("Próximo: {name} (em {}min)", s / 60)
                                } else {
                                    format!("Próximo: {name} (em {}h {}min)", s / 3600, (s % 3600) / 60)
                                }
                            })
                        } else {
                            None
                        };

                        tray::update_tooltip(&handle_tray, &player_state, next_label);
                    }
                });
            }

            // Auto-sync clock on startup if enabled
            if settings.ntp_auto_sync {
                let ntp_server = settings.ntp_server.clone();
                let handle_ntp = handle.clone();
                tauri::async_runtime::spawn(async move {
                    match commands::timesync::sync_time(ntp_server).await {
                        Ok(r) => {
                            info!(
                                "NTP sync: offset={}s, applied={}, time={}",
                                r.offset_s, r.applied, r.ntp_time
                            );
                            let _ = handle_ntp.emit("time-synced", &r);
                        }
                        Err(e) => tracing::warn!("NTP sync failed: {e}"),
                    }
                });
            }

            info!("MMO Sinal initialized successfully");

            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                // In kiosk mode block close entirely; otherwise minimize to tray
                if !window.app_handle().state::<AppState>().kiosk_mode.load(Ordering::Relaxed) {
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Audio
            commands::audio::list_audio_folders,
            commands::audio::create_audio_folder,
            commands::audio::update_audio_folder,
            commands::audio::delete_audio_folder,
            commands::audio::list_audio_files,
            commands::audio::import_audio_files,
            commands::audio::delete_audio_file,
            commands::audio::reorder_audio_files,
            commands::audio::rename_audio_file,
            commands::audio::move_audio_file,
            commands::audio::reset_playback_state,
            commands::audio::update_folder_shuffle,
            commands::audio::scan_folder_silence,
            commands::audio::analyze_file_silence,
            // Schedules
            commands::schedule::list_schedules,
            commands::schedule::get_schedule,
            commands::schedule::create_schedule,
            commands::schedule::update_schedule,
            commands::schedule::delete_schedule,
            commands::schedule::toggle_schedule_active,
            commands::schedule::get_next_signal,
            commands::schedule::duplicate_schedule,
            // Player
            commands::player::get_player_state,
            commands::player::stop_player,
            commands::player::play_manual,
            commands::player::set_volume,
            commands::player::save_default_volume,
            commands::player::pause_player,
            commands::player::seek_player,
            commands::player::skip_track,
            // Panic
            commands::panic::list_panic_buttons,
            commands::panic::create_panic_button,
            commands::panic::update_panic_button,
            commands::panic::delete_panic_button,
            commands::panic::trigger_panic_button,
            // Holidays
            commands::holiday::list_holidays,
            commands::holiday::create_holiday,
            commands::holiday::update_holiday,
            commands::holiday::delete_holiday,
            // Logs
            commands::log::list_execution_logs,
            commands::log::clear_execution_logs,
            // Change logs
            commands::change_log::log_change,
            commands::change_log::list_change_logs,
            commands::change_log::clear_change_logs,
            // Backup
            commands::backup::trigger_backup,
            // Settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::set_kiosk_mode,
            commands::settings::export_config,
            commands::settings::import_config,
            // Time Sync
            commands::timesync::sync_time,
            // Seasonal Overrides
            commands::seasonal::list_seasonal_overrides,
            commands::seasonal::create_seasonal_override,
            commands::seasonal::update_seasonal_override,
            commands::seasonal::delete_seasonal_override,
            commands::seasonal::toggle_seasonal_override,
            // Mini window
            commands::window::show_mini_window,
            commands::window::hide_mini_window,
            commands::window::restore_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
