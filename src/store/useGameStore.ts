import { create } from "zustand";
import { createGame, type Game, type Mark, type ModeId } from "../domain/game";

export type Screen = "lobby" | "game";
export type Connection = "offline" | "waiting" | "connected" | "reconnecting" | "spectating";

interface State {
  screen: Screen;
  mode: ModeId;
  game: Game;
  role: Mark | null;
  practice: boolean;
  connection: Connection;
  roomCode: string;
  hostId: string;
  isHost: boolean;
  round: number;
  version: number;
  sound: boolean;
  pending: boolean;
  selectMode: (mode: ModeId) => void;
  enterRoom: (input: Partial<State>) => void;
  leaveRoom: () => void;
  applyGame: (game: Game, round?: number, version?: number) => void;
  setConnection: (connection: Connection) => void;
  setRole: (role: Mark | null) => void;
  setPending: (pending: boolean) => void;
  toggleSound: () => void;
}

export const useGameStore = create<State>((set, get) => ({
  screen: "lobby",
  mode: "classic",
  game: createGame(),
  role: null,
  practice: false,
  connection: "offline",
  roomCode: "",
  hostId: "",
  isHost: false,
  round: 1,
  version: 0,
  sound: true,
  pending: false,
  selectMode: (mode) => set({ mode, game: createGame(mode) }),
  enterRoom: (input) => set({ screen: "game", ...input }),
  leaveRoom: () => set({ screen: "lobby", game: createGame(get().mode), role: null, practice: false, connection: "offline", roomCode: "", hostId: "", isHost: false, round: 1, version: 0, pending: false }),
  applyGame: (game, round = get().round, version = get().version) => set({ game, round, version, pending: false }),
  setConnection: (connection) => set({ connection }),
  setRole: (role) => set({ role }),
  setPending: (pending) => set({ pending }),
  toggleSound: () => set({ sound: !get().sound }),
}));
