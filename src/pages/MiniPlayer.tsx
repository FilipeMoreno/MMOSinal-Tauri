import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Bell, BellOff, Square, Maximize2, GripHorizontal, X, SkipBack, SkipForward } from "lucide-react";
import type { PlayerState, NextSignal } from "@/types";
import { VolumeControl } from "@/components/shared/VolumeControl";

export function MiniPlayer() {
  const [player, setPlayer] = useState<PlayerState>({
    status: "idle",
    current_file: null,
    current_schedule: null,
    position_ms: 0,
    volume: 1,
  });
  const [nextSignal, setNextSignal] = useState<NextSignal | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Player state: event-driven + polling fallback so the view is always fresh
  // even when the window was hidden and re-shown without a React remount.
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const sync = () =>
      invoke<PlayerState>("get_player_state")
        .then(setPlayer)
        .catch(() => {});

    sync();

    listen<PlayerState>("player-state-changed", (e) => {
      setPlayer(e.payload);
    }).then((fn) => { unlisten = fn; });

    // Poll every second so we catch the playing state even if an event was
    // missed while the window was hidden.
    const pollId = setInterval(sync, 1000);

    return () => {
      unlisten?.();
      clearInterval(pollId);
    };
  }, []);

  // Next signal polling
  useEffect(() => {
    const fetchNext = () =>
      invoke<NextSignal | null>("get_next_signal")
        .then((s) => {
          setNextSignal(s);
          if (s) setCountdown(s.seconds_until);
        })
        .catch(() => {});

    fetchNext();
    const id = setInterval(fetchNext, 10_000);
    return () => clearInterval(id);
  }, []);

  // Countdown tick
  useEffect(() => {
    if (!nextSignal) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [nextSignal]);

  const restore = () => invoke("restore_main_window").catch(() => {});
  const close = () => invoke("hide_mini_window").catch(() => {});
  const stop = () => invoke("stop_player").catch(() => {});
  const skip = (dir: 1 | -1) => invoke("skip_track", { direction: dir }).catch(() => {});

  const isPlaying = player.status !== "idle";
  const isUrgent = !isPlaying && countdown > 0 && countdown <= 300;

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
    return `${sec}s`;
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const progressPct = player.current_file?.duration_ms
    ? Math.min(100, (player.position_ms / player.current_file.duration_ms) * 100)
    : 0;

  const statusLabel =
    player.status === "fading_in"
      ? "Iniciando"
      : player.status === "fading_out"
      ? "Encerrando"
      : "Tocando";

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col select-none overflow-hidden rounded-lg border border-slate-700/60 shadow-2xl">
      {/* Drag region */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700/80 rounded-t-lg flex-shrink-0"
      >
        <div data-tauri-drag-region className="flex items-center gap-1.5 text-slate-500">
          <GripHorizontal className="h-3 w-3 pointer-events-none" />
          <span className="text-[10px] font-semibold uppercase tracking-widest pointer-events-none">
            MMO Sinal
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={restore}
            title="Restaurar janela"
            className="h-5 w-5 rounded flex items-center justify-center hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            onClick={close}
            title="Fechar mini player"
            className="h-5 w-5 rounded flex items-center justify-center hover:bg-red-500/80 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-4 py-3 gap-2.5 min-h-0">
        {isPlaying ? (
          /* ── Player view ── */
          <>
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-semibold text-green-400 uppercase tracking-wider truncate">
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => skip(-1)}
                  title="Música anterior"
                  className="h-5 w-5 rounded flex items-center justify-center hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                >
                  <SkipBack className="h-3 w-3" />
                </button>
                <button
                  onClick={stop}
                  className="flex items-center gap-1 text-[11px] bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 hover:text-red-200 px-2 py-0.5 rounded transition-colors"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  Parar
                </button>
                <button
                  onClick={() => skip(1)}
                  title="Próxima música"
                  className="h-5 w-5 rounded flex items-center justify-center hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                >
                  <SkipForward className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {player.current_file?.name ?? "—"}
              </p>
              {player.current_schedule?.name?.trim() && (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {player.current_schedule.name}
                </p>
              )}
            </div>

            {player.current_file?.duration_ms ? (
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{formatMs(player.position_ms)}</span>
                  <span>{formatMs(player.current_file.duration_ms)}</span>
                </div>
                <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <VolumeControl volume={player.volume} dark className="self-start" />
          </>
        ) : nextSignal ? (
          /* ── Next signal view ── */
          <>
            <div className="flex items-center gap-1.5">
              <Bell
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  isUrgent ? "text-orange-400 animate-pulse" : "text-indigo-400"
                }`}
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Próximo Sinal
              </span>
              {isUrgent && (
                <span className="ml-auto text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded px-1.5 py-0.5">
                  Em breve!
                </span>
              )}
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <span
                  className={`text-2xl font-bold tabular-nums leading-none ${
                    isUrgent ? "text-orange-300" : "text-white"
                  }`}
                >
                  {nextSignal.schedule.time}
                </span>
                {nextSignal.schedule.name?.trim() && (
                  <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[160px]">
                    {nextSignal.schedule.name}
                  </p>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wider">
                  Faltam
                </p>
                <span
                  className={`text-base font-mono font-bold tabular-nums ${
                    isUrgent ? "text-orange-300" : "text-indigo-300"
                  }`}
                >
                  {formatCountdown(countdown)}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* ── No schedule ── */
          <div className="flex items-center gap-2 text-slate-500">
            <BellOff className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">Nenhum agendamento ativo</span>
          </div>
        )}
      </div>
    </div>
  );
}
