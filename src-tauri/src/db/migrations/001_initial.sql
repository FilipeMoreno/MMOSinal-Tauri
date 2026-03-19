-- ───────────────────────────────────────────────────────────────────────────
-- MMO Sinal — Schema Inicial
-- ───────────────────────────────────────────────────────────────────────────

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Pastas/Categorias de Áudio ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audio_folders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ── Arquivos de Áudio ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audio_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id   INTEGER NOT NULL REFERENCES audio_folders(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    filename    TEXT    NOT NULL,
    file_path   TEXT    NOT NULL UNIQUE,
    duration_ms INTEGER,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ── Agendamentos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    time            TEXT    NOT NULL,       -- "HH:MM"
    days_of_week    TEXT    NOT NULL,       -- JSON: [1,2,3,4,5]
    folder_id       INTEGER REFERENCES audio_folders(id) ON DELETE SET NULL,
    audio_file_id   INTEGER REFERENCES audio_files(id)   ON DELETE SET NULL,
    play_duration_s INTEGER NOT NULL DEFAULT 30,
    fade_in_s       INTEGER NOT NULL DEFAULT 2,
    fade_out_s      INTEGER NOT NULL DEFAULT 2,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ── Estado de Playback Persistido (feature resume) ───────────────────────────
CREATE TABLE IF NOT EXISTS audio_playback_state (
    audio_file_id    INTEGER PRIMARY KEY REFERENCES audio_files(id) ON DELETE CASCADE,
    position_ms      INTEGER NOT NULL DEFAULT 0,
    last_schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ── Botões de Pânico / Acionamento Manual ────────────────────────────────────
CREATE TABLE IF NOT EXISTS panic_buttons (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    audio_file_id   INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    interrupt_mode  TEXT    NOT NULL DEFAULT 'interrupt'
                        CHECK(interrupt_mode IN ('interrupt', 'queue_pause')),
    color_hex       TEXT    NOT NULL DEFAULT '#ef4444',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ── Feriados / Exceções ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    date         TEXT    NOT NULL,       -- "YYYY-MM-DD"
    is_recurring INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE(date, is_recurring)
);

-- ── Log de Execução ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS execution_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id         INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    audio_file_id       INTEGER REFERENCES audio_files(id) ON DELETE SET NULL,
    schedule_name       TEXT,
    audio_name          TEXT,
    trigger_type        TEXT    NOT NULL
                            CHECK(trigger_type IN ('scheduled', 'manual', 'panic')),
    status              TEXT    NOT NULL
                            CHECK(status IN ('success', 'error', 'interrupted', 'skipped_holiday')),
    triggered_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    played_duration_ms  INTEGER,
    position_start_ms   INTEGER,
    error_message       TEXT
);

-- ── Configurações da Aplicação ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Valores padrão das configurações
INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('backup_folder', ''),
    ('backup_auto_enabled', 'false'),
    ('backup_interval_hours', '24'),
    ('audio_storage_folder', ''),
    ('start_minimized', 'false'),
    ('start_with_os', 'false'),
    ('ntp_server', 'a.ntp.br'),
    ('ntp_auto_sync', 'false');

-- ── Log de Alterações (auditoria de CRUD) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS change_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,          -- 'created', 'updated', 'deleted', 'moved', 'imported', 'saved'
    entity_type TEXT NOT NULL,          -- 'schedule', 'audio_file', 'audio_folder', 'holiday', 'settings', 'panic_button'
    entity_name TEXT,
    details     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ── Adição de coluna shuffle (segura para bancos existentes) ─────────────────
ALTER TABLE audio_folders ADD COLUMN shuffle INTEGER NOT NULL DEFAULT 0;

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schedules_active  ON schedules(is_active, time);
CREATE INDEX IF NOT EXISTS idx_logs_triggered_at ON execution_logs(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_holidays_date     ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_audio_files_folder ON audio_files(folder_id, sort_order);
