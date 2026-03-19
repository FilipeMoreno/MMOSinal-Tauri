use chrono::{Datelike, Local, Timelike, Weekday};
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::db::models::log::NewLog;
use crate::db::repos::{audio_repo, holiday_repo, log_repo, schedule_repo, settings_repo};
use crate::core::player_engine::PlayerEngine;

/// Converts chrono Weekday to our 1-7 scheme (1=Mon, 7=Sun)
fn weekday_to_num(w: Weekday) -> u8 {
    match w {
        Weekday::Mon => 1,
        Weekday::Tue => 2,
        Weekday::Wed => 3,
        Weekday::Thu => 4,
        Weekday::Fri => 5,
        Weekday::Sat => 6,
        Weekday::Sun => 7,
    }
}


/// Main scheduler loop — runs every second, checks if any schedule should fire
pub async fn run_scheduler(
    pool: SqlitePool,
    engine: Arc<Mutex<PlayerEngine>>,
    app: AppHandle,
) {
    info!("Scheduler started");
    let mut last_triggered: Option<(i64, String)> = None; // (schedule_id, "HH:MM")

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        let now = Local::now();
        let current_time = format!("{:02}:{:02}", now.hour(), now.minute());
        let current_day = weekday_to_num(now.weekday());
        let current_date = now.format("%Y-%m-%d").to_string();

        // Check holiday
        let is_holiday = holiday_repo::is_holiday(&pool, &current_date)
            .await
            .unwrap_or(false);

        if is_holiday {
            continue;
        }

        let schedules = match schedule_repo::list_active(&pool).await {
            Ok(s) => s,
            Err(e) => { warn!("Failed to load schedules: {e}"); continue; }
        };

        for schedule in schedules {
            if schedule.time != current_time {
                continue;
            }

            // Avoid firing the same schedule twice in the same minute
            if let Some((last_id, last_time)) = &last_triggered {
                if *last_id == schedule.id && *last_time == current_time {
                    continue;
                }
            }

            // Check day of week
            if !schedule.days_of_week.contains(&current_day) {
                continue;
            }

            last_triggered = Some((schedule.id, current_time.clone()));

            info!("Firing schedule: {} at {}", schedule.name, schedule.time);

            // Determine which file to play
            let play_folder_id: Option<i64>;
            let file = if let Some(file_id) = schedule.audio_file_id {
                play_folder_id = None;
                audio_repo::get_file(&pool, file_id).await.ok().flatten()
            } else if let Some(folder_id) = schedule.folder_id {
                play_folder_id = Some(folder_id);
                audio_repo::next_file_for_folder(&pool, folder_id).await
            } else {
                play_folder_id = None;
                warn!("Schedule {} has no file or folder configured", schedule.id);
                // Log as error
                let _ = log_repo::insert(&pool, &NewLog {
                    schedule_id: Some(schedule.id),
                    audio_file_id: None,
                    schedule_name: Some(schedule.name.clone()),
                    audio_name: None,
                    trigger_type: "scheduled".to_string(),
                    status: "error".to_string(),
                    played_duration_ms: None,
                    position_start_ms: None,
                    error_message: Some("Nenhum arquivo ou pasta configurado".to_string()),
                }).await;
                continue;
            };

            let Some(file) = file else {
                warn!("No file found for schedule {}", schedule.id);
                continue;
            };

            let default_volume = settings_repo::get(&pool).await
                .map(|s| s.default_volume)
                .unwrap_or(1.0);

            let eng = engine.lock().await;
            let result = eng
                .play(
                    file,
                    Some(schedule.clone()),
                    play_folder_id,
                    schedule.play_duration_s as u64,
                    schedule.fade_in_s as u64,
                    schedule.fade_out_s as u64,
                    default_volume,
                    &pool,
                    &app,
                )
                .await;

            if let Err(e) = result {
                warn!("Playback error for schedule {}: {e}", schedule.id);
                let _ = log_repo::insert(&pool, &NewLog {
                    schedule_id: Some(schedule.id),
                    audio_file_id: None,
                    schedule_name: Some(schedule.name),
                    audio_name: None,
                    trigger_type: "scheduled".to_string(),
                    status: "error".to_string(),
                    played_duration_ms: None,
                    position_start_ms: None,
                    error_message: Some(e.to_string()),
                }).await;
            }
        }
    }
}

/// Compute seconds until the next scheduled signal (for dashboard)
pub async fn seconds_until_next(pool: &SqlitePool) -> Option<crate::commands::schedule::NextSignal> {
    use crate::db::repos::{audio_repo as ar, schedule_repo as sr};

    let now = Local::now();
    let current_day = weekday_to_num(now.weekday());

    let schedules = sr::list_active(pool).await.ok()?;
    if schedules.is_empty() { return None; }

    let now_secs = now.hour() * 3600 + now.minute() * 60 + now.second();

    let mut best: Option<(u32, crate::db::models::schedule::Schedule)> = None;

    // Look up to 7 days ahead
    for day_offset in 0u32..7 {
        let check_day = ((current_day as u32 + day_offset - 1) % 7 + 1) as u8;
        let is_today = day_offset == 0;

        // Check if the candidate date is a holiday
        let check_date = (now + chrono::Duration::days(day_offset as i64))
            .format("%Y-%m-%d").to_string();
        let day_is_holiday = holiday_repo::is_holiday(pool, &check_date).await.unwrap_or(false);
        if day_is_holiday { continue; }

        for schedule in &schedules {
            if !schedule.days_of_week.contains(&check_day) { continue; }

            let parts: Vec<u32> = schedule.time.split(':').filter_map(|p| p.parse().ok()).collect();
            if parts.len() < 2 { continue; }
            let sched_secs = parts[0] * 3600 + parts[1] * 60;

            if is_today && sched_secs <= now_secs { continue; } // already passed today

            let delta = if is_today {
                sched_secs - now_secs
            } else {
                (86400 * day_offset) + sched_secs - now_secs
            };

            match &best {
                None => best = Some((delta, schedule.clone())),
                Some((best_delta, _)) if delta < *best_delta => {
                    best = Some((delta, schedule.clone()));
                }
                _ => {}
            }
        }

        if best.is_some() { break; }
    }

    let (secs, schedule) = best?;

    let audio_file = if let Some(fid) = schedule.audio_file_id {
        ar::get_file(pool, fid).await.ok().flatten()
    } else { None };

    let folder = if let Some(fid) = schedule.folder_id {
        ar::get_folder(pool, fid).await.ok().flatten()
    } else { None };

    Some(crate::commands::schedule::NextSignal {
        schedule,
        audio_file,
        folder,
        seconds_until: secs,
    })
}
