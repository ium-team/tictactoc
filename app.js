import { joinRoom } from "https://esm.sh/trystero@0.20.1";

const appId = "tictactoc-p2p-v1";
const winLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const state = {
  mode: "online",
  board: Array(9).fill(null),
  turn: "X",
  locked: false,
  winner: null,
  winLine: null,
  peerRole: null,
  peerCount: 0,
  roomCode: "",
  aiLevel: "hard",
  mySeed: Math.floor(Math.random() * 1_000_000_000),
  peerSeed: null,
};

const els = {
  board: document.getElementById("board"),
  status: document.getElementById("status-text"),
  roomCode: document.getElementById("room-code"),
  onlineControls: document.getElementById("online-controls"),
  aiControls: document.getElementById("ai-controls"),
  aiLevel: document.getElementById("ai-level"),
  modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
  btnGenerate: document.getElementById("btn-generate"),
  btnJoin: document.getElementById("btn-join"),
  btnLeave: document.getElementById("btn-leave"),
  btnReset: document.getElementById("btn-reset"),
};

let room = null;
let sendMove = null;
let sendReset = null;
let sendMeta = null;

function createBoard() {
  els.board.innerHTML = "";
  for (let i = 0; i < 9; i += 1) {
    const btn = document.createElement("button");
    btn.className = "cell";
    btn.dataset.idx = String(i);
    btn.addEventListener("click", onCellClick);
    els.board.appendChild(btn);
  }
}

function setStatus(text) {
  els.status.textContent = text;
}

function render() {
  const cells = Array.from(els.board.children);
  cells.forEach((cell, idx) => {
    const mark = state.board[idx];
    cell.textContent = mark || "";
    cell.disabled = state.locked || Boolean(mark) || !isMyTurn();
    cell.classList.toggle("x", mark === "X");
    cell.classList.toggle("o", mark === "O");
    cell.classList.toggle("win", state.winLine?.includes(idx) || false);
  });

  if (state.winner === "draw") {
    setStatus("무승부입니다. 다시 시작하세요.");
    return;
  }

  if (state.winner) {
    setStatus(`${state.winner} 승리! 다시 시작을 눌러주세요.`);
    return;
  }

  if (state.mode === "ai") {
    setStatus(state.turn === "X" ? "당신 차례 (X)" : "컴퓨터 생각 중...");
    return;
  }

  if (!room) {
    setStatus("룸 코드를 입력하고 입장/연결을 누르세요.");
    return;
  }

  if (state.peerCount === 0) {
    setStatus("상대를 기다리는 중입니다...");
    return;
  }

  if (!state.peerRole) {
    setStatus("역할 동기화 중입니다...");
    return;
  }

  const turnText = state.turn === state.peerRole ? "당신 차례" : "상대 차례";
  setStatus(`${turnText} (${state.turn})`);
}

function checkWinner(board) {
  for (const line of winLines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line };
    }
  }

  if (board.every(Boolean)) {
    return { winner: "draw", line: null };
  }

  return { winner: null, line: null };
}

function applyMove(idx, mark) {
  if (state.locked || state.board[idx]) {
    return false;
  }

  state.board[idx] = mark;
  state.turn = mark === "X" ? "O" : "X";

  const result = checkWinner(state.board);
  if (result.winner) {
    state.winner = result.winner;
    state.winLine = result.line;
    state.locked = true;
  }

  render();
  return true;
}

function resetBoard(send = true) {
  state.board = Array(9).fill(null);
  state.turn = "X";
  state.winner = null;
  state.winLine = null;
  state.locked = false;
  render();

  if (state.mode === "online" && room && sendReset && send) {
    sendReset({ t: Date.now() });
  }
}

function isMyTurn() {
  if (state.winner || state.locked) {
    return false;
  }

  if (state.mode === "ai") {
    return state.turn === "X";
  }

  if (!room || state.peerCount === 0 || !state.peerRole) {
    return false;
  }

  return state.turn === state.peerRole;
}

function onCellClick(e) {
  const idx = Number(e.currentTarget.dataset.idx);

  if (state.mode === "ai") {
    if (!isMyTurn()) {
      return;
    }

    const ok = applyMove(idx, "X");
    if (ok && !state.winner) {
      maybeComputerMove();
    }
    return;
  }

  if (!isMyTurn()) {
    return;
  }

  const myMark = state.peerRole;
  const ok = applyMove(idx, myMark);
  if (!ok) {
    return;
  }

  if (sendMove) {
    sendMove({ idx, mark: myMark });
  }
}

function randomRoomCode() {
  const seed = Math.random().toString(36).slice(2, 8);
  return `room-${seed}`;
}

function normalizeRoomCode(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 24);
}

function computeRole() {
  if (!Number.isInteger(state.peerSeed)) {
    return;
  }

  if (state.mySeed === state.peerSeed) {
    state.mySeed += 1;
  }

  state.peerRole = state.mySeed < state.peerSeed ? "X" : "O";
}

