import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/playerStore";

export function usePlayerNotification() {
  const status = usePlayerStore((s) => s.status);
  const currentFile = usePlayerStore((s) => s.current_file);
  const currentSchedule = usePlayerStore((s) => s.current_schedule);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const wasIdle = prevStatusRef.current === "idle";
    const isNowPlaying = status === "playing" || status === "fading_in";

    if (wasIdle && isNowPlaying && "Notification" in window && Notification.permission === "granted") {
      const scheduleName = currentSchedule?.name?.trim() || currentSchedule?.time;
      const body = [currentFile?.name, scheduleName].filter(Boolean).join(" • ");
      new Notification("▶ Sinal tocando", { body, silent: true });
    }

    prevStatusRef.current = status;
  }, [status, currentFile, currentSchedule]);
}
