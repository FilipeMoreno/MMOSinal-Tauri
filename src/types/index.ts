// ─── Audio ───────────────────────────────────────────────────────────────────

export interface AudioFolder {
  id: number;
  name: string;
  description: string | null;
  shuffle: boolean;
  created_at: string;
}

export interface AudioFile {
  id: number;
  folder_id: number;
  name: string;
  filename: string;
  file_path: string;
  duration_ms: number | null;
  sort_order: number;
  created_at: string;
}

export interface AudioPlaybackState {
  audio_file_id: number;
  position_ms: number;
  last_schedule_id: number | null;
  updated_at: string;
}

// ─── Schedules ───────────────────────────────────────────────────────────────

/** 1 = Segunda, 2 = Terça, ..., 7 = Domingo */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Schedule {
  id: number;
  name: string;
  time: string; // "HH:MM"
  days_of_week: DayOfWeek[];
  folder_id: number | null;
  audio_file_id: number | null;
  play_duration_s: number;
  fade_in_s: number;
  fade_out_s: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleFormData {
  name: string;
  time: string;
  days_of_week: DayOfWeek[];
  folder_id: number | null;
  audio_file_id: number | null;
  play_duration_s: number;
  fade_in_s: number;
  fade_out_s: number;
  is_active: boolean;
}

// ─── Panic Buttons ───────────────────────────────────────────────────────────

export type InterruptMode = "interrupt" | "queue_pause";

export interface PanicButton {
  id: number;
  name: string;
  audio_file_id: number;
  interrupt_mode: InterruptMode;
  color_hex: string;
  sort_order: number;
  created_at: string;
}

// ─── Holidays ────────────────────────────────────────────────────────────────

export interface Holiday {
  id: number;
  name: string;
  date: string; // "YYYY-MM-DD"
  is_recurring: boolean;
  created_at: string;
}

// ─── Change / Audit Logs ─────────────────────────────────────────────────────

export interface ChangeLog {
  id: number;
  action: string;       // 'created' | 'updated' | 'deleted' | 'moved' | 'imported' | 'saved'
  entity_type: string;  // 'schedule' | 'audio_file' | 'audio_folder' | 'holiday' | 'settings' | 'panic_button'
  entity_name: string | null;
  details: string | null;
  created_at: string;
}

// ─── Execution Logs ──────────────────────────────────────────────────────────

export type TriggerType = "scheduled" | "manual" | "panic";
export type LogStatus = "success" | "error" | "interrupted" | "skipped_holiday";

export interface ExecutionLog {
  id: number;
  schedule_id: number | null;
  audio_file_id: number | null;
  schedule_name: string | null;
  audio_name: string | null;
  trigger_type: TriggerType;
  status: LogStatus;
  triggered_at: string;
  played_duration_ms: number | null;
  position_start_ms: number | null;
  error_message: string | null;
}

// ─── Player State ─────────────────────────────────────────────────────────────

export type PlayerStatus = "idle" | "playing" | "paused" | "fading_in" | "fading_out";

export interface PlayerState {
  status: PlayerStatus;
  current_file: AudioFile | null;
  current_schedule: Schedule | null;
  position_ms: number;
  volume: number; // 0.0 - 1.0
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface NextSignal {
  schedule: Schedule;
  audio_file: AudioFile | null;
  folder: AudioFolder | null;
  seconds_until: number;
}

// ─── Seasonal Overrides ───────────────────────────────────────────────────────

export interface SeasonalOverride {
  id: number;
  name: string;
  replacement_folder_id: number;
  start_month: number; // 1–12
  start_day: number;   // 1–31
  end_month: number;
  end_day: number;
  is_active: boolean;
  created_at: string;
}

export interface SeasonalOverrideFormData {
  name: string;
  replacement_folder_id: number;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  is_active: boolean;
}

// ─── Backup ──────────────────────────────────────────────────────────────────

export interface BackupResult {
  success: boolean;
  backup_path: string;
  timestamp: string;
  error: string | null;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  backup_folder: string;
  backup_auto_enabled: boolean;
  backup_interval_hours: number;
  audio_storage_folder: string;
  start_minimized: boolean;
  start_with_os: boolean;
  ntp_server: string;
  ntp_auto_sync: boolean;
  default_volume: number; // 0.0 - 1.0
  setup_complete: boolean;
  kiosk_mode: boolean;
  kiosk_start: boolean;
}

export interface ImportResult {
  schedules_imported: number;
  holidays_imported: number;
  panic_buttons_imported: number;
}

export interface TimeSyncResult {
  offset_s: number;
  ntp_time: string;
  applied: boolean;
}
