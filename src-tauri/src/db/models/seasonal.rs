use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SeasonalOverride {
    pub id: i64,
    pub name: String,
    pub replacement_folder_id: i64,
    pub start_month: i64,
    pub start_day: i64,
    pub end_month: i64,
    pub end_day: i64,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SeasonalOverrideFormData {
    pub name: String,
    pub replacement_folder_id: i64,
    pub start_month: i64,
    pub start_day: i64,
    pub end_month: i64,
    pub end_day: i64,
    pub is_active: bool,
}
