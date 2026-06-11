import test from "node:test";
import assert from "node:assert/strict";
import { WIN_LINES, createGame, getResult, loseOnTime, playMove } from "../game.js";

test("classic game detects a win", () => {
  let game = createGame("classic");
  for (const move of [0, 3, 1, 4, 2]) game = playMove(game, move);
  assert.equal(game.winner, "X");
  assert.deepEqual(game.winLine, [0, 1, 2]);
});

test("cube has 49 unique winning lines and detects a space diagonal", () => {
  assert.equal(WIN_LINES.cube.length, 49);
  const game = createGame("cube");
  game.board[0] = game.board[13] = game.board[26] = "X";
  assert.equal(getResult(game).winner, "X");
});

test("limited mode removes the player's oldest mark", () => {
  let game = createGame("limited");
  for (const move of [0, 1, 3, 2, 7, 4, 8]) game = playMove(game, move);
  assert.equal(game.board[0], null);
  assert.deepEqual(game.history.X, [3, 7, 8]);
});

test("speed game awards the win to the other player on timeout", () => {
  const game = loseOnTime(createGame("speed"), "X");
  assert.equal(game.winner, "O");
});

test("occupied cells and moves after game over are ignored", () => {
  let game = createGame();
  game = playMove(game, 0);
  assert.deepEqual(playMove(game, 0), game);
  for (const move of [3, 1, 4, 2]) game = playMove(game, move);
  assert.deepEqual(playMove(game, 8), game);
});
