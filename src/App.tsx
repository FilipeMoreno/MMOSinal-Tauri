import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
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

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    settingsService.get().then((s) => {
      setShowOnboarding(!s.setup_complete);
      setReady(true);
    }).catch(() => {
      // If settings can't be loaded, skip onboarding
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
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
