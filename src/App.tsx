import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Schedules } from "@/pages/Schedules";
import { AudioLibrary } from "@/pages/AudioLibrary";
import { Holidays } from "@/pages/Holidays";
import { Logs } from "@/pages/Logs";
import { Settings } from "@/pages/Settings";
import { About } from "@/pages/About";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { settingsService } from "@/services/backupService";
import { playerService } from "@/services/playerService";
import { usePlayerStore } from "@/stores/playerStore";
import { useUiStore } from "@/stores/uiStore";

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

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    settingsService.get().then((s) => {
      setShowOnboarding(!s.setup_complete);
      setReady(true);
    }).catch(() => {
      setReady(true);
    });
  }, []);

  // Listen for audio device errors from Rust and show toast
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("audio-device-error", (event) => {
      toast.error(`Dispositivo de áudio: ${event.payload}`, { duration: 8000 });
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
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
