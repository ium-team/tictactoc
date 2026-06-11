import { joinRoom } from "https://esm.sh/trystero@0.20.1";
import { MODES, createGame, findComputerMove, loseOnTime, playMove } from "./game.js";

const NETWORK_CONFIG = {
  appId: "tic-tac-toc-complete-v1",
  relayUrls: ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
  rtcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
};

const state = {
  selectedMode: "classic",
  game: createGame(),
  room: null,
  roomCode: "",
  actions: null,
  peers: new Set(),
  myId: crypto.randomUUID().slice(0, 8),
  peerIds: new Map(),
  myRole: "X",
  roleReady: false,
  practice: false,
  layer: 0,
  round: 1,
  turnEndsAt: 0,
  timerId: null,
  sound: true,
};

const $ = (id) => document.getElementById(id);
const els = {
  lobby: $("lobby-view"), room: $("room-view"), modeStrip: $("mode-strip"),
  board: $("board"), boardShell: $("board-shell"), layerTabs: $("layer-tabs"),
  modeLabel: $("room-mode-label"), modeName: $("room-mode-name"), description: $("room-description"),
  playerX: $("player-x"), playerO: $("player-o"), nameX: $("name-x"), nameO: $("name-o"),
  stateX: $("state-x"), stateO: $("state-o"), roomCode: $("room-code-label"),
  connection: $("connection-label"), status: $("status-label"), hint: $("board-hint"),
  timer: $("timer"), timerValue: $("timer-value"), round: $("round-label"), toast: $("toast"),
};

function randomRoom() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function beep(frequency = 520, duration = .06) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.035, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function setUrl(room = "", mode = state.selectedMode) {
  const url = new URL(location.href);
  if (room) {
    url.searchParams.set("room", room);
    url.searchParams.set("mode", mode);
  } else {
    url.search = "";
  }
  history.replaceState({}, "", url);
}

function renderModes() {
  els.modeStrip.innerHTML = Object.values(MODES).map((mode, index) => `
    <button class="mode-option ${mode.id === state.selectedMode ? "active" : ""}" data-mode="${mode.id}">
      <span>0${index + 1} · ${mode.short}</span><strong>${mode.name}</strong>
    </button>`).join("");
  els.modeStrip.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMode = button.dataset.mode;
      renderModes();
      beep(360);
    });
  });
}

function setMode(mode) {
  state.selectedMode = MODES[mode] ? mode : "classic";
  state.game = createGame(state.selectedMode);
  state.layer = 0;
  const config = MODES[state.selectedMode];
  els.modeLabel.textContent = config.short;
  els.modeName.textContent = config.name;
  els.description.textContent = config.description;
  els.layerTabs.classList.toggle("hidden", config.layers === 1);
  els.timer.classList.toggle("visible", config.turnSeconds > 0);
  renderLayerTabs();
  renderBoard();
  renderStatus();
}

function renderLayerTabs() {
  if (MODES[state.selectedMode].layers === 1) return;
  els.layerTabs.innerHTML = [0, 1, 2].map((layer) =>
    `<button class="${state.layer === layer ? "active" : ""}" data-layer="${layer}">LAYER 0${layer + 1}</button>`
  ).join("");
  els.layerTabs.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    els.boardShell.classList.add("switching");
    setTimeout(() => {
      state.layer = Number(button.dataset.layer);
      renderLayerTabs();
      renderBoard();
      els.boardShell.classList.remove("switching");
    }, 140);
  }));
}

function canPlay() {
  return !state.game.winner &&
    (state.practice || state.peers.size > 0) &&
    (state.practice || state.roleReady) &&
    state.game.turn === state.myRole;
}

function renderBoard(lastIndex = -1) {
  const offset = state.selectedMode === "cube" ? state.layer * 9 : 0;
  els.board.innerHTML = Array.from({ length: 9 }, (_, localIndex) => {
    const index = offset + localIndex;
    const mark = state.game.board[index];
    const fading = MODES[state.selectedMode].maxMarks && state.game.history[mark]?.[0] === index &&
      state.game.history[mark]?.length === MODES[state.selectedMode].maxMarks;
    return `<button class="cell ${mark?.toLowerCase() || ""} ${state.game.winLine.includes(index) ? "win" : ""} ${fading ? "fading" : ""} ${index === lastIndex ? "just-played" : ""}"
      data-index="${index}" ${mark || !canPlay() ? "disabled" : ""} aria-label="${index + 1}번 칸">${mark === "X" ? "×" : mark === "O" ? "○" : ""}</button>`;
  }).join("");
  els.board.querySelectorAll(".cell").forEach((cell) => cell.addEventListener("click", () => makeMove(Number(cell.dataset.index))));
}

