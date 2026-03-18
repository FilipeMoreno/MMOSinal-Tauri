use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub id: i64,
    pub name: String,
    pub time: String,
    pub days_of_week: Vec<u8>, // desserializado do JSON
    pub folder_id: Option<i64>,
    pub audio_file_id: Option<i64>,
    pub play_duration_s: i64,
    pub fade_in_s: i64,
    pub fade_out_s: i64,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Row diretamente do SQLite (days_of_week como TEXT JSON)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ScheduleRow {
    pub id: i64,
    pub name: String,
    pub time: String,
    pub days_of_week: String, // JSON string
    pub folder_id: Option<i64>,
    pub audio_file_id: Option<i64>,
    pub play_duration_s: i64,
    pub fade_in_s: i64,
    pub fade_out_s: i64,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ScheduleRow> for Schedule {
    fn from(row: ScheduleRow) -> Self {
        let days: Vec<u8> = serde_json::from_str(&row.days_of_week)
            .unwrap_or_else(|e| {
                tracing::warn!(
                    "Schedule id={} has invalid days_of_week JSON {:?}: {e}",
                    row.id, row.days_of_week
                );
                Vec::new()
            });
        Schedule {
            id: row.id,
            name: row.name,
            time: row.time,
            days_of_week: days,
            folder_id: row.folder_id,
            audio_file_id: row.audio_file_id,
            play_duration_s: row.play_duration_s,
            fade_in_s: row.fade_in_s,
            fade_out_s: row.fade_out_s,
            is_active: row.is_active,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScheduleFormData {
    pub name: String,
    pub time: String,
    pub days_of_week: Vec<u8>,
    pub folder_id: Option<i64>,
    pub audio_file_id: Option<i64>,
    pub play_duration_s: i64,
    pub fade_in_s: i64,
    pub fade_out_s: i64,
    pub is_active: bool,
}
