use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::audio::{AudioFile, AudioFolder};
use crate::db::models::schedule::{Schedule, ScheduleFormData};
use crate::db::repos::schedule_repo;
use crate::error::{AppError, Result};
use crate::AppState;

fn validate_schedule(data: &ScheduleFormData) -> Result<()> {
    // Validate time format HH:MM
    let parts: Vec<&str> = data.time.split(':').collect();
    let valid_time = parts.len() == 2
        && parts[0].parse::<u8>().map(|h| h < 24).unwrap_or(false)
        && parts[1].parse::<u8>().map(|m| m < 60).unwrap_or(false);
    if !valid_time {
        return Err(AppError::InvalidInput(format!(
            "Horário inválido '{}'. Use o formato HH:MM (ex: 07:30).",
            data.time
        )));
    }

    // At least one day must be selected
    if data.days_of_week.is_empty() {
        return Err(AppError::InvalidInput(
            "Selecione ao menos um dia da semana.".to_string(),
        ));
    }

    // Days must be in range 1–7
    if data.days_of_week.iter().any(|&d| d < 1 || d > 7) {
        return Err(AppError::InvalidInput(
            "Dias da semana devem estar entre 1 (Seg) e 7 (Dom).".to_string(),
        ));
    }

    // Must have either a folder or a single file configured
    if data.folder_id.is_none() && data.audio_file_id.is_none() {
        return Err(AppError::InvalidInput(
            "Configure uma pasta ou um arquivo de áudio para o agendamento.".to_string(),
        ));
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextSignal {
    pub schedule: Schedule,
    pub audio_file: Option<AudioFile>,
    pub folder: Option<AudioFolder>,
    pub seconds_until: u32,
}

#[tauri::command]
pub async fn list_schedules(state: State<'_, AppState>) -> Result<Vec<Schedule>> {
    schedule_repo::list_all(&state.pool).await
}

#[tauri::command]
pub async fn get_schedule(id: i64, state: State<'_, AppState>) -> Result<Option<Schedule>> {
    schedule_repo::get_by_id(&state.pool, id).await
}

#[tauri::command]
pub async fn create_schedule(data: ScheduleFormData, state: State<'_, AppState>) -> Result<Schedule> {
    validate_schedule(&data)?;
    schedule_repo::create(&state.pool, &data).await
}

#[tauri::command]
pub async fn update_schedule(
    id: i64,
    data: ScheduleFormData,
    state: State<'_, AppState>,
) -> Result<Schedule> {
    validate_schedule(&data)?;
    schedule_repo::update(&state.pool, id, &data).await
}

#[tauri::command]
pub async fn delete_schedule(id: i64, state: State<'_, AppState>) -> Result<()> {
    schedule_repo::delete(&state.pool, id).await
}

#[tauri::command]
pub async fn toggle_schedule_active(
    id: i64,
    active: bool,
    state: State<'_, AppState>,
) -> Result<()> {
    schedule_repo::toggle_active(&state.pool, id, active).await
}

#[tauri::command]
pub async fn get_next_signal(state: State<'_, AppState>) -> Result<Option<NextSignal>> {
    Ok(crate::core::scheduler::seconds_until_next(&state.pool).await)
}
