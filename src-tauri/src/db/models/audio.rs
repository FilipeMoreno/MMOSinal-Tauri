use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AudioFolder {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub shuffle: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AudioFile {
    pub id: i64,
    pub folder_id: i64,
    pub name: String,
    pub filename: String,
    pub file_path: String,
    pub duration_ms: Option<i64>,
    pub sort_order: i64,
    pub created_at: String,
    #[sqlx(default)]
    pub content_start_ms: Option<i64>,
    #[sqlx(default)]
    pub content_end_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AudioPlaybackState {
    pub audio_file_id: i64,
    pub position_ms: i64,
    pub last_schedule_id: Option<i64>,
    pub updated_at: String,
}
