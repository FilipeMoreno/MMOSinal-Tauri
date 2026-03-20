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

/// Skip to the next (+1) or previous (-1) track in the current file's folder.
/// Wraps around at the boundaries. Does nothing if no file is currently playing
/// or if the file has no folder context.
#[tauri::command]
pub async fn skip_track(
    direction: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    // Capture current state before stopping
    let (file, schedule) = {
        let eng = state.engine.lock().await;
        let st = eng.state.lock().await;
        (st.current_file.clone(), st.current_schedule.clone())
    };

    let Some(file) = file else { return Ok(()); };
    let folder_id = file.folder_id;

    // Stop current playback
    state.engine.lock().await.stop(&state.pool, &app).await;

    // Get all files in folder ordered by sort_order
    let files = audio_repo::list_files(&state.pool, folder_id).await?;
    if files.is_empty() { return Ok(()); }

    let n = files.len() as i64;
    let idx = files.iter().position(|f| f.id == file.id).unwrap_or(0) as i64;
    let next_idx = ((idx + direction).rem_euclid(n)) as usize;
    let next = files[next_idx].clone();

    // Start the next file from the beginning
    let _ = audio_repo::upsert_playback_state(&state.pool, next.id, 0, None).await;

    let volume = crate::db::repos::settings_repo::get(&state.pool).await
        .map(|s| s.default_volume)
        .unwrap_or(1.0);

    let (duration_s, fade_in_s, fade_out_s) = if let Some(ref s) = schedule {
        (s.play_duration_s as u64, s.fade_in_s as u64, s.fade_out_s as u64)
    } else {
        let dur = next.duration_ms
            .map(|ms| (ms as u64).saturating_add(999) / 1000)
            .unwrap_or(u32::MAX as u64);
        (dur, 0u64, 0u64)
    };

    let mut eng = state.engine.lock().await;
    eng.play(next, schedule, Some(folder_id), duration_s, fade_in_s, fade_out_s, volume, &state.pool, &app).await
}

#[tauri::command]
pub async fn set_volume(
    volume: f32,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let eng = state.engine.lock().await;
    eng.set_volume(volume, &app).await;
    Ok(())
}

/// Persist the chosen volume as the new default (called debounced from the UI).
#[tauri::command]
pub async fn save_default_volume(volume: f32, state: State<'_, AppState>) -> Result<()> {
    let mut s = crate::db::repos::settings_repo::get(&state.pool)
        .await
        .unwrap_or_default();
    s.default_volume = volume.clamp(0.0, 1.0);
    crate::db::repos::settings_repo::save(&state.pool, &s).await
}

#[tauri::command]
pub async fn pause_player(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<()> {
    let eng = state.engine.lock().await;
    eng.pause_or_resume(&app).await;
    Ok(())
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
