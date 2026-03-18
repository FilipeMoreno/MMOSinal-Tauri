use sqlx::SqlitePool;
use crate::db::models::holiday::Holiday;
use crate::error::Result;

pub async fn list(pool: &SqlitePool) -> Result<Vec<Holiday>> {
    Ok(sqlx::query_as!(
        Holiday,
        r#"SELECT id as "id!: i64", name, date, is_recurring as "is_recurring: bool", created_at
           FROM holidays ORDER BY date"#
    )
    .fetch_all(pool)
    .await?)
}

pub async fn create(pool: &SqlitePool, name: &str, date: &str, is_recurring: bool) -> Result<Holiday> {
    let id = sqlx::query!(
        "INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)",
        name, date, is_recurring
    )
    .execute(pool)
    .await?
    .last_insert_rowid();

    Ok(sqlx::query_as!(
        Holiday,
        r#"SELECT id as "id!: i64", name, date, is_recurring as "is_recurring: bool", created_at
           FROM holidays WHERE id = ?"#,
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn update(pool: &SqlitePool, id: i64, name: &str, date: &str, is_recurring: bool) -> Result<Holiday> {
    sqlx::query!(
        "UPDATE holidays SET name = ?, date = ?, is_recurring = ? WHERE id = ?",
        name, date, is_recurring, id
    )
    .execute(pool)
    .await?;

    Ok(sqlx::query_as!(
        Holiday,
        r#"SELECT id as "id!: i64", name, date, is_recurring as "is_recurring: bool", created_at
           FROM holidays WHERE id = ?"#,
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query!("DELETE FROM holidays WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Returns true if the given date (YYYY-MM-DD) is a holiday
pub async fn is_holiday(pool: &SqlitePool, date: &str) -> Result<bool> {
    // Check exact date match
    let exact = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM holidays WHERE date = ? AND is_recurring = 0",
        date
    )
    .fetch_one(pool)
    .await?;

    if exact > 0 {
        return Ok(true);
    }

    // Check recurring (same MM-DD)
    let mm_dd = &date[5..]; // "MM-DD" from "YYYY-MM-DD"
    let recurring = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM holidays WHERE substr(date,6) = ? AND is_recurring = 1",
        mm_dd
    )
    .fetch_one(pool)
    .await?;

    Ok(recurring > 0)
}
