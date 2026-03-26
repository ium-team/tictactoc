import { joinRoom } from "https://esm.sh/trystero@0.20.1";

const appId = "tictactoc-p2p-v1";
const quickQueueRoomCode = "tictactoc-quick-v1";
const rematchTimeoutMs = 10_000;
const trysteroConfig = {
  appId,
  // Public Nostr relays for Trystero default strategy. Multiple relays
  // improve resiliency when a subset is temporarily unavailable.
  relayUrls: ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
  // 학교/기업망처럼 NAT가 강한 환경을 대비해 TURN(TCP/TLS) 우선 경로를 포함.
  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
      {
        urls: [
          "turn:openrelay.metered.ca:80?transport=tcp",
          "turn:openrelay.metered.ca:443?transport=tcp",
          "turns:openrelay.metered.ca:443?transport=tcp",
        ],
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  },
};

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

function createClientId() {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("이 브라우저는 randomUUID를 지원하지 않습니다.");
  }
  return crypto.randomUUID().slice(0, 8);
}

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
  clientId: "",
  quickWaiting: false,
  quickSince: 0,
  rematch: {
    active: false,
    myVote: null,
    peerVote: null,
    deadline: 0,
    timeoutId: null,
    autoQuickAfterDisconnect: false,
  },
};

const els = {
  board: document.getElementById("board"),
  status: document.getElementById("status-text"),
  roomCode: document.getElementById("room-code"),
  onlineControls: document.getElementById("online-controls"),
  aiControls: document.getElementById("ai-controls"),
  aiLevel: document.getElementById("ai-level"),
  modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
  rematchActions: document.getElementById("rematch-actions"),
  btnGenerate: document.getElementById("btn-generate"),
  btnJoin: document.getElementById("btn-join"),
  btnQuick: document.getElementById("btn-quick"),
  btnLeave: document.getElementById("btn-leave"),
  btnReset: document.getElementById("btn-reset"),
  btnRematchSame: document.getElementById("btn-rematch-same"),
  btnRematchNew: document.getElementById("btn-rematch-new"),
};

let room = null;
let sendMove = null;
let sendReset = null;
let sendMeta = null;
let roomHelloHeartbeat = null;
let roomConnectTimeout = null;

let quickQueueRoom = null;
let quickSend = null;
let quickHeartbeat = null;
let quickProposingTo = null;
let quickProposeTimeout = null;
let quickAcceptedFrom = null;
let quickAcceptTimeout = null;
let quickMatchedWith = null;
const quickPeers = new Map();

function setStatus(text) {
  els.status.textContent = text;
}

function disableOnlineWithError(message) {
  setStatus(`오류: ${message}`);
  els.roomCode.disabled = true;
  els.btnGenerate.disabled = true;
  els.btnJoin.disabled = true;
  els.btnQuick.disabled = true;
  els.btnLeave.disabled = true;
}

function setOnlineError(message) {
  setStatus(`오류: ${message}`);
}

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

function isGameOver() {
  return state.winner !== null;
}

function rematchSecondsLeft() {
  return Math.max(0, Math.ceil((state.rematch.deadline - Date.now()) / 1000));
}

function voteText(vote) {
  if (vote === "same") {
    return "다시하기";
  }
  if (vote === "new") {
    return "새 상대";
  }
  return "대기";
}

