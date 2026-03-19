use tauri::State;
use crate::db::models::change_log::ChangeLog;
use crate::db::repos::change_log_repo;
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn log_change(
    action: String,
    entity_type: String,
    entity_name: Option<String>,
    details: Option<String>,
    state: State<'_, AppState>,
) -> Result<()> {
    change_log_repo::insert(
        &state.pool,
        &action,
        &entity_type,
        entity_name.as_deref(),
        details.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn list_change_logs(limit: i64, state: State<'_, AppState>) -> Result<Vec<ChangeLog>> {
    change_log_repo::list(&state.pool, limit).await
}

#[tauri::command]
pub async fn clear_change_logs(state: State<'_, AppState>) -> Result<()> {
    change_log_repo::clear(&state.pool).await
}
