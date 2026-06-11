import { useCallback, useEffect, useRef } from "react";
import { joinRoom, type Room } from "trystero";
import { createGame, loseOnTime, playMove, type Game, type ModeId } from "../domain/game";
import { getClientId, setRoomUrl } from "../lib/client";
import { useGameStore } from "../store/useGameStore";

const config = {
  appId: "tic-tac-toc-react-v2",
  relayUrls: ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.nostr.band"],
  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
      { urls: ["turn:openrelay.metered.ca:80?transport=tcp", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" },
    ],
  },
};

interface Snapshot { game: Game; round: number; version: number; lastIndex: number }
type Actions = Record<"hello" | "seat" | "intent" | "snapshot" | "reset", any>;

const send = (action: any, data: any, target?: string) => {
  if (action) action.send(data, target ? { target } : undefined);
};

export function useMultiplayer() {
  const roomRef = useRef<Room | null>(null);
  const actionsRef = useRef<Actions | null>(null);
  const peers = useRef(new Map<string, string>());
  const guestId = useRef("");
  const hostPeerId = useRef("");
  const clientId = useRef(getClientId());
  const stateRef = useRef(useGameStore.getState());

  useEffect(() => useGameStore.subscribe((state) => { stateRef.current = state; }), []);

  const publish = useCallback((lastIndex = -1, peerId?: string) => {
    const state = stateRef.current;
    if (!state.isHost || !actionsRef.current) return;
    const snapshot = { game: state.game, round: state.round, version: state.version, lastIndex };
    sessionStorage.setItem(`tictactoc-room-${state.roomCode}`, JSON.stringify(snapshot));
    send(actionsRef.current.snapshot, snapshot, peerId);
  }, []);

  const connect = useCallback((roomCode: string, mode: ModeId, hostId: string) => {
    const isHost = hostId === clientId.current;
    let game = createGame(mode);
    let round = 1;
    let version = 0;
    if (isHost) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(`tictactoc-room-${roomCode}`) ?? "null") as Snapshot | null;
        if (saved?.game.mode === mode) ({ game, round, version } = saved);
      } catch { /* ignore malformed local state */ }
    }
    useGameStore.getState().enterRoom({ mode, game, round, version, roomCode, hostId, isHost, role: isHost ? "X" : null, practice: false, connection: "waiting" });
    setRoomUrl(roomCode, mode, hostId);

    const room = joinRoom(config, `room-${roomCode}`);
    roomRef.current = room;
    const hello = room.makeAction("hello");
    const seat = room.makeAction("seat");
    const intent = room.makeAction("intent");
    const snapshot = room.makeAction("snapshot");
    const reset = room.makeAction("reset");
    actionsRef.current = { hello, seat, intent, snapshot, reset };

    room.onPeerJoin = (peerId) => send(hello, { id: clientId.current, hostId, mode }, peerId);
    room.onPeerLeave = (peerId) => {
      const id = peers.current.get(peerId);
      peers.current.delete(peerId);
      if (id === guestId.current || id === hostId) useGameStore.getState().setConnection("reconnecting");
    };
    hello.onMessage = (payload: any, { peerId }: { peerId: string }) => {
      const data = payload as { id: string; hostId: string; mode: ModeId };
      if (data.hostId !== hostId || data.mode !== mode) return;
      peers.current.set(peerId, data.id);
      if (data.id === hostId) hostPeerId.current = peerId;
      if (!isHost || data.id === hostId) return;
      const role = !guestId.current || guestId.current === data.id ? "O" : null;
      if (role) guestId.current = data.id;
      send(seat, { role, hostId }, peerId);
      publish(-1, peerId);
      useGameStore.getState().setConnection(guestId.current ? "connected" : "waiting");
    };
    seat.onMessage = (payload: any, { peerId }: { peerId: string }) => {
      const data = payload as { role: "O" | null; hostId: string };
      if (isHost || data.hostId !== hostId) return;
      hostPeerId.current = peerId;
      useGameStore.getState().setRole(data.role);
      useGameStore.getState().setConnection(data.role ? "connected" : "spectating");
    };
    intent.onMessage = (payload: any, { peerId }: { peerId: string }) => {
      const data = payload as { index: number; version: number };
      const state = useGameStore.getState();
      if (!state.isHost || peers.current.get(peerId) !== guestId.current) return;
      if (data.version !== state.version || state.game.turn !== "O" || state.game.board[data.index]) return publish(-1, peerId);
      const next = playMove(state.game, data.index);
      state.applyGame(next, state.round, state.version + 1);
      queueMicrotask(() => publish(data.index));
    };
    snapshot.onMessage = (payload: any, { peerId }: { peerId: string }) => {
      const data = payload as unknown as Snapshot;
      const state = useGameStore.getState();
      if (state.isHost || (hostPeerId.current && hostPeerId.current !== peerId) || data.version < state.version) return;
      hostPeerId.current = peerId;
      state.applyGame(data.game, data.round, data.version);
    };
    reset.onMessage = (_data: any, { peerId }: { peerId: string }) => {
      const state = useGameStore.getState();
      if (!state.isHost || peers.current.get(peerId) !== guestId.current || !state.game.winner) return;
      state.applyGame(createGame(state.mode), state.round + 1, state.version + 1);
      queueMicrotask(() => publish());
    };
  }, [publish]);

  const leave = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    actionsRef.current = null;
    peers.current.clear();
    guestId.current = "";
    hostPeerId.current = "";
    setRoomUrl();
    useGameStore.getState().leaveRoom();
  }, []);

  const move = useCallback((index: number) => {
    const state = useGameStore.getState();
    if (state.practice) return;
    if (state.isHost) {
      const next = playMove(state.game, index);
      if (next === state.game) return;
      state.applyGame(next, state.round, state.version + 1);
      queueMicrotask(() => publish(index));
    } else if (state.role === "O" && hostPeerId.current) {
      state.setPending(true);
      send(actionsRef.current?.intent, { index, version: state.version }, hostPeerId.current);
    }
  }, [publish]);

  const restart = useCallback(() => {
    const state = useGameStore.getState();
    if (state.isHost) {
      state.applyGame(createGame(state.mode), state.round + 1, state.version + 1);
      queueMicrotask(() => publish());
    } else if (state.game.winner && hostPeerId.current) send(actionsRef.current?.reset, {}, hostPeerId.current);
  }, [publish]);

  const timeout = useCallback(() => {
    const state = useGameStore.getState();
    if (!state.isHost || state.game.winner) return;
    state.applyGame(loseOnTime(state.game, state.game.turn), state.round, state.version + 1);
    queueMicrotask(() => publish());
  }, [publish]);

  useEffect(() => () => { void roomRef.current?.leave(); }, []);
  return { connect, leave, move, restart, timeout, clientId: clientId.current };
}