function renderRematchActions() {
  const visible = state.mode === "online" && isGameOver() && room && state.peerCount > 0;
  els.rematchActions.classList.toggle("hidden", !visible);

  if (!visible) {
    return;
  }

  els.btnRematchSame.disabled = state.rematch.myVote === "same";
  els.btnRematchNew.disabled = state.rematch.myVote === "new";
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

  const onlineEnded = state.mode === "online" && room && isGameOver();
  els.btnReset.disabled = Boolean(onlineEnded);
  renderRematchActions();

  if (state.mode === "online" && isGameOver() && state.rematch.active) {
    setStatus(
      `재경기 투표 - 나:${voteText(state.rematch.myVote)} / 상대:${voteText(state.rematch.peerVote)} (${rematchSecondsLeft()}초)`
    );
    return;
  }

  if (state.winner === "draw") {
    setStatus("무승부입니다.");
    return;
  }

  if (state.winner) {
    setStatus(`${state.winner} 승리!`);
    return;
  }

  if (state.mode === "ai") {
    setStatus(state.turn === "X" ? "당신 차례 (X)" : "컴퓨터 생각 중...");
    return;
  }

  if (state.quickWaiting && !room) {
    setStatus("빠른 대전 매칭 중입니다...");
    return;
  }

  if (!room) {
    setStatus("룸 코드를 입력하거나 빠른 대전을 누르세요.");
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

function maybeStartRematchVoting() {
  if (state.mode !== "online" || !room || state.peerCount === 0) {
    return;
  }

  if (state.rematch.active) {
    return;
  }

  state.rematch.active = true;
  state.rematch.myVote = null;
  state.rematch.peerVote = null;
  state.rematch.deadline = Date.now() + rematchTimeoutMs;
  state.rematch.autoQuickAfterDisconnect = false;

  if (state.rematch.timeoutId) {
    window.clearTimeout(state.rematch.timeoutId);
  }

  state.rematch.timeoutId = window.setTimeout(() => {
    if (!state.rematch.active) {
      return;
    }

    if (state.rematch.myVote === "same" && state.rematch.peerVote === "same") {
      return;
    }

    const autoQuick = state.rematch.autoQuickAfterDisconnect;
    clearRematchState();
    disconnectRoom();
    state.peerRole = null;
    resetBoard(false);
    render();

    if (autoQuick && state.mode === "online") {
      startQuickMatch();
    }
  }, rematchTimeoutMs);
}

function clearRematchState() {
  state.rematch.active = false;
  state.rematch.myVote = null;
  state.rematch.peerVote = null;
  state.rematch.deadline = 0;
  state.rematch.autoQuickAfterDisconnect = false;

  if (state.rematch.timeoutId) {
    window.clearTimeout(state.rematch.timeoutId);
    state.rematch.timeoutId = null;
  }
}

function stopRoomSignals() {
  if (roomHelloHeartbeat) {
    window.clearInterval(roomHelloHeartbeat);
    roomHelloHeartbeat = null;
  }
  if (roomConnectTimeout) {
    window.clearTimeout(roomConnectTimeout);
    roomConnectTimeout = null;
  }
}

function evaluateRematchAgreement() {
  if (!state.rematch.active) {
    return;
  }

  if (state.rematch.myVote === "same" && state.rematch.peerVote === "same") {
    clearRematchState();
    resetBoard(false);
    render();
  }
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
    maybeStartRematchVoting();
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
  clearRematchState();
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

function buildPrivateRoomCode(a, b) {
  const sorted = [a, b].sort();
  return `auto-${sorted[0]}-${sorted[1]}`;
}

function stopQuickMatch() {
  if (quickHeartbeat) {
    window.clearInterval(quickHeartbeat);
    quickHeartbeat = null;
  }

  if (quickProposeTimeout) {
    window.clearTimeout(quickProposeTimeout);
    quickProposeTimeout = null;
  }
  if (quickAcceptTimeout) {
    window.clearTimeout(quickAcceptTimeout);
    quickAcceptTimeout = null;
  }

  if (quickQueueRoom) {
    quickQueueRoom.leave();
  }

  quickQueueRoom = null;
  quickSend = null;
  quickProposingTo = null;
  quickAcceptedFrom = null;
  quickMatchedWith = null;
  quickPeers.clear();
  state.quickWaiting = false;
}

function broadcastQuickHello() {
  if (!quickSend || !state.quickWaiting) {
    return;
  }

  quickSend({
    type: "hello",
    from: state.clientId,
    waitingSince: state.quickSince,
  });
}

function tryQuickPropose() {
  if (!quickSend || !state.quickWaiting || quickMatchedWith || quickProposingTo) {
    return;
  }

  const olderCandidates = Array.from(quickPeers.values())
    .filter((peer) => {
      if (Date.now() - peer.seenAt >= 4_000) {
        return false;
      }
      if (peer.waitingSince < state.quickSince) {
        return true;
      }
      if (peer.waitingSince === state.quickSince) {
        return peer.id.localeCompare(state.clientId) < 0;
      }
      return false;
    })
    .sort((a, b) => a.waitingSince - b.waitingSince || a.id.localeCompare(b.id));

  const target = olderCandidates[0];
  if (!target) {
    return;
  }

  quickProposingTo = target.id;
  quickSend({ type: "propose", from: state.clientId, to: target.id });

  quickProposeTimeout = window.setTimeout(() => {
    if (quickProposingTo === target.id) {
      quickProposingTo = null;
      tryQuickPropose();
    }
  }, 2500);
}

function finalizeQuickMatch(opponentClientId) {
  if (quickMatchedWith || !state.quickWaiting) {
    return;
  }

  quickMatchedWith = opponentClientId;
  state.quickWaiting = false;
  quickProposingTo = null;
  quickAcceptedFrom = null;
  if (quickProposeTimeout) {
    window.clearTimeout(quickProposeTimeout);
    quickProposeTimeout = null;
  }
  if (quickAcceptTimeout) {
    window.clearTimeout(quickAcceptTimeout);
    quickAcceptTimeout = null;
  }

  const privateRoomCode = buildPrivateRoomCode(state.clientId, opponentClientId);
  stopQuickMatch();
  connectRoom(privateRoomCode);
}

function handleQuickMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  const from = payload.from;
  if (!from || from === state.clientId) {
    return;
  }

  if (payload.type === "hello" && Number.isInteger(payload.waitingSince)) {
    quickPeers.set(from, {
      id: from,
      waitingSince: payload.waitingSince,
      seenAt: Date.now(),
    });
    tryQuickPropose();
    render();
    return;
  }

  if (payload.type === "propose" && payload.to === state.clientId) {
    if (!state.quickWaiting || quickMatchedWith) {
      return;
    }

    const proposer = quickPeers.get(from);
    // proposer는 나보다 "늦게" 대기 시작한 피어여야 한다.
    if (
      proposer &&
      (proposer.waitingSince < state.quickSince ||
        (proposer.waitingSince === state.quickSince && proposer.id.localeCompare(state.clientId) < 0))
    ) {
      return;
    }

    if (quickSend) {
      quickSend({ type: "accept", from: state.clientId, to: from });
    }
    quickAcceptedFrom = from;
    if (quickAcceptTimeout) {
      window.clearTimeout(quickAcceptTimeout);
    }
    quickAcceptTimeout = window.setTimeout(() => {
      if (quickAcceptedFrom === from) {
        quickAcceptedFrom = null;
      }
    }, 3000);
    return;
  }

  if (payload.type === "accept" && payload.to === state.clientId && from === quickProposingTo) {
    if (quickSend) {
      quickSend({ type: "confirm", from: state.clientId, to: from });
    }
    finalizeQuickMatch(from);
    return;
  }

  if (payload.type === "confirm" && payload.to === state.clientId && from === quickAcceptedFrom) {
    finalizeQuickMatch(from);
  }
}

function startQuickMatch() {
  if (state.mode !== "online") {
    return;
  }

  stopQuickMatch();
  disconnectRoom();
  state.peerRole = null;
  state.quickWaiting = true;
  state.quickSince = Date.now();
  resetBoard(false);

  quickQueueRoom = joinRoom(trysteroConfig, quickQueueRoomCode, {
    onJoinError: () => {
      state.quickWaiting = false;
      setOnlineError("빠른 대전 연결에 실패했습니다. 잠시 후 다시 시도하세요.");
      render();
    },
  });
  const action = quickQueueRoom.makeAction("quick");
  quickSend = action[0];
  const getQuick = action[1];

  quickQueueRoom.onPeerJoin(() => {
    broadcastQuickHello();
    tryQuickPropose();
    render();
  });

  quickQueueRoom.onPeerLeave((peerId) => {
    if (peerId) {
      quickPeers.delete(peerId);
      if (quickAcceptedFrom === peerId) {
        quickAcceptedFrom = null;
      }
      if (quickProposingTo === peerId) {
        quickProposingTo = null;
      }
    } else {
      quickProposingTo = null;
    }
    quickProposingTo = null;
    tryQuickPropose();
    render();
  });

  getQuick((payload) => {
    handleQuickMessage(payload);
  });

  quickHeartbeat = window.setInterval(() => {
    broadcastQuickHello();
    tryQuickPropose();
    render();
  }, 1500);

  broadcastQuickHello();
  render();
}

function connectRoom(roomCode) {
  stopQuickMatch();
  disconnectRoom();

  state.roomCode = roomCode;
  state.peerRole = null;
  state.peerCount = 0;
  state.peerSeed = null;
  state.mySeed = Math.floor(Math.random() * 1_000_000_000);

  room = joinRoom(trysteroConfig, roomCode, {
    onJoinError: () => {
      disconnectRoom();
      state.peerRole = null;
      resetBoard(false);
      setOnlineError("룸 연결에 실패했습니다. 룸 코드를 확인하고 다시 시도하세요.");
      render();
    },
  });

  const actionMove = room.makeAction("move");
  sendMove = actionMove[0];
  const getMove = actionMove[1];

  const actionReset = room.makeAction("reset");
  sendReset = actionReset[0];
  const getReset = actionReset[1];

  const actionMeta = room.makeAction("meta");
  sendMeta = actionMeta[0];
  const getMeta = actionMeta[1];

  stopRoomSignals();
  roomHelloHeartbeat = window.setInterval(() => {
    if (sendMeta) {
      sendMeta({ type: "hello", seed: state.mySeed });
    }
  }, 1000);

  roomConnectTimeout = window.setTimeout(() => {
    if (!room || state.peerCount > 0) {
      return;
    }
    disconnectRoom();
    state.peerRole = null;
    resetBoard(false);
    setOnlineError("상대를 찾지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.");
  }, 15000);

  room.onPeerJoin(() => {
    state.peerCount += 1;
    if (roomConnectTimeout) {
      window.clearTimeout(roomConnectTimeout);
      roomConnectTimeout = null;
    }
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
      clearRematchState();
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
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (payload.type === "hello" && Number.isInteger(payload.seed)) {
      if (state.peerCount === 0) {
        state.peerCount = 1;
      }
      if (roomConnectTimeout) {
        window.clearTimeout(roomConnectTimeout);
        roomConnectTimeout = null;
      }
      state.peerSeed = payload.seed;
      computeRole();
      render();
      return;
    }

    if (payload.type === "rematch_vote") {
      state.rematch.peerVote = payload.vote === "same" ? "same" : "new";
      if (!state.rematch.active) {
        maybeStartRematchVoting();
      }
      evaluateRematchAgreement();
      render();
    }
  });

  sendMeta({ type: "hello", seed: state.mySeed });
  resetBoard(false);
  render();
}

function disconnectRoom() {
  clearRematchState();
  stopRoomSignals();

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
    stopQuickMatch();
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

  els.btnQuick.addEventListener("click", () => {
    startQuickMatch();
  });

  els.btnLeave.addEventListener("click", () => {
    stopQuickMatch();
    disconnectRoom();
    state.peerRole = null;
    resetBoard(false);
    render();
  });

  els.btnReset.addEventListener("click", () => {
    resetBoard(true);
  });

  els.btnRematchSame.addEventListener("click", () => {
    if (!state.rematch.active) {
      maybeStartRematchVoting();
    }

    state.rematch.myVote = "same";
    state.rematch.autoQuickAfterDisconnect = false;
    if (sendMeta) {
      sendMeta({ type: "rematch_vote", vote: "same" });
    }
    evaluateRematchAgreement();
    render();
  });

  els.btnRematchNew.addEventListener("click", () => {
    if (!state.rematch.active) {
      maybeStartRematchVoting();
    }

    state.rematch.myVote = "new";
    state.rematch.autoQuickAfterDisconnect = true;
    if (sendMeta) {
      sendMeta({ type: "rematch_vote", vote: "new" });
    }
    render();
  });

  els.aiLevel.addEventListener("change", () => {
    state.aiLevel = els.aiLevel.value;
    if (state.mode === "ai") {
      resetBoard(false);
    }
  });
}

function init() {
  try {
    state.clientId = createClientId();
  } catch (err) {
    disableOnlineWithError(err instanceof Error ? err.message : "초기화 실패");
    return;
  }

  createBoard();
  bindEvents();

  els.roomCode.value = randomRoomCode();
  state.aiLevel = els.aiLevel.value;

  render();
}

init();
