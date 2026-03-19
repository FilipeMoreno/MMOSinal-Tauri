use tauri::{AppHandle, State};

use crate::core::audio_state::PlayerState;
use crate::db::repos::audio_repo;
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn get_player_state(state: State<'_, AppState>) -> Result<PlayerState> {
    let eng = state.engine.lock().await;
    let st = eng.state.lock().await;
    Ok(st.clone())
}

#[tauri::command]
pub async fn stop_player(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let eng = state.engine.lock().await;
    eng.stop(&state.pool, &app).await;
    Ok(())
}

#[tauri::command]
pub async fn play_manual(
    audio_file_id: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let file = audio_repo::get_file(&state.pool, audio_file_id)
        .await?
        .ok_or_else(|| crate::error::AppError::NotFound(format!("File {audio_file_id}")))?;

    // Manual play always starts from the beginning.
    audio_repo::upsert_playback_state(&state.pool, audio_file_id, 0, None).await?;

    // Use actual file duration so the loop ends naturally; fall back to u32::MAX (no artificial cutoff).
    let duration_s = file.duration_ms
        .map(|ms| (ms as u64).saturating_add(999) / 1000) // ms → s, rounded up
        .unwrap_or(u32::MAX as u64);

    let default_volume = crate::db::repos::settings_repo::get(&state.pool).await
        .map(|s| s.default_volume)
        .unwrap_or(1.0);

    let mut eng = state.engine.lock().await;
    eng.play(file, None, None, duration_s, 0, 0, default_volume, &state.pool, &app).await
}

#[tauri::command]
pub async fn seek_player(
    position_ms: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let eng = state.engine.lock().await;
    eng.seek(position_ms, &state.pool, &app).await
}
