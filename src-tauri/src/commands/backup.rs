use tauri::State;

use crate::core::backup::{create_backup, BackupResult};
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn trigger_backup(state: State<'_, AppState>) -> Result<BackupResult> {
    use crate::db::repos::settings_repo;

    let settings = settings_repo::get(&state.pool).await?;

    let backup_dest = if settings.backup_folder.is_empty() {
        // Default to app data dir
        state.data_dir.join("backups")
    } else {
        std::path::PathBuf::from(&settings.backup_folder)
    };

    Ok(create_backup(
        &state.db_path,
        &state.audio_folder,
        &backup_dest,
    ))
}
