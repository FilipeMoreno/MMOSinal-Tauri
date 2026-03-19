use std::fs;
use std::sync::atomic::Ordering;
use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::settings::AppSettings;
use crate::db::repos::settings_repo;
use crate::error::{AppError, Result};
use crate::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings> {
    settings_repo::get(&state.pool).await
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<()> {
    settings_repo::save(&state.pool, &settings).await
}

#[tauri::command]
pub async fn set_kiosk_mode(
    enabled: bool,
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<()> {
    state.kiosk_mode.store(enabled, Ordering::Relaxed);
    window.set_fullscreen(enabled).map_err(|e| AppError::InvalidInput(e.to_string()))?;
    Ok(())
}

// ── Export / Import ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct ScheduleExport {
    name: String,
    time: String,
    days_of_week: String,
    folder_id: Option<i64>,
    audio_file_id: Option<i64>,
    play_duration_s: i64,
    fade_in_s: i64,
    fade_out_s: i64,
    is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct HolidayExport {
    name: String,
    date: String,
    is_recurring: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct PanicExport {
    name: String,
    audio_file_id: i64,
    interrupt_mode: String,
    color_hex: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConfigExport {
    version: String,
    app: String,
    exported_at: String,
    settings: AppSettings,
    schedules: Vec<ScheduleExport>,
    holidays: Vec<HolidayExport>,
    panic_buttons: Vec<PanicExport>,
}

#[tauri::command]
pub async fn export_config(path: String, state: State<'_, AppState>) -> Result<()> {
    let settings = settings_repo::get(&state.pool).await?;

    let schedules = sqlx::query!(
        "SELECT name, time, days_of_week, folder_id, audio_file_id, play_duration_s, fade_in_s, fade_out_s, is_active FROM schedules"
    )
    .fetch_all(&state.pool)
    .await?
    .into_iter()
    .map(|r| ScheduleExport {
        name: r.name,
        time: r.time,
        days_of_week: r.days_of_week,
        folder_id: r.folder_id,
        audio_file_id: r.audio_file_id,
        play_duration_s: r.play_duration_s,
        fade_in_s: r.fade_in_s,
        fade_out_s: r.fade_out_s,
        is_active: r.is_active != 0,
    })
    .collect();

    let holidays = sqlx::query!(
        "SELECT name, date, is_recurring FROM holidays"
    )
    .fetch_all(&state.pool)
    .await?
    .into_iter()
    .map(|r| HolidayExport {
        name: r.name,
        date: r.date,
        is_recurring: r.is_recurring != 0,
    })
    .collect();

    let panic_buttons = sqlx::query!(
        "SELECT name, audio_file_id, interrupt_mode, color_hex FROM panic_buttons"
    )
    .fetch_all(&state.pool)
    .await?
    .into_iter()
    .map(|r| PanicExport {
        name: r.name,
        audio_file_id: r.audio_file_id,
        interrupt_mode: r.interrupt_mode,
        color_hex: r.color_hex,
    })
    .collect();

    let config = ConfigExport {
        version: "1.0".to_string(),
        app: "MMO Sinal".to_string(),
        exported_at: Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
        settings,
        schedules,
        holidays,
        panic_buttons,
    };

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| AppError::InvalidInput(e.to_string()))?;

    fs::write(&path, json).map_err(|e| AppError::InvalidInput(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn import_config(path: String, state: State<'_, AppState>) -> Result<ImportResult> {
    let json = fs::read_to_string(&path)
        .map_err(|e| AppError::InvalidInput(format!("Erro ao ler arquivo: {e}")))?;

    let config: ConfigExport = serde_json::from_str(&json)
        .map_err(|e| AppError::InvalidInput(format!("Arquivo inválido: {e}")))?;

    if config.app != "MMO Sinal" {
        return Err(AppError::InvalidInput("Arquivo não é um backup do MMO Sinal".to_string()));
    }

    // Save settings — preserve machine-specific paths from current installation
    let current = settings_repo::get(&state.pool).await.unwrap_or_default();
    let merged_settings = AppSettings {
        audio_storage_folder: current.audio_storage_folder,
        backup_folder: current.backup_folder,
        ..config.settings
    };
    settings_repo::save(&state.pool, &merged_settings).await?;

    // Clear and re-insert schedules
    sqlx::query!("DELETE FROM schedules").execute(&state.pool).await?;
    let mut schedules_imported = 0i64;
    for s in &config.schedules {
        let is_active = s.is_active as i64;
        sqlx::query!(
            "INSERT INTO schedules (name, time, days_of_week, folder_id, audio_file_id, play_duration_s, fade_in_s, fade_out_s, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            s.name, s.time, s.days_of_week, s.folder_id, s.audio_file_id,
            s.play_duration_s, s.fade_in_s, s.fade_out_s, is_active
        )
        .execute(&state.pool)
        .await?;
        schedules_imported += 1;
    }

    // Clear and re-insert holidays
    sqlx::query!("DELETE FROM holidays").execute(&state.pool).await?;
    let mut holidays_imported = 0i64;
    for h in &config.holidays {
        let is_recurring = h.is_recurring as i64;
        sqlx::query!(
            "INSERT OR IGNORE INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)",
            h.name, h.date, is_recurring
        )
        .execute(&state.pool)
        .await?;
        holidays_imported += 1;
    }

    // Clear and re-insert panic buttons
    sqlx::query!("DELETE FROM panic_buttons").execute(&state.pool).await?;
    let mut panic_buttons_imported = 0i64;
    for (i, p) in config.panic_buttons.iter().enumerate() {
        let sort_order = i as i64;
        sqlx::query!(
            "INSERT INTO panic_buttons (name, audio_file_id, interrupt_mode, color_hex, sort_order) VALUES (?, ?, ?, ?, ?)",
            p.name, p.audio_file_id, p.interrupt_mode, p.color_hex, sort_order
        )
        .execute(&state.pool)
        .await?;
        panic_buttons_imported += 1;
    }

    Ok(ImportResult {
        schedules_imported,
        holidays_imported,
        panic_buttons_imported,
    })
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub schedules_imported: i64,
    pub holidays_imported: i64,
    pub panic_buttons_imported: i64,
}
