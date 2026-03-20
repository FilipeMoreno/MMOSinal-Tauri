use serde::{Deserialize, Serialize};

fn default_ntp_server() -> String {
    "a.ntp.br".to_string()
}

fn default_true() -> bool {
    true
}

fn default_volume() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub backup_folder: String,
    #[serde(default)]
    pub backup_auto_enabled: bool,
    #[serde(default = "default_backup_interval")]
    pub backup_interval_hours: u32,
    #[serde(default)]
    pub audio_storage_folder: String,
    #[serde(default)]
    pub start_minimized: bool,
    #[serde(default)]
    pub start_with_os: bool,
    #[serde(default = "default_ntp_server")]
    pub ntp_server: String,
    #[serde(default = "default_true")]
    pub ntp_auto_sync: bool,
    #[serde(default = "default_volume")]
    pub default_volume: f32,
    #[serde(default)]
    pub setup_complete: bool,
    /// Trava a janela em tela cheia sem permitir fechar (modo quiosque)
    #[serde(default)]
    pub kiosk_mode: bool,
    /// Ao iniciar, aplica automaticamente o modo quiosque
    #[serde(default)]
    pub kiosk_start: bool,
    /// Exibe mini player flutuante ao minimizar a janela principal
    #[serde(default = "default_true")]
    pub mini_player_enabled: bool,
    /// Instala atualizações automaticamente ao iniciar o app, sem exibir dialog
    #[serde(default)]
    pub auto_update: bool,
}

fn default_backup_interval() -> u32 { 24 }

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            backup_folder: String::new(),
            backup_auto_enabled: false,
            backup_interval_hours: 24,
            audio_storage_folder: String::new(),
            start_minimized: false,
            start_with_os: false,
            ntp_server: default_ntp_server(),
            ntp_auto_sync: true,
            default_volume: 1.0,
            setup_complete: false,
            kiosk_mode: false,
            kiosk_start: false,
            mini_player_enabled: true,
            auto_update: false,
        }
    }
}
