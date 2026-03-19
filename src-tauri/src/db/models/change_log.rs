use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChangeLog {
    pub id: i64,
    pub action: String,
    pub entity_type: String,
    pub entity_name: Option<String>,
    pub details: Option<String>,
    pub created_at: String,
}
