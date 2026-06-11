export function getClientId() {
  const key = "tictactoc-client-id";
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const id = crypto.randomUUID().slice(0, 12);
  sessionStorage.setItem(key, id);
  return id;
}

export function randomRoom() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function setRoomUrl(room = "", mode = "", host = "") {
  const url = new URL(location.href);
  url.search = "";
  if (room) {
    url.searchParams.set("room", room);
    url.searchParams.set("mode", mode);
    url.searchParams.set("host", host);
  }
  history.replaceState({}, "", url);
}

export function roomParams() {
  const params = new URLSearchParams(location.search);
  return { room: params.get("room"), mode: params.get("mode"), host: params.get("host") };
}
