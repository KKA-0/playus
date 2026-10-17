import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/games/farm/controls.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { idleController, normalizeMovement, joystickMovement, nextMenuIndex, readController, cycleInventory, controllerIntent } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const pad = (down = [], axes = [0, 0], index = 0) => ({ index, axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: down.includes(i) })) });

test('analog deadzone prevents drift, preserves slow walking, and clamps diagonals', () => {
  assert.deepEqual(normalizeMovement(.1, .1, .2), { x: 0, y: 0 });
  const slow = normalizeMovement(.6, 0, .2);
  assert.ok(Math.abs(slow.x - .5) < .00001);
  assert.equal(slow.y, 0);
  const diagonal = normalizeMovement(1, 1, .2);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < .00001);
  assert.deepEqual(normalizeMovement(NaN, 1), { x: 0, y: 0 });
});

test('D-pad diagonals are normalized and take priority over analog stick drift', () => {
  const frame = readController(pad([12, 15], [-1, 1]), idleController(), 0);
  assert.ok(frame.move.x > 0 && frame.move.y < 0);
  assert.ok(Math.abs(Math.hypot(frame.move.x, frame.move.y) - 1) < .00001);
});

test('connecting or reconnecting with a held button never confirms a purchase', () => {
  const connected = readController(pad([0]), idleController(), 0);
  assert.deepEqual(connected.pressed, []);
  const disconnected = readController(null, connected.memory, 100);
  assert.deepEqual(disconnected.move, { x: 0, y: 0 });
  assert.deepEqual(readController(pad([0]), disconnected.memory, 200).pressed, []);
  assert.deepEqual(readController(pad([0], [0, 0], 1), connected.memory, 300).pressed, []);
});

test('use, interact, and confirm fire once per press, not once per frame', () => {
  let memory = readController(pad(), idleController(), 0).memory;
  for (const button of [0, 2, 3, 9]) {
    const down = readController(pad([button]), memory, 10);
    assert.deepEqual(down.pressed, [button]);
    const held = readController(pad([button]), down.memory, 2000);
    assert.deepEqual(held.pressed, []);
    memory = readController(pad(), held.memory, 2010).memory;
  }
});

test('menu navigation repeats at a controlled pace and a direction change is immediate', () => {
  const first = readController(pad([13]), idleController(), 0);
  assert.equal(first.navigate, 'down');
  const held = readController(pad([13]), first.memory, 200);
  assert.equal(held.navigate, null);
  const repeat = readController(pad([13]), held.memory, 380);
  assert.equal(repeat.navigate, 'down');
  assert.equal(readController(pad([13]), repeat.memory, 500).navigate, null);
  assert.equal(readController(pad([15]), repeat.memory, 400).navigate, 'right');
});

test('controller A confirms in menus and uses tools only in the world', () => {
  assert.equal(controllerIntent([0], true).action, 'confirm');
  assert.equal(controllerIntent([0], false).action, 'use');
  assert.equal(controllerIntent([2], false).action, 'interact');
  assert.equal(controllerIntent([2], true).action, null);
  assert.equal(controllerIntent([3], false).action, 'board');
  assert.equal(controllerIntent([1, 0], true).action, 'back');
  assert.equal(controllerIntent([9, 0], true).action, 'menu');
  assert.deepEqual(controllerIntent([5, 0], true), { action: null, cycle: 1 });
});

test('menu navigation follows rows and columns, wraps, and handles removed buttons', () => {
  const items = [
    { x: 0, y: 0, width: 100, height: 44 }, { x: 120, y: 0, width: 100, height: 44 },
    { x: 0, y: 64, width: 100, height: 44 }, { x: 120, y: 64, width: 100, height: 44 },
  ];
  assert.equal(nextMenuIndex(items, 0, 'right'), 1);
  assert.equal(nextMenuIndex(items, 0, 'down'), 2);
  assert.equal(nextMenuIndex(items, 3, 'up'), 1);
  assert.equal(nextMenuIndex(items, 0, 'up'), 3);
  assert.equal(nextMenuIndex(items, -1, 'down'), 0);
  assert.equal(nextMenuIndex([], 0, 'right'), -1);
});

test('thumbstick uses pointer coordinates, respects deadzone, and stays bounded outside its pad', () => {
  assert.deepEqual(joystickMovement(100, 100, 100, 100, 40), { x: 0, y: 0 });
  assert.deepEqual(joystickMovement(103, 100, 100, 100, 40), { x: 0, y: 0 });
  assert.deepEqual(joystickMovement(200, 100, 100, 100, 40), { x: 1, y: 0 });
  const diagonal = joystickMovement(500, -500, 100, 100, 40);
  assert.ok(diagonal.x > 0 && diagonal.y < 0);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < .00001);
  assert.deepEqual(joystickMovement(100, 100, 100, 100, 0), { x: 0, y: 0 });
});

test('shoulder buttons wrap both six-slot and upgraded eight-slot backpacks', () => {
  assert.equal(cycleInventory(0, -1, 6), 5);
  assert.equal(cycleInventory(5, 1, 6), 0);
  assert.equal(cycleInventory(7, 1, 8), 0);
  assert.equal(cycleInventory(0, -1, 8), 7);
  assert.equal(cycleInventory(0, 1, 0), 0);
});
