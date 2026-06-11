import { useEffect, useState } from "react";
import { MODES } from "../domain/game";
import { useGameStore } from "../store/useGameStore";

export function Timer({ onTimeout }: { onTimeout: () => void }) {
  const { game, mode, practice, isHost, connection } = useGameStore();
  const duration = MODES[mode].turnMs;
  const [left, setLeft] = useState(duration);

  useEffect(() => {
    setLeft(duration);
    if (!duration || game.winner || (!practice && connection !== "connected")) return;
    const end = performance.now() + duration;
    const id = window.setInterval(() => {
      const next = Math.max(0, end - performance.now());
      setLeft(next);
      if (next <= 0) {
        clearInterval(id);
        if (practice || isHost) onTimeout();
      }
    }, 20);
    return () => clearInterval(id);
  }, [duration, game.moveCount, game.winner, practice, isHost, connection, onTimeout]);

  if (!duration) return null;
  return <div className="timer" style={{ "--progress": `${Math.max(0, left / duration) * 360}deg` } as React.CSSProperties}>{(left / 1000).toFixed(1)}</div>;
}
