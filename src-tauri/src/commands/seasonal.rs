use tauri::State;

use crate::db::models::seasonal::{SeasonalOverride, SeasonalOverrideFormData};
use crate::db::repos::seasonal_repo;
use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn list_seasonal_overrides(state: State<'_, AppState>) -> Result<Vec<SeasonalOverride>> {
    seasonal_repo::list(&state.pool).await
}

#[tauri::command]
pub async fn create_seasonal_override(
    data: SeasonalOverrideFormData,
    state: State<'_, AppState>,
) -> Result<SeasonalOverride> {
    seasonal_repo::create(&state.pool, &data).await
}

#[tauri::command]
pub async fn update_seasonal_override(
    id: i64,
    data: SeasonalOverrideFormData,
    state: State<'_, AppState>,
) -> Result<SeasonalOverride> {
    seasonal_repo::update(&state.pool, id, &data).await
}

#[tauri::command]
pub async fn delete_seasonal_override(id: i64, state: State<'_, AppState>) -> Result<()> {
    seasonal_repo::delete(&state.pool, id).await
}

#[tauri::command]
pub async fn toggle_seasonal_override(
    id: i64,
    is_active: bool,
    state: State<'_, AppState>,
) -> Result<SeasonalOverride> {
    seasonal_repo::toggle_active(&state.pool, id, is_active).await
}
