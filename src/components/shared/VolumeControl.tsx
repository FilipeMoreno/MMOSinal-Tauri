import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { cn } from "@/lib/utils";
import { playerService } from "@/services/playerService";

export const VOLUME_CHANGED_EVENT = "app:default-volume-changed";

interface VolumeControlProps {
  volume: number;       // 0–1, from player state
  dark?: boolean;       // true = white text (for gradient cards)
  className?: string;
}

export function VolumeControl({ volume, dark = false, className }: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(volume);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync slider when external volume changes (e.g. fade effects), but only when not dragging
  useEffect(() => { setLocal(volume); }, [volume]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleChange = (val: number) => {
    setLocal(val);
    // Live audio update
    playerService.setVolume(val).catch(() => {});
    // Debounced persist + notify Settings page
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      playerService.saveDefaultVolume(val).catch(() => {});
      window.dispatchEvent(new CustomEvent(VOLUME_CHANGED_EVENT, { detail: val }));
    }, 600);
  };

  const pct = Math.round(local * 100);
  const Icon = local === 0 ? VolumeX : local < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Controle de volume"
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors select-none",
          dark
            ? "bg-black/10 text-white/90 hover:bg-black/20 border border-white/10"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200",
        )}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="tabular-nums w-7 text-right">{pct}%</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50",
            "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl shadow-xl border",
            dark
              ? "bg-slate-800/95 border-slate-600/60 backdrop-blur-md"
              : "bg-white border-slate-200",
          )}
          style={{ width: 36 }}
        >
          {/* Percentage label */}
          <span className={cn("text-[10px] font-mono tabular-nums font-semibold", dark ? "text-white/70" : "text-slate-500")}>
            {pct}
          </span>

          {/* Vertical slider */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={local}
            onChange={(e) => handleChange(parseFloat(e.target.value))}
            className="volume-slider-vertical"
            style={{
              writingMode: "vertical-lr" as never,
              direction: "rtl" as never,
              width: 6,
              height: 80,
              cursor: "pointer",
              appearance: "slider-vertical" as never,
              WebkitAppearance: "slider-vertical" as never,
              accentColor: dark ? "#67e8f9" : "#2563eb",
            }}
          />

          {/* Mute toggle */}
          <button
            onClick={() => handleChange(local > 0 ? 0 : 1)}
            title={local > 0 ? "Mudo" : "Desmutar"}
            className={cn(
              "h-5 w-5 flex items-center justify-center rounded transition-colors",
              dark ? "text-white/40 hover:text-white/80" : "text-slate-400 hover:text-slate-700",
            )}
          >
            {local === 0
              ? <Volume2 className="h-3 w-3" />
              : <VolumeX className="h-3 w-3" />
            }
          </button>
        </div>
      )}
    </div>
  );
}
