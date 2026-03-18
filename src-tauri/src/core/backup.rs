use chrono::Local;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::FileOptions;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupResult {
    pub success: bool,
    pub backup_path: String,
    pub timestamp: String,
    pub error: Option<String>,
}

/// Creates a ZIP backup of the database and audio folder
pub fn create_backup(
    db_path: &Path,
    audio_folder: &Path,
    backup_dest: &Path,
) -> BackupResult {
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_filename = format!("mmo_sinal_backup_{timestamp}.zip");
    let backup_path = backup_dest.join(&backup_filename);

    match do_backup(db_path, audio_folder, &backup_path) {
        Ok(_) => BackupResult {
            success: true,
            backup_path: backup_path.display().to_string(),
            timestamp,
            error: None,
        },
        Err(e) => BackupResult {
            success: false,
            backup_path: String::new(),
            timestamp,
            error: Some(e.to_string()),
        },
    }
}

fn do_backup(db_path: &Path, audio_folder: &Path, zip_path: &Path) -> Result<()> {
    if let Some(parent) = zip_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = std::fs::File::create(zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add database file
    if db_path.exists() {
        zip.start_file("database/mmo_sinal.db", options)?;
        let mut db_file = std::fs::File::open(db_path)?;
        std::io::copy(&mut db_file, &mut zip)?;
    }

    // Add audio files
    if audio_folder.exists() {
        for entry in WalkDir::new(audio_folder).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let relative = entry.path().strip_prefix(audio_folder)
                    .unwrap_or(entry.path());
                let zip_name = format!("audio/{}", relative.display());
                zip.start_file(zip_name, options)?;
                let mut f = std::fs::File::open(entry.path())?;
                std::io::copy(&mut f, &mut zip)?;
            }
        }
    }

    zip.finish()?;
    Ok(())
}

/// Auto-backup loop: runs every `interval_hours` hours
pub async fn run_auto_backup(
    db_path: PathBuf,
    audio_folder: PathBuf,
    backup_dest: PathBuf,
    interval_hours: u64,
) {
    let interval = tokio::time::Duration::from_secs(interval_hours * 3600);
    loop {
        tokio::time::sleep(interval).await;
        tracing::info!("Running scheduled backup...");
        let result = create_backup(&db_path, &audio_folder, &backup_dest);
        if result.success {
            tracing::info!("Backup created: {}", result.backup_path);
        } else {
            tracing::warn!("Backup failed: {:?}", result.error);
        }
    }
}
