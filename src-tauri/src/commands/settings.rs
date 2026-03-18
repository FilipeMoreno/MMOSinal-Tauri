use tauri::State;

use crate::db::models::settings::AppSettings;
use crate::db::repos::settings_repo;
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings> {
    settings_repo::get(&state.pool).await
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<()> {
    settings_repo::save(&state.pool, &settings).await
}
