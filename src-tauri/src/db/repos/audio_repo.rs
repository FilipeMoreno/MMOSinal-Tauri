use sqlx::SqlitePool;
use crate::db::models::audio::{AudioFile, AudioFolder, AudioPlaybackState};
use crate::error::Result;

/// Returns the next audio file to play from a folder.
///
/// Resume rule (same for both modes): if any file has 0 < saved_pos < effective_end,
/// that file is "in progress" and is always returned first so playback resumes.
///
/// A file is considered "done" when saved_pos >= effective_end, where effective_end is
/// content_end_ms if set, otherwise duration_ms, otherwise i64::MAX.
///
/// Selection rule (when no file is in progress):
///   Sequential → first unplayed file in sort_order, wrapping around after all played.
///   Shuffle    → random unplayed file, wrapping around after all played.
pub async fn next_file_for_folder(pool: &SqlitePool, folder_id: i64) -> Option<AudioFile> {
    let folder = get_folder(pool, folder_id).await.ok()??;
    let files = list_files(pool, folder_id).await.ok()?;
    if files.is_empty() { return None; }

    // Collect (file, saved_pos, effective_end) for all files in one pass
    let mut file_states: Vec<(AudioFile, i64, i64)> = Vec::with_capacity(files.len());
    for file in &files {
        let state = get_playback_state(pool, file.id).await.ok().flatten();
        let pos = state.map(|s| s.position_ms).unwrap_or(0);
        let effective_end = file.content_end_ms
            .or(file.duration_ms)
            .unwrap_or(i64::MAX);
        file_states.push((file.clone(), pos, effective_end));
    }

    // 1. Resume any file that is partially played (in progress)
    if let Some((file, _, _)) = file_states
        .iter()
        .find(|(_, pos, end)| *pos > 0 && pos < end)
    {
        return Some(file.clone());
    }

    // 2. Pick from files not yet started (position == 0)
    let unplayed: Vec<&AudioFile> = file_states
        .iter()
        .filter(|(_, pos, _)| *pos == 0)
        .map(|(f, _, _)| f)
        .collect();

    if !unplayed.is_empty() {
        return Some(if folder.shuffle {
            let idx = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos() as usize % unplayed.len();
            unplayed[idx].clone()
        } else {
            unplayed[0].clone()
        });
    }

    // 3. All files played — reset and start over
    for file in &files {
        let _ = upsert_playback_state(pool, file.id, 0, None).await;
    }
    if folder.shuffle {
        let idx = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos() as usize % files.len();
        files.into_iter().nth(idx)
    } else {
        files.into_iter().next()
    }
}

// ── Folders ──────────────────────────────────────────────────────────────────

pub async fn list_folders(pool: &SqlitePool) -> Result<Vec<AudioFolder>> {
    Ok(sqlx::query_as!(
        AudioFolder,
        r#"SELECT id as "id!: i64", name, description, shuffle as "shuffle!: bool", created_at
           FROM audio_folders ORDER BY name"#
    )
    .fetch_all(pool)
    .await?)
}

