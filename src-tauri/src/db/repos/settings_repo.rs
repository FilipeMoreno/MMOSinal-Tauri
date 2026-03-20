use sqlx::SqlitePool;
use crate::db::models::settings::AppSettings;
use crate::error::Result;

pub async fn get(pool: &SqlitePool) -> Result<AppSettings> {
    let rows = sqlx::query!("SELECT key, value FROM app_settings")
        .fetch_all(pool)
        .await?;

    let mut s = AppSettings::default();
    for row in rows {
        match row.key.as_deref().unwrap_or("") {
            "backup_folder"        => s.backup_folder = row.value,
            "backup_auto_enabled"  => s.backup_auto_enabled = row.value == "true",
            "backup_interval_hours"=> s.backup_interval_hours = row.value.parse().unwrap_or(24),
            "audio_storage_folder" => s.audio_storage_folder = row.value,
            "start_minimized"      => s.start_minimized = row.value == "true",
            "start_with_os"        => s.start_with_os = row.value == "true",
            "ntp_server"           => s.ntp_server = row.value,
            "ntp_auto_sync"        => s.ntp_auto_sync = row.value == "true",
            "default_volume"       => s.default_volume = row.value.parse().unwrap_or(1.0),
            "setup_complete"       => s.setup_complete = row.value == "true",
            "kiosk_mode"           => s.kiosk_mode = row.value == "true",
            "kiosk_start"          => s.kiosk_start = row.value == "true",
            "mini_player_enabled"  => s.mini_player_enabled = row.value != "false",
            _ => {}
        }
    }
    Ok(s)
}

pub async fn save(pool: &SqlitePool, s: &AppSettings) -> Result<()> {
    let pairs: &[(&str, String)] = &[
        ("backup_folder",         s.backup_folder.clone()),
        ("backup_auto_enabled",   s.backup_auto_enabled.to_string()),
        ("backup_interval_hours", s.backup_interval_hours.to_string()),
        ("audio_storage_folder",  s.audio_storage_folder.clone()),
        ("start_minimized",       s.start_minimized.to_string()),
        ("start_with_os",         s.start_with_os.to_string()),
        ("ntp_server",            s.ntp_server.clone()),
        ("ntp_auto_sync",         s.ntp_auto_sync.to_string()),
        ("default_volume",        s.default_volume.to_string()),
        ("setup_complete",        s.setup_complete.to_string()),
        ("kiosk_mode",            s.kiosk_mode.to_string()),
        ("kiosk_start",           s.kiosk_start.to_string()),
        ("mini_player_enabled",   s.mini_player_enabled.to_string()),
    ];

    for (key, value) in pairs {
        sqlx::query!(
            "INSERT INTO app_settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            key, value
        )
        .execute(pool)
        .await?;
    }
    Ok(())
}
