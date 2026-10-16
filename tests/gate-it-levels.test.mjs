import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/games/gateIt/levels.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const {
  LEVELS, ROWS, COLS, TILE_SIZE, GRAVITY, WALK_SPEED, JUMP_FORCE,
  TILE_SOLID, TILE_SPIKES, TILE_GATE, TILE_SWITCH, TILE_TERMINAL, TILE_DOOR,
  getLevelSpawns, getNextLevelIndex, resolveTileCollisions,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const body = position => ({ ...position, width: 24, height: 32, vx: 0, vy: 0, isJumping: false });
const overlap = (p, x, y, w, h) => p.x < x + w && p.x + p.width > x && p.y < y + h && p.y + p.height > y;
const tilesOfType = (map, type) => map.flatMap((row, r) => row.flatMap((tile, c) => tile === type ? [{ r, c }] : []));
const standingAt = ({ r, c }) => ({ x: c * TILE_SIZE + 8, y: (r + 1) * TILE_SIZE - 32 });
const isSolid = (tile, gatesOpen) => tile === TILE_SOLID || (tile === TILE_GATE && !gatesOpen);
const hitsSpikes = (p, map) => tilesOfType(map, TILE_SPIKES).some(({ r, c }) => overlap(p, c * TILE_SIZE + 4, r * TILE_SIZE + 20, 32, 20));

test('all six maps have valid tiles, supported objectives, and distinct player spawns', () => {
  assert.equal(LEVELS.length, 6);
  for (const level of LEVELS) {
    assert.equal(level.map.length, ROWS);
    for (const row of level.map) {
      assert.equal(row.length, COLS);
      assert.ok(row.every(tile => Number.isInteger(tile) && tile >= 0 && tile <= 6));
    }
    assert.equal(tilesOfType(level.map, TILE_TERMINAL).length, 1);
    assert.equal(tilesOfType(level.map, TILE_DOOR).length, 1);
    assert.ok(tilesOfType(level.map, TILE_SWITCH).length >= 2);
    assert.ok(tilesOfType(level.map, TILE_GATE).length > 0);
    assert.notDeepEqual(level.hostSpawn, level.guestSpawn);
    for (const spawn of [level.hostSpawn, level.guestSpawn]) {
      const p = body(spawn);
      assert.equal(hitsSpikes(p, level.map), false, `${level.name}: unsafe spawn`);
      for (const { r, c } of [...tilesOfType(level.map, TILE_SOLID), ...tilesOfType(level.map, TILE_GATE)]) {
        assert.equal(overlap(p, c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE), false, `${level.name}: spawn in a wall`);
      }
    }
    for (const tile of [TILE_SWITCH, TILE_TERMINAL, TILE_DOOR]) {
      for (const { r, c } of tilesOfType(level.map, tile)) {
        assert.equal(level.map[r + 1][c], TILE_SOLID, `${level.name}: unsupported objective at ${r},${c}`);
      }
    }
  }
});

test('host and guest agree on local and remote spawns, including both split-start levels', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const host = getLevelSpawns(i, true);
    const guest = getLevelSpawns(i, false);
    assert.deepEqual(host.local, guest.remote);
    assert.deepEqual(host.remote, guest.local);
  }
  assert.notEqual(LEVELS[1].hostSpawn.y, LEVELS[1].guestSpawn.y);
  assert.notEqual(LEVELS[4].hostSpawn.y, LEVELS[4].guestSpawn.y);
});

test('progression continues after the original finale and ends after level six', () => {
  assert.equal(getNextLevelIndex(2), 3);
  assert.equal(getNextLevelIndex(3), 4);
  assert.equal(getNextLevelIndex(4), 5);
  assert.equal(getNextLevelIndex(5), null);
});

