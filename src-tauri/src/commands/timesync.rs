use crate::error::{AppError, Result};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::net::UdpSocket;

/// Seconds between NTP epoch (1900-01-01) and Unix epoch (1970-01-01)
const NTP_EPOCH_OFFSET: u64 = 2_208_988_800;

#[derive(Debug, Serialize)]
pub struct TimeSyncResult {
    /// Difference between NTP time and local clock, in seconds.
    pub offset_s: i64,
    /// NTP time as a display string (UTC).
    pub ntp_time: String,
    /// True if the system clock was actually adjusted.
    pub applied: bool,
}

/// Query an NTP server and return the offset (ntp_time - local_time) in seconds.
async fn query_ntp(server: &str) -> std::result::Result<i64, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("bind: {e}"))?;

    socket
        .connect(format!("{server}:123"))
        .await
        .map_err(|e| format!("connect {server}:123: {e}"))?;

    // LI=0, VN=3, Mode=3 (client request)
    let mut packet = [0u8; 48];
    packet[0] = 0x1B;

    socket
        .send(&packet)
        .await
        .map_err(|e| format!("send: {e}"))?;

    let mut buf = [0u8; 48];
    tokio::time::timeout(std::time::Duration::from_secs(5), socket.recv(&mut buf))
        .await
        .map_err(|_| format!("timeout ao aguardar resposta de {server}"))?
        .map_err(|e| format!("recv: {e}"))?;

    // Transmit Timestamp: bytes 40–43 = whole seconds (big-endian, NTP epoch)
    let ntp_secs = u32::from_be_bytes([buf[40], buf[41], buf[42], buf[43]]) as u64;
    if ntp_secs == 0 {
        return Err(format!("{server} retornou timestamp vazio"));
    }

    let unix_secs = ntp_secs.saturating_sub(NTP_EPOCH_OFFSET) as i64;

    let local_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    Ok(unix_secs - local_secs)
}

/// Set the system clock to `unix_secs` (seconds since Unix epoch, UTC).
/// On Windows uses PowerShell Set-Date; requires the process to run as Administrator.
#[cfg(windows)]
fn apply_system_time(unix_secs: i64) -> std::result::Result<(), String> {
    use chrono::{DateTime, Utc};

    let dt: DateTime<Utc> = DateTime::from_timestamp(unix_secs, 0)
        .ok_or_else(|| "timestamp inválido".to_string())?;

    let date_str = dt.format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let output = std::process::Command::new("powershell")
        .args([
            "-NonInteractive",
            "-Command",
            &format!("Set-Date -Date '{date_str}' -ErrorAction Stop"),
        ])
        .output()
        .map_err(|e| format!("falha ao iniciar powershell: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Set-Date falhou (execute como Administrador): {stderr}"
        ));
    }

    Ok(())
}

#[cfg(not(windows))]
fn apply_system_time(_unix_secs: i64) -> std::result::Result<(), String> {
    Err("Sincronização de horário disponível apenas no Windows".to_string())
}

/// Tauri command: query `ntp_server`, compute offset, and apply if offset ≥ 2 s.
#[tauri::command]
pub async fn sync_time(ntp_server: String) -> Result<TimeSyncResult> {
    let server = if ntp_server.trim().is_empty() {
        "pool.ntp.org".to_string()
    } else {
        ntp_server.trim().to_string()
    };

    let offset = query_ntp(&server)
        .await
        .map_err(|e| AppError::Other(format!("Erro NTP ({server}): {e}")))?;

    let local_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let corrected = local_secs + offset;

    let ntp_time = chrono::DateTime::from_timestamp(corrected, 0)
        .map(|dt| dt.format("%d/%m/%Y %H:%M:%S UTC").to_string())
        .unwrap_or_else(|| "?".to_string());

    // Only adjust the clock if the offset is at least 2 seconds.
    let applied = if offset.abs() >= 2 {
        apply_system_time(corrected).map_err(AppError::Other)?;
        true
    } else {
        false
    };

    Ok(TimeSyncResult {
        offset_s: offset,
        ntp_time,
        applied,
    })
}
