use tauri::State;

use crate::db::models::holiday::Holiday;
use crate::db::repos::holiday_repo;
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn list_holidays(state: State<'_, AppState>) -> Result<Vec<Holiday>> {
    holiday_repo::list(&state.pool).await
}

#[tauri::command]
pub async fn create_holiday(
    name: String,
    date: String,
    is_recurring: bool,
    state: State<'_, AppState>,
) -> Result<Holiday> {
    holiday_repo::create(&state.pool, &name, &date, is_recurring).await
}

#[tauri::command]
pub async fn update_holiday(
    id: i64,
    name: String,
    date: String,
    is_recurring: bool,
    state: State<'_, AppState>,
) -> Result<Holiday> {
    holiday_repo::update(&state.pool, id, &name, &date, is_recurring).await
}

#[tauri::command]
pub async fn delete_holiday(id: i64, state: State<'_, AppState>) -> Result<()> {
    holiday_repo::delete(&state.pool, id).await
}
