use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExecutionLog {
    pub id: i64,
    pub schedule_id: Option<i64>,
    pub audio_file_id: Option<i64>,
    pub schedule_name: Option<String>,
    pub audio_name: Option<String>,
    pub trigger_type: String,
    pub status: String,
    pub triggered_at: String,
    pub played_duration_ms: Option<i64>,
    pub position_start_ms: Option<i64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct NewLog {
    pub schedule_id: Option<i64>,
    pub audio_file_id: Option<i64>,
    pub schedule_name: Option<String>,
    pub audio_name: Option<String>,
    pub trigger_type: String,
    pub status: String,
    pub played_duration_ms: Option<i64>,
    pub position_start_ms: Option<i64>,
    pub error_message: Option<String>,
}
