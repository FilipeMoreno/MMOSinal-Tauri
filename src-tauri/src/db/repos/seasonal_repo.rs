use sqlx::SqlitePool;
use crate::db::models::seasonal::{SeasonalOverride, SeasonalOverrideFormData};
use crate::error::Result;

const SELECT_ALL: &str = "SELECT id, name, replacement_folder_id, start_month, start_day, end_month, end_day, is_active, created_at FROM seasonal_overrides";

pub async fn list(pool: &SqlitePool) -> Result<Vec<SeasonalOverride>> {
    Ok(sqlx::query_as::<_, SeasonalOverride>(&format!("{SELECT_ALL} ORDER BY id"))
        .fetch_all(pool)
        .await?)
}

async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<SeasonalOverride> {
    Ok(sqlx::query_as::<_, SeasonalOverride>(&format!("{SELECT_ALL} WHERE id = ?"))
        .bind(id)
        .fetch_one(pool)
        .await?)
}

pub async fn create(pool: &SqlitePool, data: &SeasonalOverrideFormData) -> Result<SeasonalOverride> {
    let id = sqlx::query(
        "INSERT INTO seasonal_overrides (name, replacement_folder_id, start_month, start_day, end_month, end_day, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&data.name)
    .bind(data.replacement_folder_id)
    .bind(data.start_month)
    .bind(data.start_day)
    .bind(data.end_month)
    .bind(data.end_day)
    .bind(data.is_active)
    .execute(pool)
    .await?
    .last_insert_rowid();

    get_by_id(pool, id).await
}

pub async fn update(pool: &SqlitePool, id: i64, data: &SeasonalOverrideFormData) -> Result<SeasonalOverride> {
    sqlx::query(
        "UPDATE seasonal_overrides SET name = ?, replacement_folder_id = ?, start_month = ?, start_day = ?, end_month = ?, end_day = ?, is_active = ? WHERE id = ?"
    )
    .bind(&data.name)
    .bind(data.replacement_folder_id)
    .bind(data.start_month)
    .bind(data.start_day)
    .bind(data.end_month)
    .bind(data.end_day)
    .bind(data.is_active)
    .bind(id)
    .execute(pool)
    .await?;

    get_by_id(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM seasonal_overrides WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_active(pool: &SqlitePool, id: i64, is_active: bool) -> Result<SeasonalOverride> {
    sqlx::query("UPDATE seasonal_overrides SET is_active = ? WHERE id = ?")
        .bind(is_active)
        .bind(id)
        .execute(pool)
        .await?;

    get_by_id(pool, id).await
}

/// Returns the first active seasonal override that matches the given date ("YYYY-MM-DD").
/// Handles year-wrap ranges (e.g., Dec 20 → Jan 5).
pub async fn get_active_for_date(pool: &SqlitePool, date: &str) -> Option<SeasonalOverride> {
    // Parse month and day from "YYYY-MM-DD"
    let parts: Vec<i64> = date.split('-')
        .filter_map(|p| p.parse().ok())
        .collect();
    if parts.len() < 3 {
        return None;
    }
    let month = parts[1];
    let day   = parts[2];

    let overrides = sqlx::query_as::<_, SeasonalOverride>(
        &format!("{SELECT_ALL} WHERE is_active = 1 ORDER BY id")
    )
    .fetch_all(pool)
    .await
    .ok()?;

    overrides.into_iter().find(|ov| {
        let cur   = month * 100 + day;
        let start = ov.start_month * 100 + ov.start_day;
        let end   = ov.end_month   * 100 + ov.end_day;

        if start <= end {
            // Normal range: e.g., 0301 – 0331
            cur >= start && cur <= end
        } else {
            // Year-wrap: e.g., 1220 – 0105
            cur >= start || cur <= end
        }
    })
}
