use sqlx::SqlitePool;
use crate::db::models::audio::{AudioFile, AudioFolder, AudioPlaybackState};
use crate::error::Result;

// ── Folders ──────────────────────────────────────────────────────────────────

pub async fn list_folders(pool: &SqlitePool) -> Result<Vec<AudioFolder>> {
    Ok(sqlx::query_as!(
        AudioFolder,
        "SELECT id as \"id!: i64\", name, description, created_at FROM audio_folders ORDER BY name"
    )
    .fetch_all(pool)
    .await?)
}

pub async fn create_folder(pool: &SqlitePool, name: &str, description: Option<&str>) -> Result<AudioFolder> {
    let id = sqlx::query!(
        "INSERT INTO audio_folders (name, description) VALUES (?, ?)",
        name, description
    )
    .execute(pool)
    .await?
    .last_insert_rowid();

    Ok(sqlx::query_as!(
        AudioFolder,
        "SELECT id as \"id!: i64\", name, description, created_at FROM audio_folders WHERE id = ?",
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn update_folder(pool: &SqlitePool, id: i64, name: &str, description: Option<&str>) -> Result<AudioFolder> {
    sqlx::query!(
        "UPDATE audio_folders SET name = ?, description = ? WHERE id = ?",
        name, description, id
    )
    .execute(pool)
    .await?;

    Ok(sqlx::query_as!(
        AudioFolder,
        "SELECT id as \"id!: i64\", name, description, created_at FROM audio_folders WHERE id = ?",
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn delete_folder(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query!("DELETE FROM audio_folders WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Files ─────────────────────────────────────────────────────────────────────

pub async fn list_files(pool: &SqlitePool, folder_id: i64) -> Result<Vec<AudioFile>> {
    Ok(sqlx::query_as!(
        AudioFile,
        "SELECT id as \"id!: i64\", folder_id, name, filename, file_path, duration_ms, sort_order, created_at
         FROM audio_files WHERE folder_id = ? ORDER BY sort_order, id",
        folder_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn get_file(pool: &SqlitePool, id: i64) -> Result<Option<AudioFile>> {
    Ok(sqlx::query_as!(
        AudioFile,
        "SELECT id as \"id!: i64\", folder_id, name, filename, file_path, duration_ms, sort_order, created_at
         FROM audio_files WHERE id = ?",
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn insert_file(
    pool: &SqlitePool,
    folder_id: i64,
    name: &str,
    filename: &str,
    file_path: &str,
    duration_ms: Option<i64>,
    sort_order: i64,
) -> Result<AudioFile> {
    let id = sqlx::query!(
        "INSERT INTO audio_files (folder_id, name, filename, file_path, duration_ms, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)",
        folder_id, name, filename, file_path, duration_ms, sort_order
    )
    .execute(pool)
    .await?
    .last_insert_rowid();

    Ok(sqlx::query_as!(
        AudioFile,
        "SELECT id as \"id!: i64\", folder_id, name, filename, file_path, duration_ms, sort_order, created_at
         FROM audio_files WHERE id = ?",
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn delete_file(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query!("DELETE FROM audio_files WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn reorder_files(pool: &SqlitePool, folder_id: i64, ordered_ids: &[i64]) -> Result<()> {
    for (idx, &file_id) in ordered_ids.iter().enumerate() {
        let order = idx as i64;
        sqlx::query!(
            "UPDATE audio_files SET sort_order = ? WHERE id = ? AND folder_id = ?",
            order, file_id, folder_id
        )
        .execute(pool)
        .await?;
    }
    Ok(())
}

// ── Playback State ────────────────────────────────────────────────────────────

pub async fn get_playback_state(pool: &SqlitePool, audio_file_id: i64) -> Result<Option<AudioPlaybackState>> {
    Ok(sqlx::query_as!(
        AudioPlaybackState,
        "SELECT audio_file_id as \"audio_file_id!: i64\", position_ms, last_schedule_id, updated_at
         FROM audio_playback_state WHERE audio_file_id = ?",
        audio_file_id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn upsert_playback_state(
    pool: &SqlitePool,
    audio_file_id: i64,
    position_ms: i64,
    schedule_id: Option<i64>,
) -> Result<()> {
    sqlx::query!(
        "INSERT INTO audio_playback_state (audio_file_id, position_ms, last_schedule_id, updated_at)
         VALUES (?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(audio_file_id) DO UPDATE SET
            position_ms = excluded.position_ms,
            last_schedule_id = excluded.last_schedule_id,
            updated_at = excluded.updated_at",
        audio_file_id, position_ms, schedule_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

#[allow(dead_code)]
pub async fn reset_playback_state(pool: &SqlitePool, audio_file_id: i64) -> Result<()> {
    sqlx::query!(
        "UPDATE audio_playback_state SET position_ms = 0 WHERE audio_file_id = ?",
        audio_file_id
    )
    .execute(pool)
    .await?;
    Ok(())
}
