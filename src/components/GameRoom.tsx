import { lazy, Suspense } from "react";
import { MODES } from "../domain/game";
import { useGameStore } from "../store/useGameStore";
import { Board2D } from "./Board2D";
import { Timer } from "./Timer";

const Board3D = lazy(() => import("./Board3D").then((module) => ({ default: module.Board3D })));

const connectionText = { offline: "오프라인 연습", waiting: "친구를 기다리는 중", connected: "친구 연결됨 · 게임 준비 완료", reconnecting: "연결 복구 중", spectating: "방이 가득 차 관전 중" };

export function GameRoom({ onLeave, onMove, onRestart, onTimeout }: { onLeave: () => void; onMove: (index: number) => void; onRestart: () => void; onTimeout: () => void }) {
  const state = useGameStore();
  const mode = MODES[state.mode];
  const connected = state.practice || state.connection === "connected";
  const status = state.connection === "spectating" ? "관전 중입니다" : !connected ? "친구를 기다리고 있습니다" : state.game.winner === "draw" ? "무승부입니다" : state.game.winner ? (state.game.winner === state.role ? "승리했습니다" : "상대가 승리했습니다") : state.game.turn === state.role ? "당신의 차례입니다" : "상대의 차례입니다";
  const copy = async () => navigator.clipboard.writeText(location.href);
  return (
    <main className="room">
      <aside>
        <button className="back" onClick={onLeave}>← 로비</button>
        <p className="eyebrow">{mode.short}</p><h2>{mode.name}</h2><p className="description">{mode.description}</p>
        <div className="players">
          <div className={state.game.turn === "X" && !state.game.winner ? "active" : ""}><strong><i>×</i>{state.role === "X" ? "나" : "친구"}</strong><span>{state.game.turn === "X" && !state.game.winner ? "차례" : ""}</span></div>
          <div className={state.game.turn === "O" && !state.game.winner ? "active" : ""}><strong><i>○</i>{state.role === "O" ? "나" : state.practice ? "컴퓨터" : "친구"}</strong><span>{state.game.turn === "O" && !state.game.winner ? "차례" : ""}</span></div>
        </div>
        <div className="invite"><small>친구 초대 링크</small><button disabled={state.practice} onClick={copy}><strong>{state.roomCode || "PRACTICE"}</strong><b>복사</b></button><span>{connectionText[state.connection]}</span></div>
        <button className="restart" disabled={state.connection === "spectating" || (!state.practice && !state.isHost && !state.game.winner)} onClick={onRestart}>새 판 시작</button>
      </aside>
      <section className="stage">
        <header><div><small>ROUND {String(state.round).padStart(2, "0")}</small><strong>{status}</strong></div><Timer onTimeout={onTimeout} /></header>
        {state.mode === "cube"
          ? <Suspense fallback={<div className="board-loading">3D 큐브를 준비하는 중...</div>}><Board3D onMove={onMove} /></Suspense>
          : <Board2D onMove={onMove} />}
        <p className="hint">{state.mode === "cube" ? "드래그로 돌리고 큐브를 눌러 수를 두세요" : "빈 칸을 선택해 수를 두세요"}</p>
      </section>
    </main>
  );
}
