# Architecture

## Product Constraints

The game is a static web application. It does not require an account or a
dedicated game server. Friends join with a shared room URL and communicate
peer-to-peer.

The host owns the authoritative game state. Guests send move requests, and the
host validates and broadcasts the resulting state. Additional peers join as
spectators.

## Boundaries

- `src/domain/game.ts`: pure game rules, board generation, winners, and mode
  configuration. Keep this layer independent of React and networking.
- `src/store/useGameStore.ts`: local application state and game commands.
- `src/hooks/useMultiplayer.ts`: room lifecycle and peer-to-peer protocol.
- `src/components/`: rendering and user interaction.
- `src/lib/client.ts`: browser-only utilities and identifiers.

## Multiplayer Protocol

The room code in the URL identifies a Trystero room. The host publishes state
snapshots and handles guest move requests. Network payloads must be validated
before they alter local state.

Changes to message names or payloads must remain backward-compatible where
practical and must be tested with at least two browser contexts.

## Deployment

`npm run build` creates a static `dist/` directory. A deployment platform must
serve `index.html` as the fallback for application routes.
