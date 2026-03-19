use sqlx::SqlitePool;
use crate::db::models::change_log::ChangeLog;
use crate::error::Result;

pub async fn insert(
    pool: &SqlitePool,
    action: &str,
    entity_type: &str,
    entity_name: Option<&str>,
    details: Option<&str>,
) -> Result<()> {
    sqlx::query!(
        "INSERT INTO change_logs (action, entity_type, entity_name, details) VALUES (?, ?, ?, ?)",
        action, entity_type, entity_name, details
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list(pool: &SqlitePool, limit: i64) -> Result<Vec<ChangeLog>> {
    Ok(sqlx::query_as!(
        ChangeLog,
        "SELECT id as \"id!: i64\", action, entity_type, entity_name, details, created_at
         FROM change_logs ORDER BY id DESC LIMIT ?",
        limit
    )
    .fetch_all(pool)
    .await?)
}

pub async fn clear(pool: &SqlitePool) -> Result<()> {
    sqlx::query!("DELETE FROM change_logs").execute(pool).await?;
    Ok(())
}
