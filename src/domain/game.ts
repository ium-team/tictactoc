export type Mark = "X" | "O";
export type Winner = Mark | "draw" | null;
export type ModeId = "classic" | "cube" | "limited" | "speed";

export interface Mode {
  id: ModeId;
  name: string;
  short: string;
  description: string;
  size: number;
  turnMs: number;
  maxMarks: number;
}

export interface Game {
  mode: ModeId;
  board: Array<Mark | null>;
  turn: Mark;
  winner: Winner;
  winLine: number[];
  moveCount: number;
  history: Record<Mark, number[]>;
}

export const MODES: Record<ModeId, Mode> = {
  classic: { id: "classic", name: "클래식", short: "CLASSIC 3×3", description: "가장 먼저 한 줄을 완성하세요.", size: 9, turnMs: 0, maxMarks: 0 },
  cube: { id: "cube", name: "3D 큐브", short: "3D 3×3×3", description: "큐브를 돌리고 공간을 관통하는 한 줄을 만드세요.", size: 27, turnMs: 0, maxMarks: 0 },
  limited: { id: "limited", name: "초제한", short: "ONLY 3 MARKS", description: "네 번째 돌을 놓으면 가장 오래된 돌이 사라집니다.", size: 9, turnMs: 0, maxMarks: 3 },
  speed: { id: "speed", name: "스피드", short: "0.8 SEC TURN", description: "매 턴 0.8초. 본능적으로 선택하세요.", size: 9, turnMs: 800, maxMarks: 0 },
};

const classicLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
  [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];

const cubeIndex = (x: number, y: number, z: number) => z * 9 + y * 3 + x;

function createCubeLines() {
  const lines: number[][] = [];
  const directions: number[][] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    if (dx === 0 && dy === 0 && dz === 0) continue;
    if ([dx, dy, dz].find((value) => value !== 0) === 1) directions.push([dx, dy, dz]);
  }
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
    for (const [dx, dy, dz] of directions) {
      const end = [x + dx * 2, y + dy * 2, z + dz * 2];
      if (end.every((value) => value >= 0 && value < 3)) {
        lines.push([cubeIndex(x, y, z), cubeIndex(x + dx, y + dy, z + dz), cubeIndex(end[0], end[1], end[2])]);
      }
    }
  }
  return lines;
}

export const WIN_LINES: Record<ModeId, number[][]> = {
  classic: classicLines, cube: createCubeLines(), limited: classicLines, speed: classicLines,
};

export const createGame = (mode: ModeId = "classic"): Game => ({
  mode, board: Array(MODES[mode].size).fill(null), turn: "X", winner: null,
  winLine: [], moveCount: 0, history: { X: [], O: [] },
});

export function getResult(game: Game): Pick<Game, "winner" | "winLine"> {
  for (const line of WIN_LINES[game.mode]) {
    if (game.board[line[0]] && line.every((index) => game.board[index] === game.board[line[0]])) {
      return { winner: game.board[line[0]], winLine: line };
    }
  }
  return game.mode !== "limited" && game.board.every(Boolean)
    ? { winner: "draw", winLine: [] }
    : { winner: null, winLine: [] };
}

export function playMove(game: Game, index: number): Game {
  if (!Number.isInteger(index) || index < 0 || index >= game.board.length || game.winner || game.board[index]) return game;
  const next = structuredClone(game);
  const mark = next.turn;
  if (MODES[next.mode].maxMarks && next.history[mark].length >= MODES[next.mode].maxMarks) {
    next.board[next.history[mark].shift()!] = null;
  }
  next.board[index] = mark;
  next.history[mark].push(index);
  next.moveCount++;
  Object.assign(next, getResult(next));
  if (!next.winner) next.turn = mark === "X" ? "O" : "X";
  return next;
}

export const loseOnTime = (game: Game, mark: Mark): Game =>
  game.winner ? game : { ...game, winner: mark === "X" ? "O" : "X", winLine: [] };

export function findComputerMove(game: Game) {
  const open = game.board.flatMap((value, index) => value ? [] : [index]);
  for (const index of open) if (playMove(game, index).winner === game.turn) return index;
  const opponent = game.turn === "X" ? "O" : "X";
  for (const index of open) if (playMove({ ...structuredClone(game), turn: opponent }, index).winner === opponent) return index;
  return (game.mode === "cube" ? [13, 4, 10, 12, 14, 16, 22] : [4, 0, 2, 6, 8, 1, 3, 5, 7])
    .find((index) => open.includes(index)) ?? open[0] ?? -1;
}
