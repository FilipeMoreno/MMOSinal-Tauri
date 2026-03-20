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

  useEffect(() => {
    const wasIdle = prevStatusRef.current === "idle";
    const isNowPlaying = status === "playing" || status === "fading_in";

    if (wasIdle && isNowPlaying) {
      (async () => {
        try {
          let granted = await isPermissionGranted();
          if (!granted) {
            const result = await requestPermission();
            granted = result === "granted";
          }

          if (!granted) {
            console.warn("[Notification] Permissão negada pelo sistema");
            return;
          }

          const scheduleName = currentSchedule?.name?.trim() || currentSchedule?.time;
          const body = [currentFile?.name, scheduleName].filter(Boolean).join(" • ");
          await sendNotification({ title: "▶ Sinal tocando", body, silent: true });
        } catch (e) {
          console.error("[Notification] Erro ao enviar notificação:", e);
        }
      })();
    }

    prevStatusRef.current = status;
  }, [status, currentFile, currentSchedule]);
}
