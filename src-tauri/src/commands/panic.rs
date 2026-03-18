use tauri::{AppHandle, State};

use crate::db::models::panic_button::PanicButton;
use crate::db::repos::{audio_repo, panic_repo};
use crate::error::{AppError, Result};
use crate::AppState;

#[tauri::command]
pub async fn list_panic_buttons(state: State<'_, AppState>) -> Result<Vec<PanicButton>> {
    panic_repo::list(&state.pool).await
}

#[tauri::command]
pub async fn create_panic_button(
    name: String,
    audio_file_id: i64,
    interrupt_mode: String,
    color_hex: String,
    state: State<'_, AppState>,
) -> Result<PanicButton> {
    panic_repo::create(&state.pool, &name, audio_file_id, &interrupt_mode, &color_hex).await
}

#[tauri::command]
pub async fn update_panic_button(
    id: i64,
    name: String,
    audio_file_id: i64,
    interrupt_mode: String,
    color_hex: String,
    state: State<'_, AppState>,
) -> Result<PanicButton> {
    panic_repo::update(&state.pool, id, &name, audio_file_id, &interrupt_mode, &color_hex).await
}

#[tauri::command]
pub async fn delete_panic_button(id: i64, state: State<'_, AppState>) -> Result<()> {
    panic_repo::delete(&state.pool, id).await
}

#[tauri::command]
pub async fn trigger_panic_button(
    id: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let btn = panic_repo::get_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Panic button {id}")))?;

    let file = audio_repo::get_file(&state.pool, btn.audio_file_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Audio file {}", btn.audio_file_id)))?;

    let eng = state.engine.lock().await;
    eng.play_panic(file, &btn.interrupt_mode, &state.pool, &app).await
}
