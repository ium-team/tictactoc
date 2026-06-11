import { describe, expect, it } from "vitest";
import { MODES, WIN_LINES, createGame, getResult, loseOnTime, playMove } from "./game";

describe("game domain", () => {
  it("detects a classic win", () => {
    let game = createGame();
    for (const move of [0, 3, 1, 4, 2]) game = playMove(game, move);
    expect(game.winner).toBe("X");
  });
  it("contains 49 cube lines", () => {
    expect(WIN_LINES.cube).toHaveLength(49);
    const game = createGame("cube");
    game.board[0] = game.board[13] = game.board[26] = "X";
    expect(getResult(game).winner).toBe("X");
  });
  it("removes the oldest limited mark", () => {
    let game = createGame("limited");
    for (const move of [0, 1, 3, 2, 7, 4, 8]) game = playMove(game, move);
    expect(game.board[0]).toBeNull();
  });
  it("uses an 800ms speed turn", () => {
    expect(MODES.speed.turnMs).toBe(800);
    expect(loseOnTime(createGame("speed"), "X").winner).toBe("O");
  });
});