pub async fn get_folder(pool: &SqlitePool, id: i64) -> Result<Option<AudioFolder>> {
    Ok(sqlx::query_as!(
        AudioFolder,
        r#"SELECT id as "id!: i64", name, description, shuffle as "shuffle!: bool", created_at
           FROM audio_folders WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn create_folder(pool: &SqlitePool, name: &str, description: Option<&str>, shuffle: bool) -> Result<AudioFolder> {
    let shuffle_int = shuffle as i64;
    let id = sqlx::query!(
        "INSERT INTO audio_folders (name, description, shuffle) VALUES (?, ?, ?)",
        name, description, shuffle_int
    )
    .execute(pool)
    .await?
    .last_insert_rowid();

    Ok(sqlx::query_as!(
        AudioFolder,
        r#"SELECT id as "id!: i64", name, description, shuffle as "shuffle!: bool", created_at
           FROM audio_folders WHERE id = ?"#,
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn update_folder(pool: &SqlitePool, id: i64, name: &str, description: Option<&str>, shuffle: bool) -> Result<AudioFolder> {
    let shuffle_int = shuffle as i64;
    sqlx::query!(
        "UPDATE audio_folders SET name = ?, description = ?, shuffle = ? WHERE id = ?",
        name, description, shuffle_int, id
    )
    .execute(pool)
    .await?;

    Ok(sqlx::query_as!(
        AudioFolder,
        r#"SELECT id as "id!: i64", name, description, shuffle as "shuffle!: bool", created_at
           FROM audio_folders WHERE id = ?"#,
        id
    )
    .fetch_one(pool)
    .await?)
}

pub async fn update_folder_shuffle(pool: &SqlitePool, id: i64, shuffle: bool) -> Result<AudioFolder> {
    let shuffle_int = shuffle as i64;
    sqlx::query!(
        "UPDATE audio_folders SET shuffle = ? WHERE id = ?",
        shuffle_int, id
    )
    .execute(pool)
    .await?;

    Ok(sqlx::query_as!(
        AudioFolder,
        r#"SELECT id as "id!: i64", name, description, shuffle as "shuffle!: bool", created_at
           FROM audio_folders WHERE id = ?"#,
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

const AUDIO_FILE_SELECT: &str = "SELECT id, folder_id, name, filename, file_path, \
    duration_ms, sort_order, created_at, content_start_ms, content_end_ms \
    FROM audio_files";

pub async fn list_files(pool: &SqlitePool, folder_id: i64) -> Result<Vec<AudioFile>> {
    Ok(sqlx::query_as::<_, AudioFile>(
        &format!("{AUDIO_FILE_SELECT} WHERE folder_id = ? ORDER BY sort_order, id"),
    )
    .bind(folder_id)
    .fetch_all(pool)
    .await?)
}

pub async fn get_file(pool: &SqlitePool, id: i64) -> Result<Option<AudioFile>> {
    Ok(sqlx::query_as::<_, AudioFile>(
        &format!("{AUDIO_FILE_SELECT} WHERE id = ?"),
    )
    .bind(id)
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

    Ok(sqlx::query_as::<_, AudioFile>(
        &format!("{AUDIO_FILE_SELECT} WHERE id = ?"),
    )
    .bind(id)
    .fetch_one(pool)
    .await?)
}

pub async fn rename_file(pool: &SqlitePool, id: i64, name: &str) -> Result<AudioFile> {
    sqlx::query!("UPDATE audio_files SET name = ? WHERE id = ?", name, id)
        .execute(pool)
        .await?;
    Ok(sqlx::query_as::<_, AudioFile>(
        &format!("{AUDIO_FILE_SELECT} WHERE id = ?"),
    )
    .bind(id)
    .fetch_one(pool)
    .await?)
}

pub async fn move_file(
    pool: &SqlitePool,
    file_id: i64,
    target_folder_id: i64,
    new_file_path: &str,
) -> Result<AudioFile> {
    // Place at end of target folder
    let count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM audio_files WHERE folder_id = ?",
        target_folder_id
    )
    .fetch_one(pool)
    .await?;
    let sort_order = count;
    sqlx::query!(
        "UPDATE audio_files SET folder_id = ?, file_path = ?, sort_order = ? WHERE id = ?",
        target_folder_id, new_file_path, sort_order, file_id
    )
    .execute(pool)
    .await?;
    Ok(sqlx::query_as::<_, AudioFile>(
        &format!("{AUDIO_FILE_SELECT} WHERE id = ?"),
    )
    .bind(file_id)
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

pub async fn update_content_boundaries(
    pool: &SqlitePool,
    file_id: i64,
    start_ms: Option<i64>,
    end_ms: Option<i64>,
) -> Result<()> {
    sqlx::query(
        "UPDATE audio_files SET content_start_ms = ?, content_end_ms = ? WHERE id = ?"
    )
    .bind(start_ms)
    .bind(end_ms)
    .bind(file_id)
    .execute(pool)
    .await?;
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
