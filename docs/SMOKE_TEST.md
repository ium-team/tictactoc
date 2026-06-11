# Smoke Test

Run `npm run check` before these manual checks.

## Local And Mode Checks

- Open the lobby and confirm the layout is white, clean, and usable on desktop
  and mobile widths.
- Start a local basic game and confirm turns, win detection, draw detection,
  restart, and return-to-lobby behavior.
- Start ultra-fast mode and confirm the sub-second timer displays correctly,
  expires correctly, and advances play without stale moves.
- Start 3D mode and confirm the full 3x3x3 cube renders, rotates with pointer
  drag, zooms, and accepts cell clicks without accidental moves while rotating.

## Shared Room Checks

- Create a room, copy its URL, and join from a second incognito browser context.
- Confirm the second peer receives the current mode, board, turn, and result.
- Play alternating moves from host and guest and confirm both views stay in
  sync.
- Refresh the guest and confirm it can rejoin the room.
- Join with a third peer and confirm it is a spectator and cannot submit moves.
- Close a peer and confirm the remaining browser shows a useful connection
  status without losing the current board.
