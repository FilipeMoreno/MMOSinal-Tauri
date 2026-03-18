use std::path::Path;
use tauri::State;

use crate::db::models::audio::{AudioFile, AudioFolder};
use crate::db::repos::audio_repo;
use crate::error::{AppError, Result};
use crate::AppState;

#[tauri::command]
pub async fn list_audio_folders(state: State<'_, AppState>) -> Result<Vec<AudioFolder>> {
    audio_repo::list_folders(&state.pool).await
}

#[tauri::command]
pub async fn create_audio_folder(
    name: String,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<AudioFolder> {
    audio_repo::create_folder(&state.pool, &name, description.as_deref()).await
}

#[tauri::command]
pub async fn update_audio_folder(
    id: i64,
    name: String,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<AudioFolder> {
    audio_repo::update_folder(&state.pool, id, &name, description.as_deref()).await
}

#[tauri::command]
pub async fn delete_audio_folder(id: i64, state: State<'_, AppState>) -> Result<()> {
    audio_repo::delete_folder(&state.pool, id).await
}

#[tauri::command]
pub async fn list_audio_files(folder_id: i64, state: State<'_, AppState>) -> Result<Vec<AudioFile>> {
    audio_repo::list_files(&state.pool, folder_id).await
}

#[tauri::command]
pub async fn import_audio_files(
    folder_id: i64,
    file_paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<AudioFile>> {
    let mut imported = Vec::new();

    // Get current max sort_order for folder
    let existing = audio_repo::list_files(&state.pool, folder_id).await?;
    let mut next_order = existing.len() as i64;

    for src_path in &file_paths {
        let path = Path::new(src_path);
        if !path.exists() {
            return Err(AppError::InvalidInput(format!("Arquivo não encontrado: {src_path}")));
        }

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or(&filename)
            .to_string();

        // Get duration using rodio/symphonia
        let duration_ms = get_audio_duration(src_path);

        let dest_dir = state.audio_folder.join(folder_id.to_string());
        std::fs::create_dir_all(&dest_dir)?;
        let dest_path = dest_dir.join(&filename);

        // Copy file to app audio folder
        std::fs::copy(path, &dest_path)?;

        let file = audio_repo::insert_file(
            &state.pool,
            folder_id,
            &name,
            &filename,
            &dest_path.display().to_string(),
            duration_ms,
            next_order,
        )
        .await?;

        next_order += 1;
        imported.push(file);
    }

    Ok(imported)
}

fn get_audio_duration(path: &str) -> Option<i64> {
    use std::fs::File;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .ok()?;

    let track = probed.format.default_track()?;
    let params = &track.codec_params;

    let n_frames = params.n_frames?;
    let sample_rate = params.sample_rate?;

    Some((n_frames as f64 / sample_rate as f64 * 1000.0) as i64)
}

#[tauri::command]
pub async fn delete_audio_file(id: i64, state: State<'_, AppState>) -> Result<()> {
    // Get file path before deleting
    if let Some(file) = audio_repo::get_file(&state.pool, id).await? {
        audio_repo::delete_file(&state.pool, id).await?;
        // Optionally remove from disk
        let _ = std::fs::remove_file(&file.file_path);
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_audio_files(
    folder_id: i64,
    ordered_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<()> {
    audio_repo::reorder_files(&state.pool, folder_id, &ordered_ids).await
}

#[tauri::command]
pub async fn reset_playback_state(audio_file_id: i64, state: State<'_, AppState>) -> Result<()> {
    audio_repo::upsert_playback_state(&state.pool, audio_file_id, 0, None).await
}
