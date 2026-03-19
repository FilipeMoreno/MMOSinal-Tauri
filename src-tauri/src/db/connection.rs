use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::Path;
use crate::error::Result;

pub async fn create_pool(db_path: &Path) -> Result<SqlitePool> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    let sql = include_str!("migrations/001_initial.sql");
    // Split by statement and execute each
    for stmt in sql.split(';') {
        let trimmed = stmt.trim();
        if trimmed.is_empty() {
            continue;
        }
        let result = sqlx::query(trimmed).execute(pool).await;
        if let Err(e) = result {
            // ALTER TABLE ADD COLUMN fails gracefully when column already exists
            let msg = e.to_string();
            if msg.contains("duplicate column name") || msg.contains("already exists") {
                continue;
            }
            return Err(e.into());
        }
    }
    Ok(())
}