function renderStatus() {
  const game = state.game;
  const connected = state.practice || state.peers.size > 0;
  els.round.textContent = `ROUND ${String(state.round).padStart(2, "0")}`;
  els.playerX.classList.toggle("active", !game.winner && game.turn === "X");
  els.playerO.classList.toggle("active", !game.winner && game.turn === "O");
  els.stateX.textContent = game.turn === "X" && !game.winner ? "차례" : "";
  els.stateO.textContent = game.turn === "O" && !game.winner ? "차례" : "";

  if (!connected) els.status.textContent = "친구를 기다리고 있습니다";
  else if (!state.myRole) els.status.textContent = "방이 가득 차 관전 중입니다";
  else if (game.winner === "draw") els.status.textContent = "무승부 · 한 판 더?";
  else if (game.winner) els.status.textContent = `${game.winner === state.myRole ? "승리했습니다" : "상대가 승리했습니다"}`;
  else els.status.textContent = game.turn === state.myRole ? "당신의 차례입니다" : "상대의 차례입니다";

  els.hint.textContent = !connected ? "초대 링크를 친구에게 보내세요" :
    !state.myRole ? "이 방은 이미 두 명이 플레이 중입니다" :
    game.winner ? "새 판 시작 버튼으로 다시 대결하세요" :
    game.turn === state.myRole ? "빈 칸을 선택해 수를 두세요" : "상대의 수를 기다리는 중입니다";
}

function syncRender(lastIndex = -1) {
  renderBoard(lastIndex);
  renderStatus();
  startTurnTimer();
}

function makeMove(index, broadcast = true) {
  if (!canPlay() || state.game.board[index]) return;
  state.game = playMove(state.game, index);
  beep(state.game.turn === "X" ? 640 : 440, .08);
  syncRender(index);
  if (broadcast && state.actions) state.actions.sendMove({ index, moveCount: state.game.moveCount - 1 });

  if (state.practice && !state.game.winner) {
    state.myRole = "X";
    setTimeout(() => {
      const computerIndex = findComputerMove(state.game);
      if (computerIndex >= 0) {
        state.game = playMove(state.game, computerIndex);
        beep(380, .09);
        syncRender(computerIndex);
      }
    }, 480);
  }
}

function applyRemoteMove(index) {
  if (state.game.winner || state.game.board[index] || state.game.turn === state.myRole) return;
  state.game = playMove(state.game, index);
  beep(state.game.turn === "X" ? 640 : 440, .08);
  syncRender(index);
}

function startTurnTimer() {
  clearInterval(state.timerId);
  if (!MODES[state.selectedMode].turnSeconds || state.game.winner || (!state.practice && !state.peers.size)) return;
  state.turnEndsAt = Date.now() + MODES[state.selectedMode].turnSeconds * 1000;
  state.timerValue.textContent = MODES[state.selectedMode].turnSeconds;
  state.timerId = setInterval(() => {
    const left = Math.max(0, Math.ceil((state.turnEndsAt - Date.now()) / 1000));
    state.timerValue.textContent = left;
    if (left === 0) {
      clearInterval(state.timerId);
      state.game = loseOnTime(state.game, state.game.turn);
      renderBoard();
      renderStatus();
      if (state.actions) state.actions.sendTimeout({ player: state.game.winner === "X" ? "O" : "X", moveCount: state.game.moveCount });
    }
  }, 200);
}

function showRoom() {
  els.lobby.classList.add("hidden");
  els.room.classList.remove("hidden");
  els.roomCode.textContent = state.roomCode || "PRACTICE";
  els.connection.textContent = state.practice ? "컴퓨터 상대 · 오프라인" : "상대를 기다리는 중...";
  els.nameX.textContent = state.myRole === "X" ? "나" : state.practice ? "컴퓨터" : "친구";
  els.nameO.textContent = state.myRole === "O" ? "나" : state.practice ? "컴퓨터" : "친구";
}

function resetGame(broadcast = true) {
  state.game = createGame(state.selectedMode);
  state.round += 1;
  if (state.practice) state.myRole = "X";
  syncRender();
  if (broadcast && state.actions) state.actions.sendReset({ round: state.round });
}

