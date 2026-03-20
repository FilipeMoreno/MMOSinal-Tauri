import { invoke } from "@tauri-apps/api/core";
import type { PlayerState } from "@/types";

export const playerService = {
  async getState(): Promise<PlayerState> {
    return invoke<PlayerState>("get_player_state");
  },

  async playManual(audioFileId: number): Promise<void> {
    return invoke<void>("play_manual", { audioFileId });
  },

  async seekPlayer(positionMs: number): Promise<void> {
    return invoke<void>("seek_player", { positionMs: Math.round(positionMs) });
  },

  async stop(): Promise<void> {
    return invoke<void>("stop_player");
  },

  async setVolume(volume: number): Promise<void> {
    return invoke<void>("set_volume", { volume });
  },

  async saveDefaultVolume(volume: number): Promise<void> {
    return invoke<void>("save_default_volume", { volume });
  },

  async pause(): Promise<void> {
    return invoke<void>("pause_player");
  },

  /** direction: +1 = próxima, -1 = anterior */
  async skipTrack(direction: 1 | -1): Promise<void> {
    return invoke<void>("skip_track", { direction });
  },
};
