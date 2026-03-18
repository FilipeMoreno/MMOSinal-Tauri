use sqlx::SqlitePool;
use crate::db::models::panic_button::PanicButton;
use crate::error::Result;

pub async fn list(pool: &SqlitePool) -> Result<Vec<PanicButton>> {
    Ok(sqlx::query_as!(
        PanicButton,
        "SELECT id as \"id!: i64\", name, audio_file_id, interrupt_mode, color_hex, sort_order, created_at
         FROM panic_buttons ORDER BY sort_order, id"
    )
    .fetch_all(pool)
    .await?)
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<Option<PanicButton>> {
    Ok(sqlx::query_as!(
        PanicButton,
        "SELECT id as \"id!: i64\", name, audio_file_id, interrupt_mode, color_hex, sort_order, created_at
         FROM panic_buttons WHERE id = ?",
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn create(
    pool: &SqlitePool,
    name: &str,
    audio_file_id: i64,
    interrupt_mode: &str,
    color_hex: &str,
) -> Result<PanicButton> {
    let id = sqlx::query!(
        "INSERT INTO panic_buttons (name, audio_file_id, interrupt_mode, color_hex)
         VALUES (?, ?, ?, ?)",
        name, audio_file_id, interrupt_mode, color_hex
    )
    .execute(pool)
    .await?
    .last_insert_rowid();

    get_by_id(pool, id).await?.ok_or_else(|| crate::error::AppError::NotFound(format!("PanicButton {id}")))
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    name: &str,
    audio_file_id: i64,
    interrupt_mode: &str,
    color_hex: &str,
) -> Result<PanicButton> {
    sqlx::query!(
        "UPDATE panic_buttons SET name=?, audio_file_id=?, interrupt_mode=?, color_hex=? WHERE id=?",
        name, audio_file_id, interrupt_mode, color_hex, id
    )
    .execute(pool)
    .await?;

    get_by_id(pool, id).await?.ok_or_else(|| crate::error::AppError::NotFound(format!("PanicButton {id}")))
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query!("DELETE FROM panic_buttons WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}
