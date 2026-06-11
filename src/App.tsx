import { useCallback, useEffect, useRef } from "react";
import { createGame, findComputerMove, loseOnTime, playMove, type ModeId } from "./domain/game";
import { useMultiplayer } from "./hooks/useMultiplayer";
import { randomRoom, roomParams } from "./lib/client";
import { useGameStore } from "./store/useGameStore";
import { GameRoom } from "./components/GameRoom";
import { Lobby } from "./components/Lobby";

export default function App() {
  const state = useGameStore();
  const multiplayer = useMultiplayer();
  const joinedFromUrl = useRef(false);

  useEffect(() => {
    if (joinedFromUrl.current) return;
    joinedFromUrl.current = true;
    const { room, mode, host } = roomParams();
    if (room && host) multiplayer.connect(room, (mode as ModeId) || "classic", host);
  }, []); // URL join runs once.

  const practiceMove = useCallback((index: number) => {
    const current = useGameStore.getState();
    if (!current.practice || current.game.turn !== "X") return;
    const next = playMove(current.game, index);
    if (next === current.game) return;
    current.applyGame(next);
    if (!next.winner) window.setTimeout(() => {
      const latest = useGameStore.getState();
      latest.applyGame(playMove(latest.game, findComputerMove(latest.game)));
    }, 320);
  }, []);

  const move = state.practice ? practiceMove : multiplayer.move;
  const restart = state.practice ? () => state.applyGame(createGame(state.mode), state.round + 1) : multiplayer.restart;
  const timeout = state.practice ? () => state.applyGame(loseOnTime(state.game, state.game.turn)) : multiplayer.timeout;

  return (
    <>
      <header className="topbar"><button className="brand" onClick={state.screen === "game" ? multiplayer.leave : undefined}><span>✣</span>TIC TAC TOC</button><div><span className="online">● 서버비 0원 · P2P</span><button onClick={state.toggleSound}>SOUND {state.sound ? "ON" : "OFF"}</button></div></header>
      {state.screen === "lobby"
        ? <Lobby onCreate={() => multiplayer.connect(randomRoom(), state.mode, multiplayer.clientId)} onPractice={() => state.enterRoom({ practice: true, role: "X", connection: "offline", game: createGame(state.mode), round: 1 })} />
        : <GameRoom onLeave={multiplayer.leave} onMove={move} onRestart={restart} onTimeout={timeout} />}
    </>
  );
}
