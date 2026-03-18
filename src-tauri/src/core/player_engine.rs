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
    /// Applies fade-in and fade-out.
    pub async fn play(
        &self,
        file: AudioFile,
        schedule: Option<Schedule>,
        duration_s: u64,
        fade_in_s: u64,
        fade_out_s: u64,
        pool: &SqlitePool,
        app: &AppHandle,
    ) -> Result<()> {
        let file_path = file.file_path.clone();
        let file_id = file.id;
        let schedule_id = schedule.as_ref().map(|s| s.id);

        // Get saved position for resume feature.
        // Resume from the last known position regardless of which schedule (or manual play)
        // last touched this file — this is what enables sequential folder playback to advance
        // continuously across multiple schedule triggers.
        let saved_pos = audio_repo::get_playback_state(pool, file.id)
            .await?
            .map(|s| s.position_ms)
            .unwrap_or(0);

        let position_start_ms = saved_pos;
        let schedule_name = schedule.as_ref().map(|s| s.name.clone());
        let audio_name = file.name.clone();

        // Claim a new play slot — any previously running task will see its id is stale
        // and skip the final state-reset, preventing it from stomping our new play.
        let my_play_id = self.play_id.fetch_add(1, Ordering::SeqCst) + 1;

        // Stop any currently playing audio and reset the interrupted flag for this new play.
        self.stop_sink().await;
        self.interrupted.store(false, Ordering::SeqCst);

        // Store params for seek() to reuse.
        *self.play_params.lock().await = Some((duration_s, fade_out_s));

        // Update initial state: FadingIn only if there is a fade-in, otherwise Playing.
        {
            let mut st = self.state.lock().await;
            st.status = if fade_in_s > 0 { PlayerStatus::FadingIn } else { PlayerStatus::Playing };
            st.current_file = Some(file.clone());
            st.current_schedule = schedule.clone();
            st.position_ms = saved_pos;
            st.volume = if fade_in_s > 0 { 0.0 } else { 1.0 };
        }
        self.emit_state(app).await;

        // Open audio file and seek to saved position
        let path = Path::new(&file_path);
        if !path.exists() {
            let err_msg = format!("Arquivo não encontrado: {file_path}");
            self.log_execution(
                pool, schedule_id, file_id, schedule_name, audio_name,
                "scheduled", "error", 0, position_start_ms, Some(err_msg.clone()),
            ).await;
            return Err(AppError::Audio(err_msg));
        }

        let file_buf = BufReader::new(File::open(path)?);
        let source = Decoder::new(file_buf)
            .map_err(|e| AppError::Audio(e.to_string()))?;

        // Create new sink
        let sink = Sink::try_new(&self.stream_handle)
            .map_err(|e| AppError::Audio(e.to_string()))?;
        sink.set_volume(if fade_in_s > 0 { 0.0 } else { 1.0 });
        sink.append(source);

        // Seek to resume position using codec-native seek (instantaneous, no frame decode).
        if saved_pos > 0 {
            let _ = sink.try_seek(Duration::from_millis(saved_pos as u64));
        }

        let sink = Arc::new(sink);
        {
            let mut s = self.sink.lock().await;
            *s = Some(sink.clone());
        }

        // Clone handles for the async fade task
        let sink_clone = sink.clone();
        let state_clone = self.state.clone();
        let pool_clone = pool.clone();
        let app_clone = app.clone();
        let interrupted_clone = self.interrupted.clone();
        let play_params_clone = self.play_params.clone();
        let play_id_clone = self.play_id.clone();

        // Spawn the fade-in → play → fade-out → stop task
        tokio::spawn(async move {
            let start_time = std::time::Instant::now();

            // ── Fade In ───────────────────────────────────────────────────────
            if fade_in_s > 0 {
                let steps = (fade_in_s * 20) as u32; // 20 steps per second
                for i in 0..=steps {
                    if sink_clone.is_paused() || sink_clone.empty() { break; }
                    let vol = i as f32 / steps as f32;
                    sink_clone.set_volume(vol);
                    {
                        let mut st = state_clone.lock().await;
                        st.volume = vol;
                        st.position_ms = sink_clone.get_pos().as_millis() as i64;
                    }
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
            }

            sink_clone.set_volume(1.0);

            // ── Playing ───────────────────────────────────────────────────────
            {
                let mut st = state_clone.lock().await;
                st.status = PlayerStatus::Playing;
                st.volume = 1.0;
            }
            emit_state_fn(&state_clone, &app_clone).await;

            let play_duration = Duration::from_secs(duration_s);
            let fade_out_start = if duration_s > fade_out_s {
                Duration::from_secs(duration_s - fade_out_s)
            } else {
                Duration::ZERO
            };

            let mut tick: u32 = 0;
            loop {
                let elapsed = start_time.elapsed();

                if sink_clone.empty() { break; } // natural end of file

                if elapsed >= play_duration { break; }

                // Update position using get_pos() — accurate after try_seek too.
                {
                    let mut st = state_clone.lock().await;
                    st.position_ms = sink_clone.get_pos().as_millis() as i64;
                }

                // Begin fade out
                if elapsed >= fade_out_start && fade_out_s > 0 {
                    let fade_elapsed = elapsed - fade_out_start;
                    let vol = 1.0 - (fade_elapsed.as_secs_f32() / fade_out_s as f32).min(1.0);
                    sink_clone.set_volume(vol);
                    {
                        let mut st = state_clone.lock().await;
                        st.status = PlayerStatus::FadingOut;
                        st.volume = vol;
                    }
                }

                // Emit position update to frontend every ~500 ms
                tick += 1;
                if tick % 5 == 0 {
                    emit_state_fn(&state_clone, &app_clone).await;
                }

                tokio::time::sleep(Duration::from_millis(100)).await;
            }

            // ── Cleanup ───────────────────────────────────────────────────────
            // Read final position before stopping (get_pos() may be unreliable after stop).
            let final_position = state_clone.lock().await.position_ms;
            sink_clone.stop();
            let actual_duration_ms = start_time.elapsed().as_millis() as i64;

            // Only do state-reset work if we are still the active play.
            // If play_id changed, a newer play/stop/seek already owns the state.
            if play_id_clone.load(Ordering::SeqCst) == my_play_id {
                let was_interrupted = interrupted_clone.load(Ordering::SeqCst);

                if !was_interrupted {
                    let _ = audio_repo::upsert_playback_state(
                        &pool_clone, file_id, final_position, schedule_id,
                    ).await;
                }

                let status = if was_interrupted { "interrupted" } else { "success" };
                log_execution_fn(
                    &pool_clone, schedule_id, file_id,
                    schedule_name, audio_name,
                    "scheduled", status,
                    actual_duration_ms, position_start_ms, None,
                ).await;

                *play_params_clone.lock().await = None;
                {
                    let mut st = state_clone.lock().await;
                    *st = crate::core::audio_state::PlayerState::default();
                }
                emit_state_fn(&state_clone, &app_clone).await;

                info!("Playback finished: file_id={file_id}, duration={actual_duration_ms}ms");
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
