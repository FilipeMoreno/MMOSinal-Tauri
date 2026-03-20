import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Schedules } from "@/pages/Schedules";
import { AudioLibrary } from "@/pages/AudioLibrary";
import { Holidays } from "@/pages/Holidays";
import { Logs } from "@/pages/Logs";
import { Settings } from "@/pages/Settings";
import { About } from "@/pages/About";
import { MiniPlayer } from "@/pages/MiniPlayer";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { settingsService } from "@/services/backupService";
import { playerService } from "@/services/playerService";
import { useUpdater } from "@/hooks/useUpdater";
import { usePlayerStore } from "@/stores/playerStore";
import { useUiStore } from "@/stores/uiStore";

// Synchronous — getCurrentWindow() reads from Tauri internals without async
const WINDOW_LABEL = getCurrentWindow().label;

/** Global keyboard shortcuts — must be inside BrowserRouter to use useNavigate */
function GlobalShortcuts() {
  const navigate = useNavigate();
  const playerStatus = usePlayerStore((s) => s.status);
  const triggerManualSignal = useUiStore((s) => s.triggerManualSignal);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select"
        || (e.target as HTMLElement)?.isContentEditable;

      // Space → stop player
      if (e.key === " " && !isInput) {
        if (playerStatus !== "idle") {
          e.preventDefault();
          playerService.stop().catch(() => {});
        }
        return;
      }

      // Ctrl+M → open manual signal picker
      if (e.ctrlKey && e.key === "m") {
        e.preventDefault();
        navigate("/");
        triggerManualSignal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerStatus, navigate, triggerManualSignal]);

  return null;
}

/** Full main application — only rendered in the "main" window */
function MainApp() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [miniPlayerEnabled, setMiniPlayerEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  const { checkForUpdates, checkAndAutoInstall, dialog: updateDialog } = useUpdater();

  useEffect(() => {
    settingsService.get().then((s) => {
      setShowOnboarding(!s.setup_complete);
      setMiniPlayerEnabled(s.mini_player_enabled);
      setReady(true);
      if (s.auto_update) {
        checkAndAutoInstall();
      } else {
        checkForUpdates(true);
      }
    }).catch(() => {
      setReady(true);
      checkForUpdates(true);
    });
  }, []);

  // Re-apply mini_player_enabled whenever Settings saves
  useEffect(() => {
    const handler = (e: Event) => {
      const s = (e as CustomEvent).detail;
      if (typeof s?.mini_player_enabled === "boolean") {
        setMiniPlayerEnabled(s.mini_player_enabled);
        // If disabled, ensure the mini window is hidden immediately
        if (!s.mini_player_enabled) {
          invoke("hide_mini_window").catch(() => {});
        }
      }
    };
    window.addEventListener("app:settings-saved", handler);
    return () => window.removeEventListener("app:settings-saved", handler);
  }, []);

  // Listen for audio device errors from Rust and show toast
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("audio-device-error", (event) => {
      toast.error(`Dispositivo de áudio: ${event.payload}`, { duration: 8000 });
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Keep a ref so async callbacks can read the latest value without stale closure.
  const miniPlayerEnabledRef = useRef(miniPlayerEnabled);
  useEffect(() => { miniPlayerEnabledRef.current = miniPlayerEnabled; }, [miniPlayerEnabled]);

  // Show mini player when main window is minimized; hide when it regains focus.
  // Only active when the feature is enabled in Settings.
  useEffect(() => {
    if (!miniPlayerEnabled) return;

    const win = getCurrentWindow();
    let unlistenBlur: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    win.listen("tauri://blur", () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(async () => {
        blurTimer = null;
        if (!miniPlayerEnabledRef.current) return;
        if (await win.isMinimized()) {
          invoke("show_mini_window").catch(() => {});
        }
      }, 150);
    }).then((fn) => { unlistenBlur = fn; });

    win.listen("tauri://focus", () => {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
      invoke("hide_mini_window").catch(() => {});
    }).then((fn) => { unlistenFocus = fn; });

    return () => {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
      unlistenBlur?.();
      unlistenFocus?.();
    };
  }, [miniPlayerEnabled]);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      {updateDialog}
      <GlobalShortcuts />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/audio" element={<AudioLibrary />} />
          <Route path="/holidays" element={<Holidays />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

/** Root entry point — routes to MiniPlayer or MainApp based on window label */
export default function App() {
  if (WINDOW_LABEL === "mini") return <MiniPlayer />;
  return <MainApp />;
}
