use sqlx::SqlitePool;
use crate::db::models::log::{ExecutionLog, NewLog};
use crate::error::Result;

pub async fn insert(pool: &SqlitePool, log: &NewLog) -> Result<i64> {
    let id = sqlx::query!(
        "INSERT INTO execution_logs
         (schedule_id, audio_file_id, schedule_name, audio_name, trigger_type, status,
          played_duration_ms, position_start_ms, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        log.schedule_id,
        log.audio_file_id,
        log.schedule_name,
        log.audio_name,
        log.trigger_type,
        log.status,
        log.played_duration_ms,
        log.position_start_ms,
        log.error_message,
    )
    .execute(pool)
    .await?
    .last_insert_rowid();
    Ok(id)
}

pub async fn list(pool: &SqlitePool, limit: i64, offset: i64) -> Result<Vec<ExecutionLog>> {
    Ok(sqlx::query_as!(
        ExecutionLog,
        "SELECT id as \"id!: i64\", schedule_id, audio_file_id, schedule_name, audio_name,
                trigger_type, status, triggered_at, played_duration_ms,
                position_start_ms, error_message
         FROM execution_logs
         ORDER BY triggered_at DESC
         LIMIT ? OFFSET ?",
        limit, offset
    )
    .fetch_all(pool)
    .await?)
}

pub async fn clear_all(pool: &SqlitePool) -> Result<()> {
    sqlx::query!("DELETE FROM execution_logs")
        .execute(pool)
        .await?;
    Ok(())
}
