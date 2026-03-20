import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { usePlayerStore } from "@/stores/playerStore";

export function usePlayerNotification() {
  const status = usePlayerStore((s) => s.status);
  const currentFile = usePlayerStore((s) => s.current_file);
  const currentSchedule = usePlayerStore((s) => s.current_schedule);
  const prevStatusRef = useRef(status);
  const permissionRef = useRef<boolean>(false);

  // Request permission once on mount
  useEffect(() => {
    (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      permissionRef.current = granted;
    })();
  }, []);

  useEffect(() => {
    const wasIdle = prevStatusRef.current === "idle";
    const isNowPlaying = status === "playing" || status === "fading_in";

    if (wasIdle && isNowPlaying && permissionRef.current) {
      const scheduleName = currentSchedule?.name?.trim() || currentSchedule?.time;
      const body = [currentFile?.name, scheduleName].filter(Boolean).join(" • ");
      sendNotification({ title: "▶ Sinal tocando", body, silent: true });
    }

    prevStatusRef.current = status;
  }, [status, currentFile, currentSchedule]);
}
