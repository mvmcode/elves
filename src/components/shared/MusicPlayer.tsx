/* MusicPlayer — compact neo-brutalist music controls for the workshop.
 * Play/pause/stop buttons with a volume slider. Floats in the workshop overlay. */

import { useState, useCallback } from "react";
import {
  playMusic,
  pauseMusic,
  stopMusic,
  setMusicVolume,
  getMusicVolume,
  type MusicPlayState,
} from "@/lib/music";

/**
 * Compact music player control bar with play/pause, stop, and volume slider.
 * Uses neo-brutalist styling to match the workshop aesthetic.
 */
export function MusicPlayer(): React.JSX.Element {
  const [playState, setPlayState] = useState<MusicPlayState>("stopped");
  const [volume, setVolume] = useState(getMusicVolume);

  const handlePlayPause = useCallback((): void => {
    if (playState === "playing") {
      pauseMusic();
      setPlayState("paused");
    } else {
      playMusic();
      setPlayState("playing");
    }
  }, [playState]);

  const handleStop = useCallback((): void => {
    stopMusic();
    setPlayState("stopped");
  }, []);

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    setMusicVolume(newVolume);
  }, []);

  return (
    <div
      className="flex items-center gap-1.5 border-[2px] border-border bg-surface-elevated px-2 py-1 shadow-brutal-sm"
      data-testid="music-player"
    >
      {/* Play/Pause button */}
      <button
        onClick={handlePlayPause}
        className="flex h-6 w-6 cursor-pointer items-center justify-center border-[2px] border-border bg-accent text-[10px] font-bold text-border shadow-[2px_2px_0px_0px_#000] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        title={playState === "playing" ? "Pause" : "Play"}
        data-testid="music-play-pause"
      >
        {playState === "playing" ? "\u23F8" : "\u25B6"}
      </button>

      {/* Stop button */}
      <button
        onClick={handleStop}
        disabled={playState === "stopped"}
        className={[
          "flex h-6 w-6 cursor-pointer items-center justify-center border-[2px] border-border text-[10px] font-bold shadow-[2px_2px_0px_0px_#000] transition-all duration-100",
          playState === "stopped"
            ? "bg-gray-200 text-gray-400"
            : "bg-error/80 text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
        ].join(" ")}
        title="Stop"
        data-testid="music-stop"
      >
        {"\u25A0"}
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={volume}
        onChange={handleVolumeChange}
        className="h-1 w-16 cursor-pointer accent-accent"
        title={`Volume: ${Math.round(volume * 100)}%`}
        data-testid="music-volume"
      />

      {/* Label */}
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-text-muted-light">
        {playState === "playing" ? "♪" : playState === "paused" ? "||" : ""}
      </span>
    </div>
  );
}
