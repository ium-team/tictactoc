import { MODES } from "../domain/game";
import { useGameStore } from "../store/useGameStore";

export function Board2D({ onMove }: { onMove: (index: number) => void }) {
  const { game, role, practice, pending, connection } = useGameStore();
  const canPlay = !game.winner && !pending && (practice || connection === "connected") && game.turn === role;
  return (
    <div className="board-2d" aria-label="틱택토 게임 보드">
      {game.board.map((mark, index) => {
        const fading = MODES[game.mode].maxMarks > 0 && mark && game.history[mark][0] === index && game.history[mark].length === 3;
        return (
          <button
            aria-label={`${index + 1}번 칸`}
            className={`cell ${mark?.toLowerCase() ?? ""} ${game.winLine.includes(index) ? "win" : ""} ${fading ? "fading" : ""}`}
            disabled={Boolean(mark) || !canPlay}
            key={index}
            onClick={() => onMove(index)}
          >
            {mark === "X" ? "×" : mark === "O" ? "○" : ""}
          </button>
        );
      })}
    </div>
  );
}