// Build a route graph using actual tile collision code and full-height jumps.
// No teammate boosts or coyote jumps are needed for these solutions.
const navigatorFor = (map, gatesOpen) => {
  const nodes = [];
  for (let r = 1; r < ROWS; r++) for (let c = 1; c < COLS - 1; c++) {
    if (!isSolid(map[r][c], gatesOpen) || isSolid(map[r - 1][c], gatesOpen)) continue;
    const p = { x: c * TILE_SIZE + 8, y: r * TILE_SIZE - 32 };
    if (!hitsSpikes(body(p), map)) nodes.push(p);
  }
  const edges = new Map();
  const canTravel = (from, to, jump) => {
    const p = body(from);
    if (jump) p.vy = JUMP_FORCE;
    for (let frame = 0; frame < 100; frame++) {
      p.vx = Math.abs(to.x - p.x) < WALK_SPEED ? 0 : Math.sign(to.x - p.x) * WALK_SPEED;
      p.vy = Math.min(12, p.vy + GRAVITY);
      p.x += p.vx;
      resolveTileCollisions(p, map, 'x', gatesOpen);
      p.y += p.vy;
      p.isJumping = true;
      resolveTileCollisions(p, map, 'y', gatesOpen);
      if (hitsSpikes(p, map)) return false;
      if (!p.isJumping && Math.abs(p.x - to.x) < WALK_SPEED + 0.1 && Math.abs(p.y - to.y) < 1) return true;
      if (p.y > 480) return false;
      if (jump && !p.isJumping && Math.abs(p.y - to.y) > 1) return false;
    }
    return false;
  };
  return (start, destination) => {
    // Spawns may begin slightly above the floor; first let gravity settle them.
    const initial = body(start);
    for (let frame = 0; frame < 60; frame++) {
      initial.vy = Math.min(12, initial.vy + GRAVITY);
      initial.y += initial.vy;
      resolveTileCollisions(initial, map, 'y', gatesOpen);
    }
    const first = nodes.findIndex(p => Math.abs(p.x - initial.x) <= 12 && Math.abs(p.y - initial.y) < 1);
    const target = nodes.findIndex(p => Math.abs(p.x - destination.x) < 1 && Math.abs(p.y - destination.y) < 1);
    if (first < 0 || target < 0) return false;
    const visited = new Set([first]);
    const queue = [first];
    for (let at = 0; at < queue.length; at++) {
      const i = queue[at];
      if (i === target) return true;
      if (!edges.has(i)) {
        edges.set(i, nodes.flatMap((to, j) => {
          if (i === j || nodes[i].y - to.y > 111 || Math.abs(nodes[i].x - to.x) > 180) return [];
          return canTravel(nodes[i], to, false) || canTravel(nodes[i], to, true) ? [j] : [];
        }));
      }
      for (const j of edges.get(i)) if (!visited.has(j)) { visited.add(j); queue.push(j); }
    }
    return false;
  };
};

for (const [i, level] of LEVELS.entries()) {
  if (i < 3) continue;
  test(`${level.name}: switch handoff, spike crossing, terminal, and exit are reachable`, () => {
    const closed = navigatorFor(level.map, false);
    const open = navigatorFor(level.map, true);
    const switches = tilesOfType(level.map, TILE_SWITCH).sort((a, b) => a.c - b.c);
    const firstSwitch = standingAt(switches[0]);
    const farSwitch = standingAt(switches.at(-1));
    const terminal = standingAt(tilesOfType(level.map, TILE_TERMINAL)[0]);
    const exit = standingAt(tilesOfType(level.map, TILE_DOOR)[0]);
    const holder = i === 4 ? level.guestSpawn : level.hostSpawn;
    const runner = i === 4 ? level.hostSpawn : level.guestSpawn;
    assert.ok(closed(holder, firstSwitch), 'The first switch must be reachable before any gate opens');
    assert.equal(closed(runner, terminal), false, 'A player must not bypass the cooperative gates');
    assert.ok(open(runner, farSwitch), 'The runner needs a safe route to the return switch');
    assert.ok(open(firstSwitch, farSwitch), 'The switch holder must be able to join their teammate');
    assert.ok(closed(farSwitch, terminal), 'Leaving the last switch must not trap the players');
    assert.ok(closed(terminal, exit), 'Both players must be able to reach the unlocked exit');
  });
}
