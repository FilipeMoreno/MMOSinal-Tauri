use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tracing::info;

use crate::core::audio_state::{PlayerState, PlayerStatus, SharedPlayerState};
use crate::db::models::audio::AudioFile;
use crate::db::models::log::NewLog;
use crate::db::models::schedule::Schedule;
use crate::db::repos::{audio_repo, log_repo};
use crate::error::{AppError, Result};

/// Snapshot of an interrupted schedule play, used to resume after queue_pause panic.
#[derive(Clone)]
struct PausedPlay {
    file: AudioFile,
    schedule: Option<Schedule>,
    duration_s: u64,
    #[allow(dead_code)]
    fade_in_s: u64,
    #[allow(dead_code)]
    fade_out_s: u64,
}

/// Wraps `OutputStream` so `PlayerEngine` can be `Send + Sync`.
///
/// # Safety
/// `OutputStream` is `!Send` only because `cpal` holds a raw pointer used
/// exclusively on the audio thread. We never move the stream across threads
/// after construction, so this is safe in practice.
#[allow(dead_code)]
struct SendStream(OutputStream);
unsafe impl Send for SendStream {}
unsafe impl Sync for SendStream {}

/// The audio engine. Holds the rodio stream (must stay alive for audio to work).
pub struct PlayerEngine {
    _stream: SendStream,
    stream_handle: OutputStreamHandle,
    sink: Arc<Mutex<Option<Arc<Sink>>>>,
    pub state: SharedPlayerState,
    /// Set to true by stop()/play_panic() so the fade task knows it was interrupted.
    interrupted: Arc<AtomicBool>,
    /// Holds the paused play context when queue_pause mode interrupts a scheduled play.
    paused_play: Arc<Mutex<Option<PausedPlay>>>,
    /// (duration_s, fade_out_s) of the current play; used by seek().
    play_params: Arc<Mutex<Option<(u64, u64)>>>,
    /// Incremented on every play/stop/panic so old tasks know they are superseded.
    play_id: Arc<AtomicU64>,
}

impl PlayerEngine {
    pub fn new(state: SharedPlayerState) -> Result<Self> {
        let (_stream, stream_handle) = OutputStream::try_default()
            .map_err(|e| AppError::Audio(e.to_string()))?;

        Ok(Self {
            _stream: SendStream(_stream),
            stream_handle,
            sink: Arc::new(Mutex::new(None)),
            state,
            interrupted: Arc::new(AtomicBool::new(false)),
            paused_play: Arc::new(Mutex::new(None)),
            play_params: Arc::new(Mutex::new(None)),
            play_id: Arc::new(AtomicU64::new(0)),
        })
    }

