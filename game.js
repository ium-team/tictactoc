export const MODES = {
  classic: {
    id: "classic",
    name: "클래식",
    short: "CLASSIC 3×3",
    description: "가장 먼저 한 줄을 완성하세요.",
    size: 9,
    layers: 1,
    turnSeconds: 0,
    maxMarks: 0,
  },
  cube: {
    id: "cube",
    name: "3D 큐브",
    short: "3D 3×3×3",
    description: "세 개의 층을 관통하는 한 줄도 승리입니다.",
    size: 27,
    layers: 3,
    turnSeconds: 0,
    maxMarks: 0,
  },
  limited: {
    id: "limited",
    name: "초제한",
    short: "ONLY 3 MARKS",
    description: "각자 돌은 3개뿐. 네 번째 돌을 놓으면 가장 오래된 돌이 사라집니다.",
    size: 9,
    layers: 1,
    turnSeconds: 0,
    maxMarks: 3,
  },
  speed: {
    id: "speed",
    name: "스피드",
    short: "8 SEC TURN",
    description: "매 턴 8초. 시간이 끝나면 상대가 승리합니다.",
    size: 9,
    layers: 1,
    turnSeconds: 8,
    maxMarks: 0,
  },
};

const classicLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function cubeIndex(x, y, z) {
  return z * 9 + y * 3 + x;
}

function createCubeLines() {
  const lines = [];
  const directions = [];

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const first = [dx, dy, dz].find((value) => value !== 0);
        if (first === 1) directions.push([dx, dy, dz]);
      }
    }
  }

  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let z = 0; z < 3; z += 1) {
        for (const [dx, dy, dz] of directions) {
          const end = [x + dx * 2, y + dy * 2, z + dz * 2];
          if (end.every((value) => value >= 0 && value < 3)) {
            lines.push([
              cubeIndex(x, y, z),
              cubeIndex(x + dx, y + dy, z + dz),
              cubeIndex(...end),
            ]);
          }
        }
      }
    }
  }

  return lines;
}

export const WIN_LINES = {
  classic: classicLines,
  cube: createCubeLines(),
  limited: classicLines,
  speed: classicLines,
};

export function createGame(mode = "classic") {
  const config = MODES[mode] || MODES.classic;
  return {
    mode: config.id,
    board: Array(config.size).fill(null),
    turn: "X",
    winner: null,
    winLine: [],
    moveCount: 0,
    history: { X: [], O: [] },
  };
}

export function getResult(game) {
  for (const line of WIN_LINES[game.mode]) {
    if (game.board[line[0]] && line.every((index) => game.board[index] === game.board[line[0]])) {
      return { winner: game.board[line[0]], winLine: line };
    }
  }

  if (game.mode !== "limited" && game.board.every(Boolean)) {
    return { winner: "draw", winLine: [] };
  }

  return { winner: null, winLine: [] };
}

export function playMove(game, index) {
  if (!Number.isInteger(index) || index < 0 || index >= game.board.length) return game;
  if (game.winner || game.board[index]) return game;

  const next = structuredClone(game);
  const player = next.turn;
  const config = MODES[next.mode];

  if (config.maxMarks && next.history[player].length >= config.maxMarks) {
    const removed = next.history[player].shift();
    next.board[removed] = null;
  }

  next.board[index] = player;
  next.history[player].push(index);
  next.moveCount += 1;

  const result = getResult(next);
  next.winner = result.winner;
  next.winLine = result.winLine;
  if (!next.winner) next.turn = player === "X" ? "O" : "X";
  return next;
}

export function loseOnTime(game, player) {
  if (game.winner || !["X", "O"].includes(player)) return game;
  return { ...game, winner: player === "X" ? "O" : "X", winLine: [] };
}

export function findComputerMove(game) {
  const open = game.board
    .map((value, index) => (value ? null : index))
    .filter((index) => index !== null);

  for (const index of open) {
    const result = playMove(game, index);
    if (result.winner === game.turn) return index;
  }

  const opponent = game.turn === "X" ? "O" : "X";
  for (const index of open) {
    const threat = { ...structuredClone(game), turn: opponent };
    if (playMove(threat, index).winner === opponent) return index;
  }

  const preferred = game.mode === "cube"
    ? [13, 4, 10, 12, 14, 16, 22]
    : [4, 0, 2, 6, 8, 1, 3, 5, 7];
  return preferred.find((index) => open.includes(index)) ?? open[0] ?? -1;
}
