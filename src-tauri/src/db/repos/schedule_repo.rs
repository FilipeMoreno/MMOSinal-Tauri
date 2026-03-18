use sqlx::SqlitePool;
use crate::db::models::schedule::{Schedule, ScheduleFormData, ScheduleRow};
use crate::error::Result;

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Schedule>> {
    let rows = sqlx::query_as!(
        ScheduleRow,
        r#"SELECT id as "id!: i64", name, time, days_of_week, folder_id, audio_file_id,
                  play_duration_s, fade_in_s, fade_out_s,
                  is_active as "is_active: bool",
                  created_at, updated_at
           FROM schedules ORDER BY time"#
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Schedule::from).collect())
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<Option<Schedule>> {
    let row = sqlx::query_as!(
        ScheduleRow,
        r#"SELECT id as "id!: i64", name, time, days_of_week, folder_id, audio_file_id,
                  play_duration_s, fade_in_s, fade_out_s,
                  is_active as "is_active: bool",
                  created_at, updated_at
           FROM schedules WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(Schedule::from))
}

pub async fn list_active(pool: &SqlitePool) -> Result<Vec<Schedule>> {
    let rows = sqlx::query_as!(
        ScheduleRow,
        r#"SELECT id as "id!: i64", name, time, days_of_week, folder_id, audio_file_id,
                  play_duration_s, fade_in_s, fade_out_s,
                  is_active as "is_active: bool",
                  created_at, updated_at
           FROM schedules WHERE is_active = 1 ORDER BY time"#
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(Schedule::from).collect())
}

pub async fn create(pool: &SqlitePool, data: &ScheduleFormData) -> Result<Schedule> {
    let days_json = serde_json::to_string(&data.days_of_week)
        .unwrap_or_else(|_| "[]".to_string());

    let id = sqlx::query!(
        "INSERT INTO schedules (name, time, days_of_week, folder_id, audio_file_id,
                                play_duration_s, fade_in_s, fade_out_s, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        data.name, data.time, days_json,
        data.folder_id, data.audio_file_id,
        data.play_duration_s, data.fade_in_s, data.fade_out_s, data.is_active
    )
    .execute(pool)
    .await?
    .last_insert_rowid();

    get_by_id(pool, id).await?.ok_or_else(|| crate::error::AppError::NotFound(format!("Schedule {id}")))
}

pub async fn update(pool: &SqlitePool, id: i64, data: &ScheduleFormData) -> Result<Schedule> {
    let days_json = serde_json::to_string(&data.days_of_week)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query!(
        "UPDATE schedules SET name=?, time=?, days_of_week=?, folder_id=?, audio_file_id=?,
         play_duration_s=?, fade_in_s=?, fade_out_s=?, is_active=?,
         updated_at=datetime('now','localtime')
         WHERE id=?",
        data.name, data.time, days_json,
        data.folder_id, data.audio_file_id,
        data.play_duration_s, data.fade_in_s, data.fade_out_s, data.is_active,
        id
    )
    .execute(pool)
    .await?;

    get_by_id(pool, id).await?.ok_or_else(|| crate::error::AppError::NotFound(format!("Schedule {id}")))
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query!("DELETE FROM schedules WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_active(pool: &SqlitePool, id: i64, active: bool) -> Result<()> {
    sqlx::query!(
        "UPDATE schedules SET is_active = ?, updated_at = datetime('now','localtime') WHERE id = ?",
        active, id
    )
    .execute(pool)
    .await?;
    Ok(())
}
