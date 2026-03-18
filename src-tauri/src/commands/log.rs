use tauri::State;

use crate::db::models::log::ExecutionLog;
use crate::db::repos::log_repo;
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn list_execution_logs(
    limit: i64,
    offset: i64,
    state: State<'_, AppState>,
) -> Result<Vec<ExecutionLog>> {
    log_repo::list(&state.pool, limit, offset).await
}

#[tauri::command]
pub async fn clear_execution_logs(state: State<'_, AppState>) -> Result<()> {
    log_repo::clear_all(&state.pool).await
}
