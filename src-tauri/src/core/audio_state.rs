use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::db::models::audio::AudioFile;
use crate::db::models::schedule::Schedule;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlayerStatus {
    Idle,
    Playing,
    Paused,
    FadingIn,
    FadingOut,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub status: PlayerStatus,
    pub current_file: Option<AudioFile>,
    pub current_schedule: Option<Schedule>,
    pub position_ms: i64,
    pub volume: f32,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            status: PlayerStatus::Idle,
            current_file: None,
            current_schedule: None,
            position_ms: 0,
            volume: 1.0,
        }
    }
}

pub type SharedPlayerState = Arc<Mutex<PlayerState>>;

pub fn new_shared_state() -> SharedPlayerState {
    Arc::new(Mutex::new(PlayerState::default()))
}
