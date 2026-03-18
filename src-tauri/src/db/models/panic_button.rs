use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PanicButton {
    pub id: i64,
    pub name: String,
    pub audio_file_id: i64,
    pub interrupt_mode: String,
    pub color_hex: String,
    pub sort_order: i64,
    pub created_at: String,
}