function closeRoom() {
  clearInterval(state.timerId);
  state.room?.leave();
  state.room = null;
  state.actions = null;
  state.peers.clear();
  state.peerIds.clear();
  state.roleReady = false;
  state.practice = false;
  state.roomCode = "";
  state.round = 1;
  setUrl();
  els.room.classList.add("hidden");
  els.lobby.classList.remove("hidden");
  renderModes();
}

function updateRoles() {
  const ids = [state.myId, ...state.peerIds.values()].sort();
  const myIndex = ids.indexOf(state.myId);
  state.myRole = myIndex === 0 ? "X" : myIndex === 1 ? "O" : null;
  state.roleReady = ids.length > 1 && Boolean(state.myRole);
  els.nameX.textContent = state.myRole === "X" ? "나" : "친구";
  els.nameO.textContent = state.myRole === "O" ? "나" : "친구";
  syncRender();
}

function joinOnline(roomCode, mode) {
  setMode(mode);
  state.roomCode = roomCode.toUpperCase();
  state.practice = false;
  setUrl(state.roomCode, state.selectedMode);
  showRoom();

  state.room = joinRoom(NETWORK_CONFIG, `room-${state.roomCode}`);
  const [sendHello, getHello] = state.room.makeAction("hello");
  const [sendMove, getMove] = state.room.makeAction("move");
  const [sendReset, getReset] = state.room.makeAction("reset");
  const [sendTimeout, getTimeout] = state.room.makeAction("timeout");
  state.actions = { sendMove, sendReset, sendTimeout };

  state.room.onPeerJoin((peerId) => {
    state.peers.add(peerId);
    els.connection.textContent = "친구 연결됨 · P2P 보안 연결";
    sendHello({ id: state.myId, mode: state.selectedMode, game: state.game, round: state.round }, peerId);
    renderStatus();
  });
  state.room.onPeerLeave((peerId) => {
    state.peers.delete(peerId);
    state.peerIds.delete(peerId);
    els.connection.textContent = "친구 연결 끊김 · 재접속 대기 중";
    if (state.peers.size > 0) {
      updateRoles();
    } else {
      state.roleReady = false;
      renderStatus();
      renderBoard();
    }
  });
  getHello((data, peerId) => {
    const isFirstHello = !state.peerIds.has(peerId);
    if (isFirstHello) state.peerIds.set(peerId, data.id);
    if (data.mode === state.selectedMode && data.game?.moveCount > state.game.moveCount) state.game = data.game;
    updateRoles();
    if (isFirstHello) sendHello({ id: state.myId, mode: state.selectedMode, game: state.game, round: state.round }, peerId);
  });
  getMove((data) => {
    if (data.moveCount !== state.game.moveCount || state.game.turn === state.myRole) return;
    applyRemoteMove(data.index);
  });
  getReset((data) => {
    state.round = data.round || state.round + 1;
    state.game = createGame(state.selectedMode);
    syncRender();
  });
  getTimeout((data) => {
    if (data.moveCount === state.game.moveCount) {
      state.game = loseOnTime(state.game, data.player);
      syncRender();
    }
  });
}

function startPractice() {
  setMode(state.selectedMode);
  state.practice = true;
  state.myRole = "X";
  state.roleReady = true;
  state.roomCode = "";
  showRoom();
  syncRender();
}

$("create-button").addEventListener("click", () => joinOnline(randomRoom(), state.selectedMode));
$("practice-button").addEventListener("click", startPractice);
$("back-button").addEventListener("click", closeRoom);
$("brand-button").addEventListener("click", closeRoom);
$("restart-button").addEventListener("click", () => resetGame());
$("copy-button").addEventListener("click", async () => {
  if (state.practice) return showToast("연습 모드는 초대할 수 없습니다");
  try {
    await navigator.clipboard.writeText(location.href);
    showToast("초대 링크를 복사했습니다");
  } catch {
    showToast("주소창의 링크를 공유해주세요");
  }
});
$("sound-button").addEventListener("click", (event) => {
  state.sound = !state.sound;
  event.currentTarget.textContent = `SOUND ${state.sound ? "ON" : "OFF"}`;
  beep(500);
});
window.addEventListener("popstate", closeRoom);

renderModes();
const params = new URLSearchParams(location.search);
if (params.get("room")) joinOnline(params.get("room"), params.get("mode") || "classic");