function connectRoom(roomCode) {
  disconnectRoom();

  state.roomCode = roomCode;
  state.peerRole = null;
  state.peerCount = 0;
  state.peerSeed = null;
  state.mySeed = Math.floor(Math.random() * 1_000_000_000);

  room = joinRoom({ appId }, roomCode);

  const actionMove = room.makeAction("move");
  sendMove = actionMove[0];
  const getMove = actionMove[1];

  const actionReset = room.makeAction("reset");
  sendReset = actionReset[0];
  const getReset = actionReset[1];

  const actionMeta = room.makeAction("meta");
  sendMeta = actionMeta[0];
  const getMeta = actionMeta[1];

  room.onPeerJoin(() => {
    state.peerCount += 1;
    if (state.peerCount > 1) {
      setStatus("현재는 1:1만 지원합니다. 두 명만 같은 룸에 접속하세요.");
    }

    sendMeta({ type: "hello", seed: state.mySeed });
    render();
  });

  room.onPeerLeave(() => {
    state.peerCount = Math.max(0, state.peerCount - 1);

    if (state.peerCount === 0) {
      state.peerRole = null;
      state.peerSeed = null;
      resetBoard(false);
    }

    render();
  });

  getMove((payload) => {
    if (!payload || typeof payload.idx !== "number") {
      return;
    }

    if (payload.mark !== "X" && payload.mark !== "O") {
      return;
    }

    applyMove(payload.idx, payload.mark);
  });

  getReset(() => {
    resetBoard(false);
  });

  getMeta((payload) => {
    if (!payload || payload.type !== "hello" || !Number.isInteger(payload.seed)) {
      return;
    }

    if (state.peerCount === 0) {
      state.peerCount = 1;
    }
    state.peerSeed = payload.seed;
    computeRole();
    render();
  });

  sendMeta({ type: "hello", seed: state.mySeed });
  resetBoard(false);
  render();
}

function disconnectRoom() {
  if (room) {
    room.leave();
  }

  room = null;
  sendMove = null;
  sendReset = null;
  sendMeta = null;
  state.peerCount = 0;
  state.peerSeed = null;
}

function setMode(mode) {
  if (mode === state.mode) {
    return;
  }

  state.mode = mode;

  els.modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  const isOnline = mode === "online";
  els.onlineControls.classList.toggle("hidden", !isOnline);
  els.aiControls.classList.toggle("hidden", isOnline);

  if (!isOnline) {
    disconnectRoom();
    state.peerRole = null;
  }

  resetBoard(false);
  render();
}

function availableMoves(board) {
  return board.map((v, i) => (v ? -1 : i)).filter((n) => n >= 0);
}

function bestMove(board, isMaximizing) {
  const result = checkWinner(board);
  if (result.winner === "O") {
    return { score: 1 };
  }

  if (result.winner === "X") {
    return { score: -1 };
  }

  if (result.winner === "draw") {
    return { score: 0 };
  }

  let best = { score: isMaximizing ? -Infinity : Infinity, move: null };

  for (const move of availableMoves(board)) {
    board[move] = isMaximizing ? "O" : "X";
    const score = bestMove(board, !isMaximizing).score;
    board[move] = null;

    if (isMaximizing) {
      if (score > best.score) {
        best = { score, move };
      }
    } else if (score < best.score) {
      best = { score, move };
    }
  }

  return best;
}

function maybeComputerMove() {
  if (state.mode !== "ai" || state.turn !== "O" || state.winner) {
    return;
  }

  state.locked = true;
  render();

  window.setTimeout(() => {
    let move;
    if (state.aiLevel === "easy") {
      const moves = availableMoves(state.board);
      move = moves[Math.floor(Math.random() * moves.length)];
    } else {
      move = bestMove([...state.board], true).move;
    }

    state.locked = false;
    if (typeof move === "number") {
      applyMove(move, "O");
    }
  }, 320);
}

function bindEvents() {
  els.modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  els.btnGenerate.addEventListener("click", () => {
    els.roomCode.value = randomRoomCode();
  });

  els.btnJoin.addEventListener("click", () => {
    const code = normalizeRoomCode(els.roomCode.value);
    if (!code) {
      setStatus("유효한 룸 코드를 입력하세요.");
      return;
    }

    els.roomCode.value = code;
    connectRoom(code);
  });

  els.btnLeave.addEventListener("click", () => {
    disconnectRoom();
    state.peerRole = null;
    resetBoard(false);
    render();
  });

  els.btnReset.addEventListener("click", () => {
    resetBoard(true);
  });

  els.aiLevel.addEventListener("change", () => {
    state.aiLevel = els.aiLevel.value;
    if (state.mode === "ai") {
      resetBoard(false);
    }
  });
}

function init() {
  createBoard();
  bindEvents();

  els.roomCode.value = randomRoomCode();
  state.aiLevel = els.aiLevel.value;

  render();
}

init();
