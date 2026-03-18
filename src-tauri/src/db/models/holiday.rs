use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Holiday {
    pub id: i64,
    pub name: String,
    pub date: String, // "YYYY-MM-DD"
    pub is_recurring: bool,
    pub created_at: String,
}