    /// Play an audio file for `duration_s` seconds, starting from its saved position.
    /// If `folder_id` is provided and the file ends before `duration_s` elapses, the
    /// engine automatically chains to the next file in the folder using the remaining time.
    pub async fn play(
        &self,
        file: AudioFile,
        schedule: Option<Schedule>,
        folder_id: Option<i64>,
        duration_s: u64,
        fade_in_s: u64,
        fade_out_s: u64,
        volume: f32,
        pool: &SqlitePool,
        app: &AppHandle,
    ) -> Result<()> {
        let schedule_id = schedule.as_ref().map(|s| s.id);

        // Get saved position for resume feature.
        let saved_pos = audio_repo::get_playback_state(pool, file.id)
            .await?
            .map(|s| s.position_ms)
            .unwrap_or(0);

        let schedule_name = schedule.as_ref().map(|s| s.name.clone());

        // Claim a new play slot.
        let my_play_id = self.play_id.fetch_add(1, Ordering::SeqCst) + 1;

        self.stop_sink().await;
        self.interrupted.store(false, Ordering::SeqCst);
        *self.play_params.lock().await = Some((duration_s, fade_out_s));

        // Validate file exists before setting up state
        let file_path = file.file_path.clone();
        let path = Path::new(&file_path);
        if !path.exists() {
            let err_msg = format!("Arquivo não encontrado: {file_path}");
            self.log_execution(
                pool, schedule_id, file.id, schedule_name, file.name.clone(),
                "scheduled", "error", 0, saved_pos, Some(err_msg.clone()),
            ).await;
            return Err(AppError::Audio(err_msg));
        }

        let file_buf = BufReader::new(File::open(path)?);
        let source = Decoder::new(file_buf).map_err(|e| AppError::Audio(e.to_string()))?;

        let sink = Sink::try_new(&self.stream_handle).map_err(|e| AppError::Audio(e.to_string()))?;
        sink.set_volume(if fade_in_s > 0 { 0.0 } else { volume });
        sink.append(source);
        if saved_pos > 0 {
            let _ = sink.try_seek(Duration::from_millis(saved_pos as u64));
        }
        let sink = Arc::new(sink);
        *self.sink.lock().await = Some(sink.clone());

        // Update initial state
        {
            let mut st = self.state.lock().await;
            st.status = if fade_in_s > 0 { PlayerStatus::FadingIn } else { PlayerStatus::Playing };
            st.current_file = Some(file.clone());
            st.current_schedule = schedule.clone();
            st.position_ms = saved_pos;
            st.volume = if fade_in_s > 0 { 0.0 } else { volume };
        }
        self.emit_state(app).await;

        // Clones for the spawned task
        let sink_clone = sink.clone();
        let sink_ref = self.sink.clone();
        let stream_handle_clone = self.stream_handle.clone();
        let state_clone = self.state.clone();
        let pool_clone = pool.clone();
        let app_clone = app.clone();
        let interrupted_clone = self.interrupted.clone();
        let play_params_clone = self.play_params.clone();
        let play_id_clone = self.play_id.clone();
        let target_volume = volume;

        tokio::spawn(async move {
            let overall_start = std::time::Instant::now();
            let total_duration = Duration::from_secs(duration_s);
            let fade_out_start = if duration_s > fade_out_s {
                Duration::from_secs(duration_s - fade_out_s)
            } else {
                Duration::ZERO
            };

            // ── Fade In (first file only) ─────────────────────────────────────
            if fade_in_s > 0 {
                let steps = (fade_in_s * 20) as u32;
                for i in 0..=steps {
                    if sink_clone.is_paused() || sink_clone.empty() { break; }
                    let vol = (i as f32 / steps as f32) * target_volume;
                    sink_clone.set_volume(vol);
                    {
                        let mut st = state_clone.lock().await;
                        st.volume = vol;
                        st.position_ms = sink_clone.get_pos().as_millis() as i64;
                    }
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
            }
            sink_clone.set_volume(target_volume);
            {
                let mut st = state_clone.lock().await;
                st.status = PlayerStatus::Playing;
                st.volume = target_volume;
            }
            emit_state_fn(&state_clone, &app_clone).await;

            // ── Current-file tracking (changes on chain) ──────────────────────
            let mut current_file = file;
            let mut current_pos_start = saved_pos;
            let mut seg_start = overall_start;
            let mut tick: u32 = 0;

            // ── Main play loop ────────────────────────────────────────────────
            'play_loop: loop {
                let elapsed_total = overall_start.elapsed();

                // Schedule duration reached — stop
                if elapsed_total >= total_duration { break; }

                // Get the currently active sink (may have been replaced on chain)
                let cur_sink = match sink_ref.lock().await.clone() {
                    Some(s) => s,
                    None => break, // stop() was called
                };

                // File ended naturally before schedule duration
                if cur_sink.empty() {
                    // Mark this file as fully played so next_file_for_folder skips it
                    let _ = audio_repo::upsert_playback_state(
                        &pool_clone,
                        current_file.id,
                        current_file.duration_ms.unwrap_or(i64::MAX),
                        schedule_id,
                    ).await;

                    // Log this segment
                    let seg_ms = seg_start.elapsed().as_millis() as i64;
                    log_execution_fn(
                        &pool_clone, schedule_id, current_file.id,
                        schedule_name.clone(), current_file.name.clone(),
                        "scheduled", "success", seg_ms, current_pos_start, None,
                    ).await;

                    // Chain to next file if there is enough time remaining and a folder
                    let remaining_ms = total_duration
                        .saturating_sub(elapsed_total)
                        .as_millis() as u64;

                    if remaining_ms > 500 {
                        if let Some(fid) = folder_id {
                            if let Some(next_f) = audio_repo::next_file_for_folder(&pool_clone, fid).await {
                                let next_pos = audio_repo::get_playback_state(&pool_clone, next_f.id)
                                    .await.ok().flatten()
                                    .map(|s| s.position_ms)
                                    .unwrap_or(0);

                                if let Ok(f) = File::open(&next_f.file_path) {
                                    if let Ok(src) = Decoder::new(BufReader::new(f)) {
                                        if let Ok(new_sink) = Sink::try_new(&stream_handle_clone) {
                                            new_sink.set_volume(target_volume);
                                            new_sink.append(src);
                                            if next_pos > 0 {
                                                let _ = new_sink.try_seek(
                                                    Duration::from_millis(next_pos as u64)
                                                );
                                            }
                                            let new_sink = Arc::new(new_sink);
                                            *sink_ref.lock().await = Some(new_sink);

                                            {
                                                let mut st = state_clone.lock().await;
                                                st.current_file = Some(next_f.clone());
                                                st.position_ms = next_pos;
                                                st.status = PlayerStatus::Playing;
                                                st.volume = target_volume;
                                            }
                                            emit_state_fn(&state_clone, &app_clone).await;

                                            current_file = next_f;
                                            current_pos_start = next_pos;
                                            seg_start = std::time::Instant::now();
                                            continue 'play_loop;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // No chaining possible — end session
                    break 'play_loop;
                }

                // Update position
                {
                    let mut st = state_clone.lock().await;
                    st.position_ms = cur_sink.get_pos().as_millis() as i64;
                }

                // Fade out based on total elapsed time (applies at end of session)
                if elapsed_total >= fade_out_start && fade_out_s > 0 {
                    let fade_elapsed = elapsed_total - fade_out_start;
                    let vol = 1.0 - (fade_elapsed.as_secs_f32() / fade_out_s as f32).min(1.0);
                    cur_sink.set_volume(vol);
                    {
                        let mut st = state_clone.lock().await;
                        st.status = PlayerStatus::FadingOut;
                        st.volume = vol;
                    }
                }

                tick += 1;
                if tick % 5 == 0 {
                    emit_state_fn(&state_clone, &app_clone).await;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }

            // ── Cleanup ───────────────────────────────────────────────────────
            let final_position = state_clone.lock().await.position_ms;
            if let Some(s) = sink_ref.lock().await.take() { s.stop(); }
            let seg_ms = seg_start.elapsed().as_millis() as i64;

            if play_id_clone.load(Ordering::SeqCst) == my_play_id {
                let was_interrupted = interrupted_clone.load(Ordering::SeqCst);

                if !was_interrupted {
                    let _ = audio_repo::upsert_playback_state(
                        &pool_clone, current_file.id, final_position, schedule_id,
                    ).await;
                }

                let status = if was_interrupted { "interrupted" } else { "success" };
                log_execution_fn(
                    &pool_clone, schedule_id, current_file.id,
                    schedule_name, current_file.name.clone(),
                    "scheduled", status, seg_ms, current_pos_start, None,
                ).await;

                *play_params_clone.lock().await = None;
                {
                    let mut st = state_clone.lock().await;
                    *st = crate::core::audio_state::PlayerState::default();
                }
                emit_state_fn(&state_clone, &app_clone).await;
                info!("Playback finished: file_id={}, seg_ms={seg_ms}", current_file.id);
            }
        });

        Ok(())
    }

    /// Stop current playback immediately and save position.
    pub async fn stop(&self, pool: &SqlitePool, app: &AppHandle) {
        let (file_id, position_ms) = {
            let st = self.state.lock().await;
            (
                st.current_file.as_ref().map(|f| f.id),
                st.position_ms,
            )
        };

        self.play_id.fetch_add(1, Ordering::SeqCst);
        self.interrupted.store(true, Ordering::SeqCst);
        self.stop_sink().await;
        *self.play_params.lock().await = None;

        if let Some(fid) = file_id {
            let _ = audio_repo::upsert_playback_state(pool, fid, position_ms, None).await;
        }

        {
            let mut st = self.state.lock().await;
            *st = PlayerState::default();
        }
        self.emit_state(app).await;
    }

    /// Play a panic/manual sound (always starts from position 0).
    /// - "interrupt": stops current playback immediately.
    /// - "queue_pause": saves current position, pauses current play, resumes it after panic ends.
    pub async fn play_panic(
        &self,
        file: AudioFile,
        interrupt_mode: &str,
        pool: &SqlitePool,
        app: &AppHandle,
    ) -> Result<()> {
        if interrupt_mode == "interrupt" {
            self.play_id.fetch_add(1, Ordering::SeqCst);
            self.interrupted.store(true, Ordering::SeqCst);
            self.stop_sink().await;
            *self.paused_play.lock().await = None;
        } else {
            self.play_id.fetch_add(1, Ordering::SeqCst);
            // queue_pause: save current play context so we can resume after panic
            let snapshot = {
                let st = self.state.lock().await;
                st.current_file.as_ref().map(|f| PausedPlay {
                    file: f.clone(),
                    schedule: st.current_schedule.clone(),
                    // Duration/fade fields are unknown here; re-use schedule values if present
                    duration_s: st.current_schedule.as_ref()
                        .map(|s| s.play_duration_s as u64)
                        .unwrap_or(999_999),
                    fade_in_s: st.current_schedule.as_ref()
                        .map(|s| s.fade_in_s as u64)
                        .unwrap_or(0),
                    fade_out_s: st.current_schedule.as_ref()
                        .map(|s| s.fade_out_s as u64)
                        .unwrap_or(0),
                })
            };

            // Persist current position before stopping
            if let Some(ref snap) = snapshot {
                let pos = self.state.lock().await.position_ms;
                let sched_id = snap.schedule.as_ref().map(|s| s.id);
                let _ = audio_repo::upsert_playback_state(pool, snap.file.id, pos, sched_id).await;
            }

            self.interrupted.store(true, Ordering::SeqCst);
            self.stop_sink().await;
            *self.paused_play.lock().await = snapshot;
        }

        let file_path = file.file_path.clone();
        let file_id = file.id;
        let audio_name = file.name.clone();
        let pool_clone = pool.clone();
        let app_clone = app.clone();
        let state_clone = self.state.clone();
        let paused_play_clone = self.paused_play.clone();
        let interrupted_clone = self.interrupted.clone();
        let stream_handle_clone = self.stream_handle.clone();

        let path = Path::new(&file_path);
        if !path.exists() {
            return Err(AppError::Audio(format!("Arquivo não encontrado: {file_path}")));
        }

        let file_buf = BufReader::new(File::open(path)?);
        let source = Decoder::new(file_buf).map_err(|e| AppError::Audio(e.to_string()))?;

        let sink = Sink::try_new(&self.stream_handle)
            .map_err(|e| AppError::Audio(e.to_string()))?;
        sink.set_volume(1.0);
        sink.append(source);
        let sink = Arc::new(sink);

        {
            let mut s = self.sink.lock().await;
            *s = Some(sink.clone());
        }

        // Reset interrupted flag for the panic play itself
        self.interrupted.store(false, Ordering::SeqCst);

        {
            let mut st = self.state.lock().await;
            st.status = PlayerStatus::Playing;
            st.current_file = Some(file);
            st.current_schedule = None;
            st.position_ms = 0;
            st.volume = 1.0;
        }
        self.emit_state(app).await;

        let sink_slot = self.sink.clone();

        tokio::spawn(async move {
            let start = std::time::Instant::now();
            let mut tick: u32 = 0;
            loop {
                if sink.empty() { break; }
                {
                    let mut st = state_clone.lock().await;
                    st.position_ms = start.elapsed().as_millis() as i64;
                }
                tick += 1;
                if tick % 5 == 0 {
                    emit_state_fn(&state_clone, &app_clone).await;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }

            let duration_ms = start.elapsed().as_millis() as i64;
            log_execution_fn(
                &pool_clone, None, file_id, None, audio_name,
                "panic", "success", duration_ms, 0, None,
            ).await;

            // Resume paused play if one was saved (queue_pause mode)
            let pending = paused_play_clone.lock().await.take();
            if let Some(snap) = pending {
                // Re-read saved position from DB (was persisted before panic started)
                let saved_pos = audio_repo::get_playback_state(&pool_clone, snap.file.id)
                    .await
                    .ok()
                    .flatten()
                    .filter(|s| s.last_schedule_id == snap.schedule.as_ref().map(|s| s.id))
                    .map(|s| s.position_ms)
                    .unwrap_or(0);

                let resume_path = snap.file.file_path.clone();
                if let Ok(resume_file) = File::open(&resume_path) {
                    if let Ok(src) = Decoder::new(BufReader::new(resume_file)) {
                        let src = src.skip_duration(Duration::from_millis(saved_pos as u64));
                        if let Ok(resume_sink) = Sink::try_new(&stream_handle_clone) {
                            resume_sink.set_volume(1.0);
                            resume_sink.append(src);
                            let resume_sink = Arc::new(resume_sink);
                            {
                                let mut s = sink_slot.lock().await;
                                *s = Some(resume_sink.clone());
                            }
                            interrupted_clone.store(false, Ordering::SeqCst);
                            {
                                let mut st = state_clone.lock().await;
                                st.status = PlayerStatus::Playing;
                                st.current_file = Some(snap.file.clone());
                                st.current_schedule = snap.schedule.clone();
                                st.position_ms = saved_pos;
                                st.volume = 1.0;
                            }
                            emit_state_fn(&state_clone, &app_clone).await;

                            // Wait for resume to finish
                            let resume_start = std::time::Instant::now();
                            let max_ms = (snap.duration_s * 1000).saturating_sub(saved_pos as u64);
                            let mut resume_tick: u32 = 0;
                            loop {
                                if resume_sink.empty() { break; }
                                if resume_start.elapsed().as_millis() as u64 >= max_ms { break; }
                                {
                                    let mut st = state_clone.lock().await;
                                    st.position_ms = saved_pos + resume_start.elapsed().as_millis() as i64;
                                }
                                resume_tick += 1;
                                if resume_tick % 5 == 0 {
                                    emit_state_fn(&state_clone, &app_clone).await;
                                }
                                tokio::time::sleep(Duration::from_millis(100)).await;
                            }
                            resume_sink.stop();
                            let final_pos = saved_pos + resume_start.elapsed().as_millis() as i64;
                            let sched_id = snap.schedule.as_ref().map(|s| s.id);
                            let _ = audio_repo::upsert_playback_state(&pool_clone, snap.file.id, final_pos, sched_id).await;
                        }
                    }
                }
            }

            {
                let mut st = state_clone.lock().await;
                *st = PlayerState::default();
            }
            emit_state_fn(&state_clone, &app_clone).await;
        });

        Ok(())
    }

    /// Seek to `position_ms` using the codec's native seek — instantaneous, no restart.
    pub async fn seek(&self, position_ms: i64, pool: &SqlitePool, app: &AppHandle) -> Result<()> {
        let sink = self.sink.lock().await.clone();
        let sink = match sink {
            Some(s) => s,
            None => return Ok(()), // nothing playing, ignore
        };

        sink.try_seek(Duration::from_millis(position_ms as u64))
            .map_err(|e| AppError::Audio(format!("Seek falhou: {e}")))?;

        // Update displayed position immediately so the UI reflects the new position.
        let schedule_id = {
            let mut st = self.state.lock().await;
            st.position_ms = position_ms;
            st.current_schedule.as_ref().map(|s| s.id)
        };
        self.emit_state(app).await;

        // Persist so resume picks up the right position.
        if let Some(file_id) = self.state.lock().await.current_file.as_ref().map(|f| f.id) {
            let _ = audio_repo::upsert_playback_state(pool, file_id, position_ms, schedule_id).await;
        }

        Ok(())
    }

    async fn stop_sink(&self) {
        let mut s = self.sink.lock().await;
        if let Some(sink) = s.take() {
            sink.stop();
        }
    }

    pub async fn emit_state(&self, app: &AppHandle) {
        let st = self.state.lock().await.clone();
        let _ = app.emit("player-state-changed", st);
    }

    #[allow(clippy::too_many_arguments)]
    async fn log_execution(
        &self,
        pool: &SqlitePool,
        schedule_id: Option<i64>,
        audio_file_id: i64,
        schedule_name: Option<String>,
        audio_name: String,
        trigger_type: &str,
        status: &str,
        played_duration_ms: i64,
        position_start_ms: i64,
        error_message: Option<String>,
    ) {
        let log = NewLog {
            schedule_id,
            audio_file_id: Some(audio_file_id),
            schedule_name,
            audio_name: Some(audio_name),
            trigger_type: trigger_type.to_string(),
            status: status.to_string(),
            played_duration_ms: Some(played_duration_ms),
            position_start_ms: Some(position_start_ms),
            error_message,
        };
        let _ = log_repo::insert(pool, &log).await;
    }
}

async fn emit_state_fn(state: &SharedPlayerState, app: &AppHandle) {
    let st = state.lock().await.clone();
    let _ = app.emit("player-state-changed", st);
}

#[allow(clippy::too_many_arguments)]
async fn log_execution_fn(
    pool: &SqlitePool,
    schedule_id: Option<i64>,
    audio_file_id: i64,
    schedule_name: Option<String>,
    audio_name: String,
    trigger_type: &str,
    status: &str,
    played_duration_ms: i64,
    position_start_ms: i64,
    error_message: Option<String>,
) {
    let log = NewLog {
        schedule_id,
        audio_file_id: Some(audio_file_id),
        schedule_name,
        audio_name: Some(audio_name),
        trigger_type: trigger_type.to_string(),
        status: status.to_string(),
        played_duration_ms: Some(played_duration_ms),
        position_start_ms: Some(position_start_ms),
        error_message,
    };
    let _ = log_repo::insert(pool, &log).await;
}
